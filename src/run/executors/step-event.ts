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
 *    los habilita pero no se pudo probar su shape en este entorno — no fingir
 *    soporte de algo no verificado, mismo criterio que G.1/G.5).
 *  - opencode: `opencode run ... --format json --auto` — `evt.type` en
 *    `'tool_use' | 'text' | 'step_finish' | 'step_start'`, con detalle en
 *    `evt.part`. `tool_use`: `part.tool` (nombre) + `part.state.title`.
 *    `text`: `part.text`. `step_finish`: `part.cost` + `part.tokens.{input,output}`.
 *    `step_start` no aporta info mapeable — se ignora.
 */

export interface ExecutorStepEvent {
  type: 'tool_use' | 'text' | 'step_finish'
  label: string
  detail?: string
  costUsd?: number
  tokens?: { input?: number; output?: number }
}

// -- claude (stream-json) ---------------------------------------------------

interface ClaudeContentBlock {
  type?: string
  text?: string
  name?: string
  input?: unknown
}

interface ClaudeAssistantEvent {
  type?: string
  message?: { content?: ClaudeContentBlock[] }
}

interface ClaudeResultEvent {
  type?: string
  total_cost_usd?: number
  usage?: { input_tokens?: number; output_tokens?: number }
}

export function claudeEventToStep(raw: unknown): ExecutorStepEvent[] {
  const evt = raw as ClaudeAssistantEvent & ClaudeResultEvent
  if (!evt || typeof evt !== 'object') return []

  if (evt.type === 'assistant') {
    const blocks = evt.message?.content ?? []
    const steps: ExecutorStepEvent[] = []
    for (const block of blocks) {
      if (block.type === 'text' && typeof block.text === 'string') {
        steps.push({ type: 'text', label: 'text', detail: block.text })
      } else if (block.type === 'tool_use' && typeof block.name === 'string') {
        steps.push({
          type: 'tool_use',
          label: block.name,
          detail: block.input !== undefined ? JSON.stringify(block.input) : undefined,
        })
      }
    }
    return steps
  }

  if (evt.type === 'result') {
    return [{
      type: 'step_finish',
      label: 'step_finish',
      costUsd: evt.total_cost_usd,
      tokens: { input: evt.usage?.input_tokens, output: evt.usage?.output_tokens },
    }]
  }

  return []
}

// -- opencode (NDJSON) -------------------------------------------------------

interface OpencodePart {
  type?: string
  tool?: string
  text?: string
  state?: { title?: string }
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
    return [{
      type: 'tool_use',
      label: part.tool ?? 'tool',
      detail: part.state?.title,
    }]
  }

  if (evt.type === 'text' && part) {
    return [{ type: 'text', label: 'text', detail: part.text }]
  }

  if (evt.type === 'step_finish' && part) {
    return [{
      type: 'step_finish',
      label: 'step_finish',
      costUsd: part.cost,
      tokens: { input: part.tokens?.input, output: part.tokens?.output },
    }]
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
    if (item.type === 'command_execution') {
      return [{ type: 'tool_use', label: 'command', detail: item.command }]
    }
    if (item.type === 'file_change') {
      const paths = (item.changes ?? []).map(c => c.path).filter(Boolean).join(', ')
      return [{ type: 'tool_use', label: 'file_change', detail: paths || undefined }]
    }
    return []
  }

  if (evt.type === 'turn.completed') {
    return [{
      type: 'step_finish',
      label: 'step_finish',
      // Sin costo en el evento (a diferencia de claude/opencode) — se
      // computa aparte en codex.ts vía calcCost(), no acá.
      tokens: { input: evt.usage?.input_tokens, output: evt.usage?.output_tokens },
    }]
  }

  return []
}
