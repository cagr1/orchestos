/**
 * src/run/executors/external.ts — B.1
 *
 * Tercera implementación de ExecutorEngine: delega la tarea completa a
 * Claude Code headless (`claude -p`) corriendo dentro del worktree del
 * sandbox. Diseño completo y las 4 decisiones: docs/external-executor-design.md.
 *
 * A diferencia de single-shot/agentic (que devuelven un buffer en memoria y
 * dejan que enforceContract() haga el ÚNICO write real a disco), el proceso
 * externo escribe directo al filesystem del worktree mientras corre. Este
 * engine no reimplementa el filtrado del contrato — lee TODO lo que cambió
 * (autorizado o no) vía `git status --porcelain` y se lo entrega tal cual al
 * harness como `files: FileChange[]`. enforceContract() sigue siendo la
 * única frontera real (§2/§5 del diseño): si algo cae fuera de `output[]`,
 * lanza CONTRACT VIOLATION igual que hoy, y el `finally` de runTask() ya
 * descarta cualquier worktree vivo — verificado en el diseño, no hace falta
 * lógica de revert nueva acá.
 */

import { existsSync, readFileSync, statSync } from 'fs'
import { join } from 'path'
import { normalizeRelPath } from '../contract.ts'
import type { ExecutorEngine, ExecutorOutcome } from './types.ts'

export class ExecutorExternalError extends Error {}

const DEFAULT_TIMEOUT_MS = 20 * 60 * 1000 // 20min — mismo default documentado en §4 del diseño
const CLAUDE_BINARY = 'claude'

/**
 * C.2 — detección honesta del binario externo. Se chequea ANTES del spawn
 * (en `externalEngine.run()` y en cualquier punto de selección temprana que
 * lo importe — ver `src/cli.ts` task run y `GET /api/system/engines/external/availability`).
 * `Bun.which` es sync y busca en `PATH` siguiendo el orden estándar del OS;
 * retorna la ruta absoluta si está instalado, `null` si no. Exportamos la
 * función para que el endpoint del dashboard y la CLI reusen la misma lógica
 * (no duplicar `Bun.which` en 3 sitios y arriesgar drift).
 */
export function findClaudeBinary(): string | null {
  return Bun.which(CLAUDE_BINARY)
}

/** Mensaje canónico cuando el binario no está. Reusado en engine, CLI y API. */
export function claudeUnavailableMessage(pathHint?: string): string {
  const where = pathHint ? ` (PATH searched: ${pathHint})` : ''
  return [
    `Claude Code binary "${CLAUDE_BINARY}" not found in PATH${where}.`,
    `Install Claude Code (https://claude.com/download) or use --engine single-shot / --engine agentic instead.`,
  ].join(' ')
}

interface ClaudeCodeJson {
  usage?: { input_tokens?: number; output_tokens?: number }
  total_cost_usd?: number
  num_turns?: number
}

// -- worktree diff → FileChange[] (decisión d: diff completo, sin filtrar) ------

function parseGitStatusPorcelain(stdout: string): string[] {
  if (!stdout) return []
  // stdout SIN trim global (ver gitStatusRawStdout) — cada línea conserva su
  // ancho de columna fijo "XY path", donde X/Y pueden ser un espacio literal
  // (ej. " M path" = modificado sin stage).
  return stdout.replace(/\n+$/, '').split('\n').filter(Boolean).map(line => {
    // formato: "XY path" o "XY old -> new" para renames — nos quedamos con el path final
    const rest = line.slice(3)
    const arrow = rest.indexOf(' -> ')
    return arrow >= 0 ? rest.slice(arrow + 4) : rest
  })
}

/**
 * Hallazgo real en vivo (D.1, 2026-07-05): el `git()` compartido de
 * sandbox.ts hace `.trim()` sobre TODO el stdout — eso se come el espacio
 * inicial de la PRIMERA línea cuando esa línea es una modificación sin stage
 * (" M path" → "M path"), corrompiendo el offset fijo `slice(3)` de arriba:
 * "M src/foo.ts" queda "rc/foo.ts" tras el slice, un path que no existe →
 * `existsSync` lo descarta silenciosamente. El gate D.1 corrió con dinero
 * real dos veces y Claude Code editó exactamente lo pedido las dos veces —
 * pero `readWorktreeDiff` reportaba `files: []` igual, disparando "missing
 * declared output" en el harness. `sandbox-policy.ts` no lo sufre porque solo
 * usa el flag para un mensaje de warning (cosmético); acá el offset fijo lo
 * convierte en un bug de correctitud real. Fix: spawn directo sin el trim
 * global, solo recortando el/los newline(s) finales.
 */
function gitStatusRawStdout(cwd: string): string {
  const proc = Bun.spawnSync(['git', 'status', '--porcelain', '-uall'], { cwd })
  return proc.stdout.toString()
}

