import type { CliNotice } from './cli-failure.ts'
import { claudeFailureKind, cliFailureNotice } from './cli-failure.ts'

/**
 * src/run/executors/step-event.ts — G.3.2
 *
 * Evento normalizado al que se traducen las líneas NDJSON de `claude` y
 * `opencode` — prerequisito de G.3.3 (persistencia + cards en vivo del chat).
 * Cada traductor recibe UNA línea ya parseada (JSON.parse de un renglón del
 * stream) y devuelve 0, 1 o más `ExecutorStepEvent` — un mensaje de `claude`
 * puede traer varios content blocks (texto + tool_use) en una sola línea.
 *
 * Shapes verificados en vivo 2026-07-27 (no asumidos):
 *  - claude: `claude -p --output-format stream-json --include-partial-messages
 *    --verbose` — evento `assistant` con `message.content[]` (blocks
 *    `{type:'text',text}` / `{type:'tool_use',id,name,input}`, mismo shape
 *    que ya usa `tool-call.ts` para la Messages API). Solo se mapean mensajes
 *    completos, no los deltas de `stream_event` (--include-partial-messages
 *    los habilita y `stream_event` incluye deltas de texto; `thinking_delta`
 *    llega vacío en la forma verificada y se ignora.
 *  - opencode: `opencode run ... --format json --auto` — `evt.type` en
 *    `'tool_use' | 'text' | 'step_finish' | 'step_start'`, con detalle en
 *    `evt.part`. `tool_use`: `part.tool` (nombre) + `part.state.title`.
 *    `text`: `part.text`. `step_finish`: `part.cost` + `part.tokens.{input,output}`.
 *    `step_start` no aporta info mapeable — se ignora.
 */

export interface ExecutorStepEvent {
  type: 'tool_use' | 'text' | 'step_finish' | 'reasoning' | 'notice'
  label: string
  notice?: CliNotice
  detail?: string
  target?: string
  added?: number
  removed?: number
  ok?: boolean
  exitCode?: number
  output?: string
  durationMs?: number
  toolUseId?: string
  costUsd?: number
  tokens?: { input?: number; output?: number }
}

export function claudeEventToTextDelta(raw: unknown): string | null {
  const evt = raw as {
    type?: string
    event?: { type?: string; delta?: { type?: string; text?: string } }
  }
  if (
    evt?.type !== 'stream_event' ||
    evt.event?.type !== 'content_block_delta' ||
    evt.event.delta?.type !== 'text_delta' ||
    typeof evt.event.delta.text !== 'string'
  )
    return null
  return evt.event.delta.text
}

// -- claude (stream-json) ---------------------------------------------------

interface ClaudeContentBlock {
  type?: string
  text?: string
  name?: string
  id?: string
  input?: unknown
  thinking?: string
}

interface ClaudeAssistantEvent {
  type?: string
  message?: { content?: ClaudeContentBlock[] }
}

interface ClaudeToolResultEvent {
  type?: string
  message?: {
    content?: Array<{ type?: string; tool_use_id?: string; content?: unknown; is_error?: boolean }>
  }
}

/** Requested paths ONLY. Never use as evidence of success; use ClaudeReadAudit. */
export function claudeEventToReadPaths(raw: unknown): string[] {
  const evt = raw as ClaudeAssistantEvent
  if (!evt || typeof evt !== 'object' || evt.type !== 'assistant') return []
  const paths: string[] = []
  for (const block of evt.message?.content ?? []) {
    if (block.type !== 'tool_use' || block.name !== 'Read') continue
    const input = block.input
    if (
      input &&
      typeof input === 'object' &&
      typeof (input as { file_path?: unknown }).file_path === 'string'
    ) {
      paths.push((input as { file_path: string }).file_path)
    }
  }
  return paths
}

interface ClaudeResultEvent {
  type?: string
  total_cost_usd?: number
  usage?: { input_tokens?: number; output_tokens?: number }
}

/** AT.21 — la fila de una llamada `run_readonly` muestra el comando (`git log -1`), no el JSON de argumentos. */
export function readonlyCommandTarget(label: string, args: unknown): string | undefined {
  if (!label.endsWith('__run_readonly')) return undefined
  const argv = (args as { argv?: unknown } | null | undefined)?.argv
  return Array.isArray(argv) && argv.every((a) => typeof a === 'string')
    ? argv.join(' ')
    : undefined
}

