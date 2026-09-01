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
 *     OrchestOS. Los ids OpenRouter verificados en models.dev se traducen a
 *     `openrouter/<provider>/<model>`; ids ausentes en ese catálogo omiten
 *     `--model` en vez de fingir soporte.
 */

import { getOpencodeCatalog } from '../../router/opencode-catalog.ts'
import { safeChildEnv } from '../path-policy.ts'
import { type ExecutorStepEvent, opencodeEventToStep } from './step-event.ts'
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

/** Traduce un id OrchestOS solo si models.dev confirma su namespace OpenRouter. */
export function orchestosModelToOpencodeModel(model: string | undefined): string | undefined {
  if (!model) return undefined
  const catalog = getOpencodeCatalog()
  if (!catalog?.has(model)) return undefined
  return 'openrouter/' + model
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
  ]
    .filter(Boolean)
    .join('\n\n')
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

function parseOpencodeStream(stdout: string): {
  usd: number
  inputTokens: number
  outputTokens: number
  steps: number
} {
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
    throw new ExecutorOpencodeError(
      'opencode produced no step-finish event — cost unknown, not reported as $0',
    )
  }
  return { usd, inputTokens, outputTokens, steps }
}

// -- subprocess -------------------------------------------------------------

/**
 * G.3.1 — lee stdout incremental (chunk por chunk del reader, línea por
 * línea del buffer) en vez de `new Response(proc.stdout).text()` de una
 * sola vez. `parseOpencodeStream()` sigue operando sobre el `stdout`
 * acumulado — sin cambio de comportamiento, solo de cómo se lee mientras
 * el proceso corre. G.3.3 — cada línea completa se traduce con
 * `opencodeEventToStep()` y se emite vía `onStep`, mismo criterio que
 * external.ts.
 */
async function runOpencode(
  cwd: string,
  args: string[],
  timeoutMs: number,
  onStep?: (event: ExecutorStepEvent) => void,
): Promise<{ stdout: string; timedOut: boolean }> {
  const proc = Bun.spawn([OPENCODE_BINARY, ...args], {
    cwd,
    env: safeChildEnv(),
    stdout: 'pipe',
    stderr: 'pipe',
  })

  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    proc.kill('SIGTERM')
  }, timeoutMs)

  const reader = proc.stdout.getReader()
  const decoder = new TextDecoder()
  let stdout = ''
  let lineBuffer = ''
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
        if (!line || !onStep) continue
        try {
          const evt = JSON.parse(line)
          for (const step of opencodeEventToStep(evt)) onStep(step)
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

  return { stdout, timedOut }
}

// -- chat (CC.1-D1, 2026-08-19) -----------------------------------------------
//
// Mismo motivo que `runCodexChat` en codex.ts: CC.1 bloqueaba `agent:
// opencode` en el chat entero por no tener, en ese momento, un control de
// solo-lectura verificado. Sí existe: `opencode agent list` muestra un
// agente built-in `plan` cuya policy tiene `{permission:"edit", pattern:"*",
// action:"deny"}` — un permiso real del propio binario, no un texto en el
// prompt. `--agent plan` en vez de `--auto` (que el comentario de arriba ya
// marca como "dangerous": auto-aprueba TODO lo no denegado explícitamente,
// lo opuesto de lo que quiere el chat).
export interface OpencodeChatResult {
  text: string
  inputTokens: number
  outputTokens: number
  usd: number
  model: string
}

function buildOpencodeChatArgs(message: string, model?: string): string[] {
  const args = ['run', message, '--format', 'json', '--agent', 'plan']
  if (model) args.push('--model', model)
  return args
}

export async function runOpencodeChat(
  cwd: string,
  systemPrompt: string,
  userMessage: string,
  timeoutMs: number,
  model?: string,
): Promise<OpencodeChatResult> {
  if (!findOpencodeBinary()) {
    throw new ExecutorOpencodeError(opencodeUnavailableMessage(process.env.PATH))
  }

  const opencodeModel = orchestosModelToOpencodeModel(model)
  const message = [systemPrompt, userMessage].filter(Boolean).join('\n\n')

  let text = ''
  const onStep = (step: ExecutorStepEvent) => {
    if (step.type === 'text' && step.detail) text += step.detail
  }

  let stdout: string
  let timedOut: boolean
  try {
    ;({ stdout, timedOut } = await runOpencode(
      cwd,
      buildOpencodeChatArgs(message, opencodeModel),
      timeoutMs,
      onStep,
    ))
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

  return {
    text,
    inputTokens: parsed.inputTokens,
    outputTokens: parsed.outputTokens,
    usd: parsed.usd,
    model: opencodeModel ?? 'opencode (cli default model)',
  }
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
      ;({ stdout, timedOut } = await runOpencode(
        ctx.effectiveRoot,
        buildOpencodeArgs(prompt, model, variant),
        timeoutMs,
        opts.onStep,
      ))
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

    const files = readWorktreeDiff(ctx.effectiveRoot, ctx.task.output)

    const outcome: ExecutorOutcome = {
      files,
      inputTokens: parsed.inputTokens,
      outputTokens: parsed.outputTokens,
      usd: parsed.usd,
      iterations: parsed.steps,
      costByIteration: [
        {
          label: `opencode (${parsed.steps} step${parsed.steps === 1 ? '' : 's'})`,
          model: ctx.model,
          inputTokens: parsed.inputTokens,
          outputTokens: parsed.outputTokens,
          costUsd: parsed.usd,
          binary: OPENCODE_BINARY,
          args: buildOpencodeArgsDisplay(model, variant),
        },
      ],
      log: [
        `opencode: ${files.length} file(s) changed in worktree${timedOut ? ' (killed by timeout, partial output parsed)' : ''}`,
      ],
    }

    return outcome
  },
}