function readWorktreeDiff(effectiveRoot: string): { path: string; content: string }[] {
  // B.4 — `-uall` (--untracked-files=all): sin este flag, git status --porcelain colapsa
  // un directorio untracked con contenido en una sola entrada `?? sub/`, ignorando los
  // archivos internos. Eso rompería la decisión d de B.1 ("diff completo, sin filtrar")
  // para el caso realista de Claude Code creando sub/inner.txt. Con -uall git emite
  // entradas individuales para cada archivo Y para el dir, y el isFile() de abajo filtra
  // el dir sin perder los archivos.
  const paths = parseGitStatusPorcelain(gitStatusRawStdout(effectiveRoot))
  const files: { path: string; content: string }[] = []
  for (const p of paths) {
    const normalized = normalizeRelPath(p)
    const full = join(effectiveRoot, normalized)
    if (!existsSync(full)) continue // archivo borrado por el proceso externo — nada que reportar como FileChange
    // B.4 — git reporta el directorio untracked (con -uall) como una entrada mas;
    // readFileSync sobre un directorio tira EISDIR. isFile() lo descarta. Si en el
    // futuro hace falta descender, cambiar a readdirSync(full, { recursive: true, withFileTypes: true }).
    if (!statSync(full).isFile()) continue
    files.push({ path: normalized, content: readFileSync(full, 'utf-8') })
  }
  return files
}

// -- prompt (decisión a: contrato vía prompt explícito, no el único control) ----

function buildSystemPrompt(ctx: Parameters<ExecutorEngine['run']>[0]): string {
  return [
    ctx.effectiveContext,
    ctx.constitutionBlock,
    ctx.skillInstructions,
    ctx.instinctBlock,
    `## OUTPUT CONTRACT`,
    `You may ONLY create or edit these files: ${ctx.task.output.join(', ')}.`,
    `Do not touch any other file in this repository. When you are done, stop — do not run git commands yourself.`,
  ].filter(Boolean).join('\n\n')
}

// -- subprocess ------------------------------------------------------------------

/**
 * Construye la línea de comandos que se le pasa a `claude -p`. Centralizado
 * para que runClaudeCode() (el spawn real) y costByIteration[0].args (la
 * "info de proceso" que C.1 muestra en el detalle del run) reporten los
 * MISMOS args — una sola fuente de verdad. El system prompt se reemplaza
 * por el placeholder `<contract>` en la copia persistida: el prompt real
 * puede tener miles de chars (contrato + skills + instincts + context) y
 * no aporta a "info de proceso" — el usuario quiere ver la forma del comando,
 * no su contenido.
 */
/**
 * E.15 (Mes 22, 2026-07-17) — bug real reportado por Carlos: `ctx.model` ya
 * se resolvía (executor_model / config role) y hasta se guardaba en el
 * registro de costo (`costByIteration[0].model` más abajo), pero nunca se
 * pasaba al subproceso real — `claude -p` corría siempre con el modelo por
 * defecto del binario, ignorando en silencio cualquier elección explícita
 * del usuario. Mismo problema con el nivel de esfuerzo: el CLI real soporta
 * `--effort low|medium|high|xhigh|max` (verificado con `claude --help`) y
 * OrchestOS nunca lo exponía. `orchestosModelToCliModel()` solo traduce el
 * prefijo `provider/` de nuestros ids estilo OpenRouter (`anthropic/claude-
 * sonnet-5`) al nombre que el CLI espera (`claude-sonnet-5`) — si el modelo
 * configurado no es de Anthropic, se omite `--model` a propósito: el CLI
 * solo sirve modelos de Anthropic, y forzar un id ajeno fallaría con un
 * error del propio binario en vez de un mal comportamiento silencioso.
 */
export function orchestosModelToCliModel(model: string | undefined): string | undefined {
  if (!model || !model.startsWith('anthropic/')) return undefined
  return model.slice('anthropic/'.length)
}

function buildClaudeArgs(systemPrompt: string, model?: string, effort?: string): string[] {
  const args = [
    '-p',
    '--output-format', 'json',
    '--append-system-prompt', systemPrompt,
    '--allowedTools', 'Edit,Write,Read,Glob,Grep',
  ]
  const cliModel = orchestosModelToCliModel(model)
  if (cliModel) args.push('--model', cliModel)
  if (effort) args.push('--effort', effort)
  return args
}

function buildClaudeArgsDisplay(model?: string, effort?: string): string[] {
  const args = [
    '-p',
    '--output-format', 'json',
    '--append-system-prompt', '<contract>',
    '--allowedTools', 'Edit,Write,Read,Glob,Grep',
  ]
  const cliModel = orchestosModelToCliModel(model)
  if (cliModel) args.push('--model', cliModel)
  if (effort) args.push('--effort', effort)
  return args
}