export function claudeEventToStep(raw: unknown): ExecutorStepEvent[] {
  const evt = raw as ClaudeAssistantEvent & ClaudeResultEvent
  if (!evt || typeof evt !== 'object') return []

  const retry = raw as {
    subtype?: string
    attempt?: number
    max_retries?: number
    error?: string
    error_status?: number
    no_response?: { waited_ms?: number; retry_wait_ms?: number }
    retry_delay_ms?: number
  }
  if (evt.type === 'system' && retry.subtype === 'api_retry') {
    const cause =
      retry.error ?? (retry.error_status ? String(retry.error_status) : 'no error reported')
    const waited = retry.no_response?.waited_ms
    const message = `Claude Code CLI is retrying ${retry.attempt ?? '?'}/${retry.max_retries ?? '?'}: ${cause}${waited === undefined ? '' : ` — no response for ${Math.floor(waited / 1000)} s`}`
    return [
      {
        type: 'notice',
        label: message,
        notice: { kind: 'retrying', message, detail: JSON.stringify(raw) },
      },
    ]
  }
  if (evt.type === 'assistant' && retry.error) {
    const notice = cliFailureNotice(
      retry.error,
      'Claude Code CLI',
      undefined,
      claudeFailureKind(retry.error),
    )
    return [
      { type: 'notice', label: notice.message, notice: { ...notice, detail: JSON.stringify(raw) } },
    ]
  }
  if (evt.type === 'assistant') {
    const blocks = evt.message?.content ?? []
    const steps: ExecutorStepEvent[] = []
    for (const block of blocks) {
      if (block.type === 'text' && typeof block.text === 'string') {
        steps.push({ type: 'text', label: 'text', detail: block.text })
      } else if (block.type === 'thinking' && typeof block.thinking === 'string') {
        steps.push({ type: 'reasoning', label: 'reasoning', detail: block.thinking })
      } else if (block.type === 'tool_use' && typeof block.name === 'string') {
        const input = block.input as Record<string, unknown> | undefined
        const target =
          typeof input?.file_path === 'string'
            ? input.file_path
            : typeof input?.path === 'string'
              ? input.path
              : readonlyCommandTarget(block.name, input)
        const oldText = typeof input?.old_string === 'string' ? input.old_string : undefined
        const newText = typeof input?.new_string === 'string' ? input.new_string : undefined
        const content = typeof input?.content === 'string' ? input.content : undefined
        const step: ExecutorStepEvent = {
          type: 'tool_use',
          label: block.name,
          detail: block.input !== undefined ? JSON.stringify(block.input) : undefined,
        }
        if (block.id) step.toolUseId = block.id
        if (target !== undefined) step.target = target
        if (newText !== undefined || content !== undefined)
          step.added = lineCount(newText ?? content ?? '')
        if (oldText !== undefined) step.removed = lineCount(oldText)
        steps.push(step)
      }
    }
    return steps
  }

  if (evt.type === 'user') {
    const event = raw as ClaudeToolResultEvent
    return (event.message?.content ?? [])
      .filter((block) => block.type === 'tool_result')
      .map((block) => ({
        type: 'tool_use' as const,
        label: 'tool_result',
        toolUseId: block.tool_use_id,
        ok: !block.is_error,
        output:
          typeof block.content === 'string' ? block.content : JSON.stringify(block.content ?? ''),
      }))
  }

  if (evt.type === 'result') {
    return [
      {
        type: 'step_finish',
        label: 'step_finish',
        costUsd: evt.total_cost_usd,
        tokens: { input: evt.usage?.input_tokens, output: evt.usage?.output_tokens },
      },
    ]
  }

  return []
}

function lineCount(value: string): number {
  return value === '' ? 0 : value.split(/\r?\n/).length
}

// -- opencode (NDJSON) -------------------------------------------------------

interface OpencodePart {
  type?: string
  tool?: string
  text?: string
  state?: {
    title?: string
    status?: string
    output?: string
    exit_code?: number
    exitCode?: number
    input?: Record<string, unknown>
  }
  input?: Record<string, unknown>
  cost?: number
  tokens?: { input?: number; output?: number }
}

interface OpencodeEvent {
  type?: string
  part?: OpencodePart
}

