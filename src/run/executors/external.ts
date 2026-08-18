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

import type { ExecutorEngine, ExecutorOutcome } from './types.ts'
import { readWorktreeDiff } from './worktree-diff.ts'
import { safeChildEnv } from '../path-policy.ts'
import { claudeEventToStep, type ExecutorStepEvent } from './step-event.ts'

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
  /** Hallazgo real de Carlos (2026-08-17): pedir `--model sonnet` (alias) muestra
   *  "Sonnet" en la UI sin decir a qué versión concreta resolvió — el CLI SÍ lo
   *  reporta acá, keyed por el nombre canónico real (ej. "claude-sonnet-5"). */
  modelUsage?: Record<string, { canonicalModel?: string }>
}

/** Nombre canónico real que el CLI resolvió (ej. "claude-sonnet-5"), leído de
 *  `modelUsage` — nunca inventado. `undefined` si el evento no lo trae. */
function resolvedCliModel(parsed: ClaudeCodeJson): string | undefined {
  const keys = parsed.modelUsage ? Object.keys(parsed.modelUsage) : []
  return keys[0]
}

// -- worktree diff → FileChange[] (decisión d: diff completo, sin filtrar) ------
// G.5 — extraído a worktree-diff.ts, reusado también por opencode.ts.

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

/**
 * G.3.1 — `--output-format json` (blob único al final) reemplazado por
 * `stream-json` + `--include-partial-messages`: NDJSON incremental, requiere
 * `--verbose` (el CLI lo exige junto con stream-json en modo --print).
 * Habilita leer línea por línea mientras el proceso corre en vez de esperar
 * a que termine — prerequisito de G.3.2 (normalización de eventos) y G.3.3
 * (persistencia/UI en vivo). El evento final `type: "result"` trae los
 * mismos campos (`total_cost_usd`/`usage`/`num_turns`) que antes traía el
 * blob de `--output-format json` — verificado en vivo 2026-07-27.
 */
function buildClaudeArgs(systemPrompt: string, model?: string, effort?: string): string[] {
  const args = [
    '-p',
    '--output-format', 'stream-json',
    '--include-partial-messages',
    '--verbose',
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
    '--output-format', 'stream-json',
    '--include-partial-messages',
    '--verbose',
    '--append-system-prompt', '<contract>',
    '--allowedTools', 'Edit,Write,Read,Glob,Grep',
  ]
  const cliModel = orchestosModelToCliModel(model)
  if (cliModel) args.push('--model', cliModel)
  if (effort) args.push('--effort', effort)
  return args
}

/**
 * G.3.1 — lee stdout incremental (chunk por chunk del reader, línea por
 * línea del buffer) en vez de `new Response(proc.stdout).text()` de una
 * sola vez. Trackea `resultLine` (última línea `type: "result"` vista) en
 * vez de esperar el blob completo — resiliente a líneas de ruido (hooks de
 * sesión, eventos parciales) intercaladas antes del resultado final, mismo
 * criterio de resiliencia que `parseOpencodeStream()` en opencode.ts.
 */
