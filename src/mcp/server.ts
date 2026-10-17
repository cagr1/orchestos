/**
 * src/mcp/server.ts — AT.20
 *
 * Servidor MCP stdio de OrchestOS (JSON-RPC 2.0 delimitado por líneas), sin SDK.
 * Herramientas (AT.21: se ofrecen por herramienta, `tools/list` solo lista las pedidas):
 *  - `create_task`: NO crea nada, solo valida los argumentos y responde que la propuesta
 *    se envió. La fuente de verdad es la llamada que aparece en el stream del CLI de chat
 *    (la lee `chat.ts`).
 *  - `run_readonly`: shell de solo lectura (git/ls/rg) en la raíz del proyecto (`readonly.ts`).
 *
 * Uso: `bun src/mcp/server.ts --tools create_task,run_readonly --root <abs>`.
 */

import {
  RUN_READONLY_DESCRIPTION,
  RUN_READONLY_SCHEMA,
  RUN_READONLY_TOOL,
  runReadonly,
} from './readonly.ts'

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

export interface McpServerOptions {
  /** Herramientas que expone `tools/list` y acepta `tools/call`. */
  tools: string[]
  /** Raíz absoluta del proyecto (cwd y frontera de `run_readonly`). */
  root: string
}

type JsonRpcId = string | number | null

interface JsonRpcRequest {
  jsonrpc?: string
  id?: JsonRpcId
  method?: string
  params?: any
}

/** Responde a un mensaje JSON-RPC; `null` para notificaciones (sin respuesta). */
export async function handleMcpMessage(
  message: JsonRpcRequest,
  options: McpServerOptions = { tools: [CREATE_TASK_TOOL], root: process.cwd() },
): Promise<object | null> {
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
          ...(options.tools.includes(CREATE_TASK_TOOL)
            ? [
                {
                  name: CREATE_TASK_TOOL,
                  description:
                    'Propose a task for OrchestOS to build or modify files in this project. Call it when files must be created or changed; answer everything else directly.',
                  inputSchema: CREATE_TASK_SCHEMA,
                },
              ]
            : []),
          ...(options.tools.includes(RUN_READONLY_TOOL)
            ? [
                {
                  name: RUN_READONLY_TOOL,
                  description: RUN_READONLY_DESCRIPTION,
                  inputSchema: RUN_READONLY_SCHEMA,
                },
              ]
            : []),
        ],
      })
    case 'tools/call': {
      const name = message.params?.name
      const text = (value: string, isError: boolean) =>
        result({ content: [{ type: 'text', text: value }], isError })
      if (typeof name !== 'string' || !options.tools.includes(name))
        return failure(-32602, `Unknown tool: ${name}`)
      if (name === RUN_READONLY_TOOL) {
        const out = await runReadonly(message.params?.arguments, options.root)
        return text(out.text, out.isError)
      }
      const parsed = parseCreateTaskArgs(message.params?.arguments)
      return parsed.ok ? text(CREATE_TASK_RESPONSE, false) : text(parsed.error, true)
    }
    default:
      return failure(-32601, `Method not found: ${message.method}`)
  }
}

export async function runMcpServer(
  options: McpServerOptions,
  input: AsyncIterable<Uint8Array | string> = process.stdin,
  write: (line: string) => void = (line) => process.stdout.write(line),
): Promise<void> {
  const decoder = new TextDecoder()
  let buffer = ''
  const flush = async (line: string) => {
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
    const response = await handleMcpMessage(message, options)
    if (response) write(`${JSON.stringify(response)}\n`)
  }
  for await (const chunk of input) {
    buffer += typeof chunk === 'string' ? chunk : decoder.decode(chunk, { stream: true })
    let newline = buffer.indexOf('\n')
    while (newline >= 0) {
      await flush(buffer.slice(0, newline))
      buffer = buffer.slice(newline + 1)
      newline = buffer.indexOf('\n')
    }
  }
  await flush(buffer)
}

/** `--tools a,b --root <abs>` → opciones; sin `--tools` solo `create_task`. */
export function parseServerArgs(argv: string[]): McpServerOptions {
  const value = (flag: string) => {
    const at = argv.indexOf(flag)
    return at >= 0 ? argv[at + 1] : undefined
  }
  const tools = (value('--tools') ?? CREATE_TASK_TOOL).split(',').filter(Boolean)
  return { tools, root: value('--root') ?? process.cwd() }
}

if (import.meta.main) {
  await runMcpServer(parseServerArgs(process.argv.slice(2)))
}