async function runClaudeCode(
  cwd: string,
  systemPrompt: string,
  userPrompt: string,
  timeoutMs: number,
  model: string | undefined,
  effort: string | undefined,
): Promise<{ stdout: string; timedOut: boolean }> {
  const proc = Bun.spawn(
    [CLAUDE_BINARY, ...buildClaudeArgs(systemPrompt, model, effort)],
    { cwd, stdin: 'pipe', stdout: 'pipe', stderr: 'pipe' },
  )
  proc.stdin.write(userPrompt)
  proc.stdin.end()

  let timedOut = false
  const timer = setTimeout(() => { timedOut = true; proc.kill('SIGTERM') }, timeoutMs)

  const stdout = await new Response(proc.stdout).text()
  await proc.exited
  clearTimeout(timer)

  return { stdout, timedOut }
}

// -- engine ------------------------------------------------------------------------

export const externalEngine: ExecutorEngine = {
  async run(ctx, opts) {
    // C.2 — detección honesta ANTES del worktree setup y del spawn. Si el
    // binario no está, fallar con mensaje accionable ("install Claude Code
    // or use --engine single-shot/agentic") en vez del críptico
    // "spawn claude ENOENT" que escupiría `Bun.spawn` por debajo. Este check
    // es independiente del worktree guard de abajo: un binario ausente no
    // merece siquiera crear el worktree.
    if (!findClaudeBinary()) {
      throw new ExecutorExternalError(claudeUnavailableMessage(process.env.PATH))
    }

    // Requisito nuevo de §5 del diseño: los otros dos engines nunca tocan
    // disco antes de que el harness decida (buffer en memoria), así que
    // toleran modo 'cwd'. El externo escribe directo al filesystem mientras
    // corre — sin worktree desechable, un proceso que no controlamos
    // editaría el repo real sin red de seguridad.
    if (!ctx.worktree) {
      throw new ExecutorExternalError(
        'external engine requires worktree sandbox mode — refusing to run an uncontrolled external process against the real project directory',
      )
    }

    const systemPrompt = buildSystemPrompt(ctx)
    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS

    let stdout: string
    let timedOut: boolean
    try {
      ({ stdout, timedOut } = await runClaudeCode(ctx.effectiveRoot, systemPrompt, ctx.prompt.userContent, timeoutMs, ctx.model, ctx.task.cli_effort))
    } catch (e: any) {
      throw new ExecutorExternalError(`failed to spawn claude code: ${e.message}`)
    }

    // Decisión b: costo desconocido explícito, nunca $0 silencioso (F0.8).
    // Se intenta parsear el JSON aunque haya habido timeout — si `claude`
    // alcanzó a flushear una respuesta final antes de morir, se usa; si no,
    // se lanza en vez de inventar un costo.
    let parsed: ClaudeCodeJson
    try {
      parsed = JSON.parse(stdout)
    } catch {
      throw new ExecutorExternalError(
        timedOut
          ? `claude code timed out after ${timeoutMs}ms with no parseable output — cost unknown, not reported as $0`
          : `claude code produced no parseable JSON output — cost unknown, not reported as $0`,
      )
    }

    if (typeof parsed.total_cost_usd !== 'number') {
      throw new ExecutorExternalError('claude code JSON output is missing total_cost_usd — refusing to report cost as $0')
    }

    const inputTokens = parsed.usage?.input_tokens ?? 0
    const outputTokens = parsed.usage?.output_tokens ?? 0
    const iterations = parsed.num_turns ?? 1
    const usd = parsed.total_cost_usd

    const files = readWorktreeDiff(ctx.effectiveRoot)

    const outcome: ExecutorOutcome = {
      files,
      inputTokens,
      outputTokens,
      usd,
      iterations,
      // Una sola entrada agregada — Claude Code headless no expone costo por
      // turno individual en --output-format json (mismo argumento honesto
      // que agentic.ts: N entradas falsas es peor que 1 entrada real).
      costByIteration: [{
        label: `external (claude-code, ${iterations} turn${iterations === 1 ? '' : 's'})`,
        model: ctx.model,
        inputTokens,
        outputTokens,
        costUsd: usd,
        // C.1 — "info de proceso" para el detalle del run. Se persiste el binario
        // y los args SIN el system prompt completo (placeholder `<contract>`)
        // para no inflar la DB. La UI muestra la línea de comandos reconstruida
        // a partir de estos campos — ver screens-ops.js detail().
        binary: CLAUDE_BINARY,
        args: buildClaudeArgsDisplay(ctx.model, ctx.task.cli_effort),
      }],
      log: [`claude code: ${files.length} file(s) changed in worktree${timedOut ? ' (killed by timeout, partial output parsed)' : ''}`],
    }

    return outcome
  },
}