// CC.1 (Mes 29, 2026-08-16) — `args` ya armados por el caller en vez de reconstruirlos
// acá: el executor de tareas sigue usando `buildClaudeArgs` (Edit/Write habilitado,
// contrato de output[]); `runClaudeChat` (abajo) usa `buildClaudeChatArgs` (solo
// lectura, sin worktree) — mismo spawn/parseo de stream, permisos distintos.
async function runClaudeCode(
  cwd: string,
  args: string[],
  userPrompt: string,
  timeoutMs: number,
  onStep?: (event: ExecutorStepEvent) => void,
): Promise<{ stdout: string; timedOut: boolean; resultLine?: string }> {
  const proc = Bun.spawn(
    [CLAUDE_BINARY, ...args],
    { cwd, env: safeChildEnv(), stdin: 'pipe', stdout: 'pipe', stderr: 'pipe' },
  )
  proc.stdin.write(userPrompt)
  proc.stdin.end()

  let timedOut = false
  const timer = setTimeout(() => { timedOut = true; proc.kill('SIGTERM') }, timeoutMs)

  const reader = proc.stdout.getReader()
  const decoder = new TextDecoder()
  let stdout = ''
  let lineBuffer = ''
  let resultLine: string | undefined
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value, { stream: true })
      stdout += chunk
      lineBuffer += chunk
      let nl: number
      while ((nl = lineBuffer.indexOf('\n')) !== -1) {
        const line = lineBuffer.slice(0, nl).trim()
        lineBuffer = lineBuffer.slice(nl + 1)
        if (!line) continue
        try {
          const evt = JSON.parse(line)
          if (evt?.type === 'result') resultLine = line
          if (onStep) for (const step of claudeEventToStep(evt)) onStep(step)
        } catch {
          // línea parcial/corrupta — no aborta el resto del stream
        }
      }
    }
  } finally {
    reader.releaseLock()
  }

  await proc.exited
  clearTimeout(timer)

  return { stdout, timedOut, resultLine }
}

// -- chat (CC.1, Mes 29) ----------------------------------------------------------
//
// Reporte real de Carlos (2026-08-16): eligió "Claude" como agente en
// Settings y el chat siguió respondiendo por la API de OpenRouter — la config
// no cambiaba nada ahí. Verificado en código: `handlers/chat.ts` llamaba
// `runToolLoop('openrouter', ...)`/`openrouterChat(...)` sin mirar el agente
// en absoluto; ese campo solo se consultaba para la tarea que el chat
// auto-crea en segundo plano (D.7/E.16), nunca para la respuesta
// conversacional visible. (Campo renombrado de `executor_mode` a `agent` en
// CC.D1, 2026-08-17.)
//
// Deliberadamente SIN worktree y SIN Edit/Write: el chat no es una tarea con
// contrato de output[], es una conversación. El guard de seguridad de
// `externalEngine` ("nunca un proceso no controlado edita el repo real sin
// worktree desechable") se cumple acá por el lado de los permisos en vez del
// aislamiento de filesystem — sin Edit/Write en `--allowedTools`, el binario
// no puede escribir nada aunque corra contra el proyecto real.
//
// Hallazgo real de Carlos (2026-08-16, mismo día): la primera versión de esto
// no pasaba `model` ni `effort` al binario — corría siempre con el default del
// CLI y el label devuelto era genérico ("claude (cli default)"), sin decir qué
// modelo/esfuerzo se usó de verdad. `claude --help` confirma 5 niveles reales
// de esfuerzo (`low, medium, high, xhigh, max`) — el selector de 3 niveles del
// chat (pensado para el `reasoning` de OpenRouter) le queda chico a este CLI.
export const CLAUDE_CLI_EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const
export type ClaudeCliEffort = typeof CLAUDE_CLI_EFFORTS[number]

function buildClaudeChatArgs(systemPrompt: string, model?: string, effort?: string): string[] {
  const args = [
    '-p',
    '--output-format', 'stream-json',
    '--include-partial-messages',
    '--verbose',
    '--append-system-prompt', systemPrompt,
    '--allowedTools', 'Read,Glob,Grep',
  ]
  const cliModel = orchestosModelToCliModel(model)
  if (cliModel) args.push('--model', cliModel)
  if (effort) args.push('--effort', effort)
  return args
}

export interface ClaudeChatResult {
  text: string
  inputTokens: number
  outputTokens: number
  usd: number
  /** Modelo real que corrió — el que se resolvió al CLI, o el default del binario si no se fijó ninguno. */
  model: string
  /** Esfuerzo real pasado al CLI, o `undefined` si no se fijó (el binario usa su propio default). */
  effort?: string
}

/**
 * CC.1 — respuesta conversacional vía Claude Code CLI, para `agent: claude`.
 * `cwd` es el proyecto REAL (no un worktree): con `--allowedTools` limitado a
 * lectura, no hay nada que un proceso descontrolado pueda dañar.
 */