export function opencodeEventToStep(raw: unknown): ExecutorStepEvent[] {
  const evt = raw as OpencodeEvent
  if (!evt || typeof evt !== 'object') return []
  const part = evt.part

  if (evt.type === 'tool_use' && part) {
    const input = part.input ?? part.state?.input
    const target =
      typeof input?.file_path === 'string'
        ? input.file_path
        : typeof input?.path === 'string'
          ? input.path
          : undefined
    const oldText = typeof input?.old_string === 'string' ? input.old_string : undefined
    const newText = typeof input?.new_string === 'string' ? input.new_string : undefined
    const content = typeof input?.content === 'string' ? input.content : undefined
    const exitCode = part.state?.exit_code ?? part.state?.exitCode
    const ok =
      typeof exitCode === 'number'
        ? exitCode === 0
        : typeof part.state?.status === 'string'
          ? part.state.status === 'completed' || part.state.status === 'success'
          : undefined
    return [
      {
        type: 'tool_use',
        label: part.tool ?? 'tool',
        detail: part.state?.title,
        ...(target === undefined ? {} : { target }),
        ...(newText !== undefined || content !== undefined
          ? { added: lineCount(newText ?? content ?? '') }
          : {}),
        ...(oldText === undefined ? {} : { removed: lineCount(oldText) }),
        ...(exitCode === undefined ? {} : { exitCode }),
        ...(ok === undefined ? {} : { ok }),
        ...(part.state?.output === undefined ? {} : { output: part.state.output }),
      },
    ]
  }

  if (evt.type === 'text' && part) {
    return [{ type: 'text', label: 'text', detail: part.text }]
  }

  if (part?.type === 'reasoning' || evt.type === 'reasoning') {
    return [{ type: 'reasoning', label: 'reasoning', detail: part?.text }]
  }

  if (evt.type === 'step_finish' && part) {
    return [
      {
        type: 'step_finish',
        label: 'step_finish',
        costUsd: part.cost,
        tokens: { input: part.tokens?.input, output: part.tokens?.output },
      },
    ]
  }

  return []
}

// -- codex (JSONL) ------------------------------------------------------------
// G.4.2b — shape verificado en vivo 2026-07-27 (`codex exec --json`, probe
// real contra un git repo temporal). Solo se mapea `item.completed` (no
// `item.started`) — evita filas duplicadas a medio terminar; `error` es
// informational en la práctica (ej. aviso de presupuesto de skills, no
// aborta el run) y se ignora a propósito, no se muestra como fallo.

interface CodexItem {
  type?: string
  text?: string
  command?: string
  changes?: { path?: string; kind?: string }[]
  exit_code?: number
  aggregated_output?: string
  server?: string
  tool?: string
  arguments?: unknown
  status?: string
}

interface CodexEvent {
  type?: string
  item?: CodexItem
  usage?: { input_tokens?: number; output_tokens?: number }
}

export function codexEventToStep(raw: unknown): ExecutorStepEvent[] {
  const evt = raw as CodexEvent
  if (!evt || typeof evt !== 'object') return []

  if (evt.type === 'item.completed' && evt.item) {
    const item = evt.item
    if (item.type === 'agent_message') {
      return [{ type: 'text', label: 'text', detail: item.text }]
    }
    if (item.type === 'reasoning') {
      return [{ type: 'reasoning', label: 'reasoning', detail: item.text }]
    }
    if (item.type === 'command_execution') {
      return [
        {
          type: 'tool_use',
          label: 'command',
          detail: item.command,
          ...(item.exit_code === undefined
            ? {}
            : { ok: item.exit_code === 0, exitCode: item.exit_code }),
          ...(item.aggregated_output === undefined ? {} : { output: item.aggregated_output }),
        },
      ]
    }
    if (item.type === 'file_change') {
      const paths = (item.changes ?? [])
        .map((c) => c.path)
        .filter(Boolean)
        .join(', ')
      return [
        {
          type: 'tool_use',
          label: 'file_change',
          ...(paths ? { detail: paths, target: paths } : {}),
        },
      ]
    }
    // AT.20 — llamada MCP en `codex exec`; mismo paso que emite el app-server.
    if (item.type === 'mcp_tool_call') {
      const mcpTarget = (it: any) =>
        readonlyCommandTarget(
          it.server && it.tool ? `mcp__${it.server}__${it.tool}` : '',
          it.arguments,
        )
      return [
        {
          type: 'tool_use',
          label:
            item.server && item.tool ? `mcp__${item.server}__${item.tool}` : (item.tool ?? 'mcp'),
          detail: item.arguments === undefined ? item.server : JSON.stringify(item.arguments),
          ...(mcpTarget(item) === undefined ? {} : { target: mcpTarget(item) }),
          ok: item.status === 'failed' ? false : item.status === 'completed' ? true : undefined,
        },
      ]
    }
    return []
  }

  if (evt.type === 'turn.completed') {
    return [
      {
        type: 'step_finish',
        label: 'step_finish',
        // Sin costo en el evento (a diferencia de claude/opencode) — se
        // computa aparte en codex.ts vía calcCost(), no acá.
        tokens: { input: evt.usage?.input_tokens, output: evt.usage?.output_tokens },
      },
    ]
  }

  return []
}
