/**
 * src/run/executors/opencode.ts — G.5
 *
 * Segundo executor "external": delega la tarea completa a `opencode run`
 * (headless, batch) corriendo dentro del worktree del sandbox — mismo
 * contrato `ExecutorEngine` que external.ts (`claude -p`), mismo mecanismo
 * de lectura de diff (`readWorktreeDiff`, extraído a worktree-diff.ts en
 * este bloque para no duplicarlo entre los dos).
 *
 * Contrato real verificado en vivo (2026-07-20, `opencode --help` /
 * `opencode run --help` / probes reales con `--format json`):
 *   - `opencode run "<message>" --format json --auto` — sin esto último,
 *     opencode pide confirmación interactiva por cada tool call (escribir
 *     archivo, correr comando) y el proceso headless se cuelga esperando
 *     stdin que nunca llega. `--auto` es equivalente a lo que `--allowedTools`
 *     hace para `claude -p` en external.ts: el contrato de OUTPUT en el
 *     prompt sigue siendo la única frontera real (enforceContract() en el
 *     harness), no este flag.
 *   - Sin flag de "system prompt" separado (a diferencia de
 *     `--append-system-prompt` de claude) — todo el contrato + contexto +
 *     skill + user content va en el único argumento `message`.
 *   - `--format json` emite NDJSON incremental, no un solo blob: eventos
 *     `step_start` / `tool_use` / `text` / `step_finish`. El costo y los
 *     tokens NO vienen en un campo final único — cada `step_finish` trae su
 *     propio `part.cost` y `part.tokens`; hay que sumarlos.
 *   - `-m provider/model`: el namespace de opencode NO coincide con el de
 *     OrchestOS (`opencode/deepseek-v4-flash-free`,
 *     `openrouter/anthropic/claude-sonnet-5` — tres partes para lo que pasa
 *     por OpenRouter, dos para los modelos free propios). Pasar el id de
 *     OrchestOS tal cual sería tan silenciosamente incorrecto como no
 *     traducirlo — mismo criterio que `orchestosModelToCliModel()` en
 *     external.ts: mejor omitir `--model` (opencode usa su default
 *     configurado) que adivinar mal. La tabla de traducción real es trabajo
 *     de G.4 (ahí es donde el catálogo de `opencode models` se carga de
 *     verdad).
 */

import type { ExecutorEngine, ExecutorOutcome } from './types.ts'
import { readWorktreeDiff } from './worktree-diff.ts'

export class ExecutorOpencodeError extends Error {}

const DEFAULT_TIMEOUT_MS = 20 * 60 * 1000 // mismo default que external.ts
const OPENCODE_BINARY = 'opencode'

export function findOpencodeBinary(): string | null {
  return Bun.which(OPENCODE_BINARY)
}

export function opencodeUnavailableMessage(pathHint?: string): string {
  const where = pathHint ? ` (PATH searched: ${pathHint})` : ''
  return [
    `opencode binary "${OPENCODE_BINARY}" not found in PATH${where}.`,
    `Install opencode (https://opencode.ai) or use --engine single-shot / --engine agentic / --engine external instead.`,
  ].join(' ')
}

/**
 * G.5 — sin tabla de traducción real todavía (ver comentario de arriba del
 * archivo). Devuelve `undefined` a propósito para cualquier id: sería
 * "silent behavior" pasar un id de OrchestOS que no existe en el namespace
 * de opencode. Se retoma en G.4.
 */
export function orchestosModelToOpencodeModel(_model: string | undefined): string | undefined {
  return undefined
}

function buildOpencodePrompt(ctx: Parameters<ExecutorEngine['run']>[0]): string {
  return [
    ctx.effectiveContext,
    ctx.constitutionBlock,
    ctx.skillInstructions,
    ctx.instinctBlock,
    `## OUTPUT CONTRACT`,
    `You may ONLY create or edit these files: ${ctx.task.output.join(', ')}.`,
    `Do not touch any other file in this repository. When you are done, stop — do not run git commands yourself.`,
    ctx.prompt.userContent,
  ].filter(Boolean).join('\n\n')
}

function buildOpencodeArgs(prompt: string, model?: string, variant?: string): string[] {
  const args = ['run', prompt, '--format', 'json', '--auto']
  if (model) args.push('--model', model)
  if (variant) args.push('--variant', variant)
  return args
}

