/**
 * src/run/executors/codex.ts — G.4.2b
 *
 * Tercer executor de CLI (junto a external.ts/claude y opencode.ts), mismo
 * contrato `ExecutorEngine`. Contrato real verificado en vivo (2026-07-27,
 * `codex exec --help` + probe real contra un git repo temporal):
 *   - `codex exec "<prompt>" --json --sandbox workspace-write --color never`
 *     — headless por diseño ("Run Codex non-interactively"), sin flag
 *     equivalente a `--auto`/`--allowedTools`: `--sandbox workspace-write`
 *     alcanza para que escriba archivos sin pedir confirmación interactiva.
 *   - Sin flag de system-prompt separado (igual que opencode) — contrato +
 *     contexto + skill + user content van en el único argumento `prompt`.
 *   - `--json` emite JSONL: `thread.started`, `turn.started`,
 *     `item.started`/`item.completed` (item.type: `agent_message`,
 *     `command_execution`, `file_change`, `error`), `turn.completed` con
 *     `usage: {input_tokens, cached_input_tokens, cache_write_input_tokens,
 *     output_tokens, reasoning_output_tokens}`.
 *   - **Sin costo en USD en el evento** (a diferencia de claude/opencode) —
 *     se computa con `calcCost()` sobre el catálogo real, y SOLO si el
 *     modelo corrido está en catálogo (`getCatalog()?.has(model)`); si no,
 *     se lanza en vez de reportar $0 silencioso (F0.8, mismo criterio que
 *     los otros dos executors).
 *   - `-m <model>`: Codex usa naming nativo de OpenAI (`gpt-5.4`), NO el id
 *     estilo OpenRouter de OrchestOS (`openai/gpt-5.4`) — mismo criterio que
 *     `orchestosModelToCliModel()`.
 *   - **BB.6 (2026-08-18)**: si el modelo configurado NO es `openai/*`, ya no
 *     se corre con el default de Codex — se lanza antes del spawn. Ver
 *     `codexCostUnmeasurableMessage()` para el porqué completo. El comentario
 *     anterior afirmaba que el default era `gpt-5.4` "confirmado en
 *     `~/.codex/config.toml`"; al verificarlo ese archivo declaraba
 *     `gpt-5.6-luna` — el dato se desactualizó solo, que es exactamente por qué
 *     no se puede tarifar contra un default que OrchestOS no controla.
 */

import { getCatalog } from '../../router/model-catalog.ts'
import { calcCost } from '../../router/pricing.ts'
import { safeChildEnv } from '../path-policy.ts'
import { codexEventToStep, type ExecutorStepEvent } from './step-event.ts'
import type { ExecutorEngine, ExecutorOutcome } from './types.ts'
import { readWorktreeDiff } from './worktree-diff.ts'

export class ExecutorCodexError extends Error {}

const DEFAULT_TIMEOUT_MS = 20 * 60 * 1000 // mismo default que external.ts/opencode.ts
const CODEX_BINARY = 'codex'

export function findCodexBinary(): string | null {
  return Bun.which(CODEX_BINARY)
}

export function codexUnavailableMessage(pathHint?: string): string {
  const where = pathHint ? ` (PATH searched: ${pathHint})` : ''
  return [
    `codex binary "${CODEX_BINARY}" not found in PATH${where}.`,
    `Install Codex (https://github.com/openai/codex) or use --engine single-shot / --engine agentic / --engine external / --engine opencode instead.`,
  ].join(' ')
}

export function orchestosModelToCodexModel(model: string | undefined): string | undefined {
  if (!model || !model.startsWith('openai/')) return undefined
  return model.slice('openai/'.length)
}

/**
 * BB.6 (2026-08-18) — guard de costo medible, ANTES de gastar tokens.
 *
 * El costo de codex se computa con `calcCost(ctx.model, …)` porque el binario
 * no reporta USD. Eso solo es válido si `ctx.model` es **el modelo que codex
 * realmente corrió**, y eso pasa únicamente cuando le pasamos `-m`.
 *
 * Si `ctx.model` no es un id `openai/*`, `orchestosModelToCodexModel()` devuelve
 * `undefined`, se omite `-m`, y **codex corre con su propio default** — que es
 * un valor que OrchestOS no controla ni puede leer del stream. Verificado contra
 * el binario real (2026-08-18): ningún evento de `codex exec --json`
 * (`thread.started` / `turn.started` / `item.completed` / `turn.completed`)
 * expone el modelo; `turn.completed` solo trae `usage`. Tampoco sirve leer
 * `~/.codex/config.toml`: en esta máquina declara `gpt-5.6-luna`, mientras el
 * comentario de este archivo afirmaba `gpt-5.4` — el dato se desactualizó solo.
 *
 * Sin esto, tarifar tokens de un modelo con el precio de otro produce un número
 * con apariencia de real: el `$0.00924` de BB.4 eran tokens del default de codex
 * cobrados a precio de `deepseek-v4-flash`. Mismo criterio que F0.8 y que
 * opencode/external: costo desconocido se declara, no se fabrica.
 */