export async function runClaudeChat(
  cwd: string,
  systemPrompt: string,
  userMessage: string,
  timeoutMs: number,
  model?: string,
  effort?: string,
): Promise<ClaudeChatResult> {
  if (!findClaudeBinary()) {
    throw new ExecutorExternalError(claudeUnavailableMessage(process.env.PATH))
  }

  let text = ''
  const onStep = (step: ExecutorStepEvent) => {
    if (step.type === 'text' && step.detail) text += step.detail
  }

  let timedOut: boolean
  let resultLine: string | undefined
  try {
    ;({ timedOut, resultLine } = await runClaudeCode(cwd, buildClaudeChatArgs(systemPrompt, model, effort), userMessage, timeoutMs, onStep))
  } catch (e: any) {
    throw new ExecutorExternalError(`failed to spawn claude code: ${e.message}`)
  }

  if (!resultLine) {
    throw new ExecutorExternalError(
      timedOut
        ? `claude code timed out after ${timeoutMs}ms with no result event`
        : `claude code produced no result event`,
    )
  }
  let parsed: ClaudeCodeJson
  try {
    parsed = JSON.parse(resultLine)
  } catch {
    throw new ExecutorExternalError('claude code result event was not valid JSON')
  }

  return {
    text,
    inputTokens: parsed.usage?.input_tokens ?? 0,
    outputTokens: parsed.usage?.output_tokens ?? 0,
    usd: typeof parsed.total_cost_usd === 'number' ? parsed.total_cost_usd : 0,
    // Hallazgo real de Carlos: con un alias (`--model sonnet`) el pedido nunca
    // dice la versión real que corrió. `resolvedCliModel()` lee el nombre
    // canónico que el propio CLI reporta en `modelUsage` (ej. "claude-sonnet-5")
    // — si por lo que sea el evento no lo trae, cae al valor pedido, nunca a
    // un string inventado.
    model: resolvedCliModel(parsed) ?? (orchestosModelToCliModel(model) ? model! : 'claude (cli default model)'),
    effort,
  }
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

    let timedOut: boolean
    let resultLine: string | undefined
    try {
      ({ timedOut, resultLine } = await runClaudeCode(ctx.effectiveRoot, buildClaudeArgs(systemPrompt, ctx.model, ctx.task.cli_effort), ctx.prompt.userContent, timeoutMs, opts.onStep))
    } catch (e: any) {
      throw new ExecutorExternalError(`failed to spawn claude code: ${e.message}`)
    }

    // Decisión b: costo desconocido explícito, nunca $0 silencioso (F0.8).
    // G.3.1 — se busca el evento `type: "result"` visto durante el stream en
    // vez de parsear un blob único; si `claude` alcanzó a emitirlo antes de
    // morir por timeout, se usa igual — si no, se lanza en vez de inventar
    // un costo.
    let parsed: ClaudeCodeJson
    if (!resultLine) {
      throw new ExecutorExternalError(
        timedOut
          ? `claude code timed out after ${timeoutMs}ms with no result event — cost unknown, not reported as $0`
          : `claude code produced no result event — cost unknown, not reported as $0`,
      )
    }
    try {
      parsed = JSON.parse(resultLine)
    } catch {
      throw new ExecutorExternalError('claude code result event was not valid JSON — cost unknown, not reported as $0')
    }

    if (typeof parsed.total_cost_usd !== 'number') {
      throw new ExecutorExternalError('claude code JSON output is missing total_cost_usd — refusing to report cost as $0')
    }

    const inputTokens = parsed.usage?.input_tokens ?? 0
    const outputTokens = parsed.usage?.output_tokens ?? 0
    const iterations = parsed.num_turns ?? 1
    const usd = parsed.total_cost_usd

    const files = readWorktreeDiff(ctx.effectiveRoot, ctx.task.output)

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
