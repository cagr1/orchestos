/**
 * src/mcp/server.ts — AT.20
 *
 * Servidor MCP stdio de OrchestOS (JSON-RPC 2.0 delimitado por líneas), sin SDK.
 * Una sola herramienta, `create_task`: NO crea nada, solo valida los argumentos y
 * responde que la propuesta se envió. La fuente de verdad es la llamada que
 * aparece en el stream del CLI de chat (la lee `chat.ts`).
 *
 * Uso: `bun src/mcp/server.ts [--no-tasks]`. Con `--no-tasks` (o
 * `ORCHESTOS_MCP_TASKS=0`) `create_task` responde con error.
 */

export const MCP_SERVER_NAME = 'orchestos'
export const CREATE_TASK_TOOL = 'create_task'
export const CREATE_TASK_RESPONSE = 'Task proposal sent; the user will see it and approve it.'

export interface CreateTaskArgs {
  title: string
  description: string
  outputs: string[]
}

export const CREATE_TASK_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Short task title.' },
    description: {
      type: 'string',
      description: 'What the task must build or change, self-contained.',
    },
    outputs: {
      type: 'array',
      items: { type: 'string' },
      description: 'Paths, relative to the project, of the files the task creates or modifies.',
    },
  },
  required: ['title', 'description', 'outputs'],
  additionalProperties: false,
} as const

/** Devuelve los argumentos normalizados o el motivo por el que son inválidos. */
export function parseCreateTaskArgs(
  input: unknown,
): { ok: true; args: CreateTaskArgs } | { ok: false; error: string } {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    return { ok: false, error: 'arguments must be an object' }
  const { title, description, outputs } = input as Record<string, unknown>
  if (typeof title !== 'string' || !title.trim())
    return { ok: false, error: '`title` must be a non-empty string' }
  if (typeof description !== 'string' || !description.trim())
    return { ok: false, error: '`description` must be a non-empty string' }
  if (!Array.isArray(outputs) || outputs.some((o) => typeof o !== 'string'))
    return { ok: false, error: '`outputs` must be an array of strings' }
  const clean = outputs.map((o: string) => o.trim()).filter(Boolean)
  if (clean.length === 0) return { ok: false, error: '`outputs` must name at least one file' }
  for (const path of clean) {
    if (path.startsWith('/') || path.split(/[\\/]/).includes('..'))
      return { ok: false, error: `\`outputs\` path must be relative to the project: ${path}` }
  }
  return {
    ok: true,
    args: { title: title.trim(), description: description.trim(), outputs: clean },
  }
}

type JsonRpcId = string | number | null

interface JsonRpcRequest {
  jsonrpc?: string
  id?: JsonRpcId
  method?: string
  params?: any
}

/** Responde a un mensaje JSON-RPC; `null` para notificaciones (sin respuesta). */
export function handleMcpMessage(
  message: JsonRpcRequest,
  options: { tasksEnabled: boolean } = { tasksEnabled: true },
): object | null {
  const id = message.id
  if (id === undefined || id === null) return null
  const result = (value: object) => ({ jsonrpc: '2.0', id, result: value })
  const failure = (code: number, text: string) => ({
    jsonrpc: '2.0',
    id,
    error: { code, message: text },
  })
  switch (message.method) {
    case 'initialize':
      return result({
        protocolVersion: message.params?.protocolVersion ?? '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: MCP_SERVER_NAME, version: '1.0.0' },
      })
    case 'ping':
      return result({})
    case 'tools/list':
      return result({
        tools: [
          {
            name: CREATE_TASK_TOOL,
            description:
              'Propose a task for OrchestOS to build or modify files in this project. Call it when files must be created or changed; answer everything else directly.',
            inputSchema: CREATE_TASK_SCHEMA,
          },
        ],
      })
    case 'tools/call': {
      if (message.params?.name !== CREATE_TASK_TOOL)
        return failure(-32602, `Unknown tool: ${message.params?.name}`)
      const text = (value: string, isError: boolean) =>
        result({ content: [{ type: 'text', text: value }], isError })
      if (!options.tasksEnabled)
        return text('Tasks cannot be created in this chat; answer the user directly.', true)
      const parsed = parseCreateTaskArgs(message.params?.arguments)
      return parsed.ok ? text(CREATE_TASK_RESPONSE, false) : text(parsed.error, true)
    }
    default:
      return failure(-32601, `Method not found: ${message.method}`)
  }
}

export async function runMcpServer(
  options: { tasksEnabled: boolean },
  input: AsyncIterable<Uint8Array | string> = process.stdin,
  write: (line: string) => void = (line) => process.stdout.write(line),
): Promise<void> {
  const decoder = new TextDecoder()
  let buffer = ''
  const flush = (line: string) => {
    if (!line.trim()) return
    let message: JsonRpcRequest
    try {
      message = JSON.parse(line)
    } catch {
      write(
        `${JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } })}\n`,
      )
      return
    }
    const response = handleMcpMessage(message, options)
    if (response) write(`${JSON.stringify(response)}\n`)
  }
  for await (const chunk of input) {
    buffer += typeof chunk === 'string' ? chunk : decoder.decode(chunk, { stream: true })
    let newline = buffer.indexOf('\n')
    while (newline >= 0) {
      flush(buffer.slice(0, newline))
      buffer = buffer.slice(newline + 1)
      newline = buffer.indexOf('\n')
    }
  }
  flush(buffer)
}

if (import.meta.main) {
  const tasksEnabled =
    !process.argv.includes('--no-tasks') && process.env.ORCHESTOS_MCP_TASKS !== '0'
  await runMcpServer({ tasksEnabled })
}