/** Mismo motivo que buildClaudeArgsDisplay en external.ts — placeholder en vez
 * del prompt real completo (puede tener miles de chars) para "info de proceso". */
function buildOpencodeArgsDisplay(model?: string, variant?: string): string[] {
  const args = ['run', '<contract>', '--format', 'json', '--auto']
  if (model) args.push('--model', model)
  if (variant) args.push('--variant', variant)
  return args
}

// -- NDJSON parsing --------------------------------------------------------

interface OpencodeStepFinishPart {
  type: 'step-finish'
  cost?: number
  tokens?: { input?: number; output?: number }
}

interface OpencodeEvent {
  type: string
  part?: { type?: string } & Partial<OpencodeStepFinishPart>
}

function parseOpencodeStream(stdout: string): { usd: number; inputTokens: number; outputTokens: number; steps: number } {
  let usd = 0
  let inputTokens = 0
  let outputTokens = 0
  let steps = 0
  let sawStepFinish = false
  for (const line of stdout.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    let evt: OpencodeEvent
    try {
      evt = JSON.parse(trimmed) as OpencodeEvent
    } catch {
      continue // línea parcial/ruido — no aborta el parseo del resto del stream
    }
    if (evt.part?.type === 'step-finish') {
      sawStepFinish = true
      steps++
      usd += evt.part.cost ?? 0
      inputTokens += evt.part.tokens?.input ?? 0
      outputTokens += evt.part.tokens?.output ?? 0
    }
  }
  if (!sawStepFinish) {
    throw new ExecutorOpencodeError('opencode produced no step-finish event — cost unknown, not reported as $0')
  }
  return { usd, inputTokens, outputTokens, steps }
}

// -- subprocess -------------------------------------------------------------

async function runOpencode(
  cwd: string,
  args: string[],
  timeoutMs: number,
): Promise<{ stdout: string; timedOut: boolean }> {
  const proc = Bun.spawn([OPENCODE_BINARY, ...args], { cwd, stdout: 'pipe', stderr: 'pipe' })

  let timedOut = false
  const timer = setTimeout(() => { timedOut = true; proc.kill('SIGTERM') }, timeoutMs)

  const stdout = await new Response(proc.stdout).text()
  await proc.exited
  clearTimeout(timer)

  return { stdout, timedOut }
}

// -- engine -------------------------------------------------------------------

export const opencodeEngine: ExecutorEngine = {
  async run(ctx, opts) {
    if (!findOpencodeBinary()) {
      throw new ExecutorOpencodeError(opencodeUnavailableMessage(process.env.PATH))
    }

    if (!ctx.worktree) {
      throw new ExecutorOpencodeError(
        'opencode engine requires worktree sandbox mode — refusing to run an uncontrolled external process against the real project directory',
      )
    }

    const prompt = buildOpencodePrompt(ctx)
    const model = orchestosModelToOpencodeModel(ctx.model)
    const variant = ctx.task.cli_effort
    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS

    let stdout: string
    let timedOut: boolean
    try {
      ({ stdout, timedOut } = await runOpencode(ctx.effectiveRoot, buildOpencodeArgs(prompt, model, variant), timeoutMs))
    } catch (e: any) {
      throw new ExecutorOpencodeError(`failed to spawn opencode: ${e.message}`)
    }

    let parsed: { usd: number; inputTokens: number; outputTokens: number; steps: number }
    try {
      parsed = parseOpencodeStream(stdout)
    } catch (e: any) {
      throw new ExecutorOpencodeError(
        timedOut
          ? `opencode timed out after ${timeoutMs}ms with no parseable output — cost unknown, not reported as $0`
          : e.message,
      )
    }

    const files = readWorktreeDiff(ctx.effectiveRoot)

    const outcome: ExecutorOutcome = {
      files,
      inputTokens: parsed.inputTokens,
      outputTokens: parsed.outputTokens,
      usd: parsed.usd,
      iterations: parsed.steps,
      costByIteration: [{
        label: `opencode (${parsed.steps} step${parsed.steps === 1 ? '' : 's'})`,
        model: ctx.model,
        inputTokens: parsed.inputTokens,
        outputTokens: parsed.outputTokens,
        costUsd: parsed.usd,
        binary: OPENCODE_BINARY,
        args: buildOpencodeArgsDisplay(model, variant),
      }],
      log: [`opencode: ${files.length} file(s) changed in worktree${timedOut ? ' (killed by timeout, partial output parsed)' : ''}`],
    }

    return outcome
  },
}