export function codexCostUnmeasurableMessage(orchestosModel: string | undefined): string {
  return [
    `codex would run with its own default model because OrchestOS model "${orchestosModel ?? '(none)'}" is not an "openai/*" id, so -m was omitted.`,
    `The real model is unknowable (codex does not report it in --json), so its cost cannot be measured and OrchestOS refuses to fabricate one.`,
    `Set an "openai/*" model that exists in the pricing catalog, or run this task with --engine external / --engine opencode instead.`,
  ].join(' ')
}

function buildCodexPrompt(ctx: Parameters<ExecutorEngine['run']>[0]): string {
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

function buildCodexArgs(prompt: string, model?: string): string[] {
  const args = ['exec', prompt, '--json', '--sandbox', 'workspace-write', '--color', 'never']
  if (model) args.push('-m', model)
  return args
}

function buildCodexArgsDisplay(model?: string): string[] {
  const args = ['exec', '<contract>', '--json', '--sandbox', 'workspace-write', '--color', 'never']
  if (model) args.push('-m', model)
  return args
}

// -- subprocess ---------------------------------------------------------------

async function runCodex(
  cwd: string,
  args: string[],
  timeoutMs: number,
  onStep?: (event: ExecutorStepEvent) => void,
): Promise<{ stdout: string; timedOut: boolean }> {
  const proc = Bun.spawn([CODEX_BINARY, ...args], {
    cwd,
    env: safeChildEnv(),
    stdin: 'ignore',
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
          for (const step of codexEventToStep(evt)) onStep(step)
        } catch {
          // línea parcial/corrupta o log no-JSON (ej. warnings de rmcp) — no aborta el stream
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

// -- JSONL parsing --------------------------------------------------------------

interface CodexTurnCompleted {
  type: 'turn.completed'
  usage?: { input_tokens?: number; output_tokens?: number }
}

function parseCodexStream(stdout: string): { inputTokens: number; outputTokens: number } {
  let last: CodexTurnCompleted | undefined
  for (const line of stdout.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    try {
      const evt = JSON.parse(trimmed)
      if (evt?.type === 'turn.completed') last = evt
    } catch {}
  }
  if (!last) {
    throw new ExecutorCodexError(
      'codex produced no turn.completed event — cost unknown, not reported as $0',
    )
  }
  return {
    inputTokens: last.usage?.input_tokens ?? 0,
    outputTokens: last.usage?.output_tokens ?? 0,
  }
}

// -- chat (CC.1-D1, 2026-08-19) -----------------------------------------------
//
// CC.1 (2026-08-16) bloqueaba `agent: codex` en el chat entero con un 422
// ("no verified read-only transport") — decisión de implementación, no un
// límite pedido por Carlos: en ese momento nadie había verificado si el
// binario tenía un flag real de solo-lectura equivalente a
// `--allowedTools Read,Glob,Grep` de Claude. Sí lo tiene: `codex exec --help`
// confirma `--sandbox <read-only|workspace-write|danger-full-access>`. Mismo
// criterio que `runClaudeChat` en external.ts: `--sandbox read-only` es la
// frontera real (el binario no puede escribir aunque corra contra el
// proyecto real), no un texto en el prompt pidiéndoselo por favor.
export interface CodexChatResult {
  text: string
  inputTokens: number
  outputTokens: number
  usd: number
  model: string
}

function buildCodexChatArgs(prompt: string, model?: string): string[] {
  const args = ['exec', prompt, '--json', '--sandbox', 'read-only', '--color', 'never']
  if (model) args.push('-m', model)
  return args
}

export async function runCodexChat(
  cwd: string,
  systemPrompt: string,
  userMessage: string,
  timeoutMs: number,
  model?: string,
): Promise<CodexChatResult> {
  if (!findCodexBinary()) {
    throw new ExecutorCodexError(codexUnavailableMessage(process.env.PATH))
  }

  const codexModel = orchestosModelToCodexModel(model)
  const prompt = [systemPrompt, userMessage].filter(Boolean).join('\n\n')

  let text = ''
  const onStep = (step: ExecutorStepEvent) => {
    if (step.type === 'text' && step.detail) text += step.detail
  }

  let stdout: string
  let timedOut: boolean
  try {
    ;({ stdout, timedOut } = await runCodex(
      cwd,
      buildCodexChatArgs(prompt, codexModel),
      timeoutMs,
      onStep,
    ))
  } catch (e: any) {
    throw new ExecutorCodexError(`failed to spawn codex: ${e.message}`)
  }

  let parsed: { inputTokens: number; outputTokens: number }
  try {
    parsed = parseCodexStream(stdout)
  } catch (e: any) {
    throw new ExecutorCodexError(
      timedOut
        ? `codex timed out after ${timeoutMs}ms with no parseable output — cost unknown, not reported as $0`
        : e.message,
    )
  }

  // F0.8 — mismo criterio que el engine de tareas: costo desconocido explícito
  // (no $0 fabricado) cuando el modelo corrido no está en el catálogo real.
  // A diferencia del engine de tareas, el chat NO aborta antes de gastar
  // tokens si el modelo no es `openai/*` — es interactivo, el usuario está
  // esperando una respuesta; codex corre con su propio default y el costo
  // queda en 0 con el modelo etiquetado como "cli default", igual que
  // `runClaudeChat` hace cuando el modelo pedido no es de Anthropic.
  const usd =
    model && getCatalog()?.has(model) ? calcCost(model, parsed.inputTokens, parsed.outputTokens) : 0

  return {
    text,
    inputTokens: parsed.inputTokens,
    outputTokens: parsed.outputTokens,
    usd,
    model: codexModel ? model! : 'codex (cli default model)',
  }
}

// -- engine ---------------------------------------------------------------------

export const codexEngine: ExecutorEngine = {
  async run(ctx, opts) {
    if (!findCodexBinary()) {
      throw new ExecutorCodexError(codexUnavailableMessage(process.env.PATH))
    }

    if (!ctx.worktree) {
      throw new ExecutorCodexError(
        'codex engine requires worktree sandbox mode — refusing to run an uncontrolled external process against the real project directory',
      )
    }

    const prompt = buildCodexPrompt(ctx)
    const codexModel = orchestosModelToCodexModel(ctx.model)

    // BB.6 — se valida ANTES del spawn, no después: si el costo no va a poder
    // medirse, fallar acá evita gastar tokens y tiempo en un run cuya evidencia
    // económica iba a ser falsa de todos modos. Ver codexCostUnmeasurableMessage().
    if (!codexModel) {
      throw new ExecutorCodexError(codexCostUnmeasurableMessage(ctx.model))
    }

    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS

    let stdout: string
    let timedOut: boolean
    try {
      ;({ stdout, timedOut } = await runCodex(
        ctx.effectiveRoot,
        buildCodexArgs(prompt, codexModel),
        timeoutMs,
        opts.onStep,
      ))
    } catch (e: any) {
      throw new ExecutorCodexError(`failed to spawn codex: ${e.message}`)
    }

    let parsed: { inputTokens: number; outputTokens: number }
    try {
      parsed = parseCodexStream(stdout)
    } catch (e: any) {
      throw new ExecutorCodexError(
        timedOut
          ? `codex timed out after ${timeoutMs}ms with no parseable output — cost unknown, not reported as $0`
          : e.message,
      )
    }

    // F0.8 — costo desconocido explícito, nunca $0 silencioso: codex no
    // expone total_cost_usd (a diferencia de claude/opencode), así que solo
    // se computa si el modelo corrido está en el catálogo real.
    if (!ctx.model || !getCatalog()?.has(ctx.model)) {
      throw new ExecutorCodexError(
        `codex ran with model "${ctx.model ?? '(codex default)'}" which is not in the pricing catalog — cost unknown, not reported as $0`,
      )
    }
    const usd = calcCost(ctx.model, parsed.inputTokens, parsed.outputTokens)

    const files = readWorktreeDiff(ctx.effectiveRoot, ctx.task.output)

    const outcome: ExecutorOutcome = {
      files,
      inputTokens: parsed.inputTokens,
      outputTokens: parsed.outputTokens,
      usd,
      iterations: 1, // codex exec no expone conteo de turnos internos en --json
      costByIteration: [
        {
          label: 'codex (exec)',
          model: ctx.model,
          inputTokens: parsed.inputTokens,
          outputTokens: parsed.outputTokens,
          costUsd: usd,
          binary: CODEX_BINARY,
          args: buildCodexArgsDisplay(codexModel),
        },
      ],
      log: [
        `codex: ${files.length} file(s) changed in worktree${timedOut ? ' (killed by timeout, partial output parsed)' : ''}`,
      ],
    }

    return outcome
  },
}
