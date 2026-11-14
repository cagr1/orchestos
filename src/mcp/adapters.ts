/**
 * src/mcp/adapters.ts — AT.20
 *
 * Capa común + adaptador por CLI para ofrecer `create_task` y `run_readonly` (AT.21) al chat. El adaptador
 * de cada CLI se declara en `KNOWN_CLIS[].mcp` (cli-registry.ts); acá vive cómo se
 * le pasa el servidor a cada uno y cómo se reconoce la llamada en su stream.
 *
 * Formatos medidos con los binarios reales (2026-10-17, claude 2.1.302 / codex-cli 0.163.0):
 *  - claude: evento `assistant` con block `tool_use` de nombre `mcp__orchestos__create_task`
 *    (fixture `__fixtures__/claude-create-task-assistant.json`).
 *  - codex app-server: `config.mcp_servers.orchestos` en `thread/start`/`thread/resume` y
 *    notificación `item/completed` con item `mcpToolCall {server, tool, arguments}`
 *    (fixture `__fixtures__/codex-create-task-completed.json`).
 */

import { join } from 'node:path'
import { parseJson, z } from '../boundary/index.ts'
import type { ToolDef, ToolExecutor } from '../providers/tool-call.ts'
import type { ExecutorStepEvent } from '../run/executors/step-event.ts'
import { RUN_READONLY_TOOL, readonlyToolDefinition, runReadonly } from './readonly.ts'
import {
  CREATE_TASK_RESPONSE,
  CREATE_TASK_SCHEMA,
  CREATE_TASK_TOOL,
  type CreateTaskArgs,
  type LessonProposal,
  MCP_SERVER_NAME,
  MESSAGE_SESSION_DESCRIPTION,
  MESSAGE_SESSION_RESPONSE,
  MESSAGE_SESSION_SCHEMA,
  MESSAGE_SESSION_TOOL,
  OPEN_IN_DEV_DESCRIPTION,
  OPEN_IN_DEV_RESPONSE,
  OPEN_IN_DEV_SCHEMA,
  OPEN_IN_DEV_TOOL,
  PROPOSE_LESSON_DESCRIPTION,
  PROPOSE_LESSON_RESPONSE,
  PROPOSE_LESSON_SCHEMA,
  PROPOSE_LESSON_TOOL,
  parseCreateTaskArgs,
  parseMessageSessionArgs,
  parseProposeLessonArgs,
  type SessionMessageProposal,
} from './server.ts'

export const CREATE_TASK_STEP_LABEL = `mcp__${MCP_SERVER_NAME}__${CREATE_TASK_TOOL}`
export const RUN_READONLY_STEP_LABEL = `mcp__${MCP_SERVER_NAME}__${RUN_READONLY_TOOL}`

export const PROPOSE_LESSON_STEP_LABEL = `mcp__${MCP_SERVER_NAME}__${PROPOSE_LESSON_TOOL}`

const SERVER_PATH = join(import.meta.dir, 'server.ts')

/** AT.21 — qué herramientas del servidor recibe un turno de chat, y la raíz del proyecto donde corren. */
export interface McpOffer {
  tools: string[]
  root: string
}

/** Clave estable del conjunto ofrecido; el hilo de Codex se reabre si cambia (herramientas o raíz). */
export function mcpOfferKey(offer: McpOffer | undefined): string {
  return offer?.tools.length ? `${offer.root}\0${[...offer.tools].sort().join(',')}` : ''
}

export function orchestosMcpServerCommand(offer: McpOffer): { command: string; args: string[] } {
  return {
    command: process.execPath,
    args: [SERVER_PATH, '--tools', offer.tools.join(','), '--root', offer.root],
  }
}

/** Claude: `--mcp-config` va en CADA invocación (también con `--resume`). Compatible con `--strict-mcp-config`. */
export function claudeMcpArgs(offer: McpOffer): string[] {
  const { command, args } = orchestosMcpServerCommand(offer)
  return [
    '--mcp-config',
    JSON.stringify({ mcpServers: { [MCP_SERVER_NAME]: { command, args } } }),
    '--allowedTools',
    ...offer.tools.map((tool) => `mcp__${MCP_SERVER_NAME}__${tool}`),
  ]
}

/** Codex app-server: override de config por hilo (`thread/start` y `thread/resume`). */
export function codexMcpThreadConfig(offer: McpOffer): Record<string, unknown> {
  const { command, args } = orchestosMcpServerCommand(offer)
  return {
    mcp_servers: {
      [MCP_SERVER_NAME]: { command, args, default_tools_approval_mode: 'approve' },
    },
  }
}

/** `codex exec` (respaldo sin app-server): mismo servidor por `-c`; verificado con codex-cli 0.163.0. */
export function codexExecMcpArgs(offer: McpOffer): string[] {
  const { command, args } = orchestosMcpServerCommand(offer)
  const prefix = `mcp_servers.${MCP_SERVER_NAME}`
  return [
    '-c',
    `${prefix}.command=${JSON.stringify(command)}`,
    '-c',
    `${prefix}.args=${JSON.stringify(args)}`,
    '-c',
    `${prefix}.default_tools_approval_mode="approve"`,
  ]
}

export type TaskProposal = { ok: true; args: CreateTaskArgs } | { ok: false; error: string }

/** Reconoce una llamada a `create_task` en un paso normalizado de cualquier CLI. */
export function taskProposalFromStep(step: ExecutorStepEvent): TaskProposal | null {
  if (step.type !== 'tool_use' || step.label !== CREATE_TASK_STEP_LABEL) return null
  let input: unknown
  try {
    input = step.detail === undefined ? undefined : JSON.parse(step.detail)
  } catch {
    return { ok: false, error: 'create_task arguments were not valid JSON' }
  }
  return parseCreateTaskArgs(input)
}

/** Chat por API (OpenRouter): `create_task` como herramienta nativa, mismo schema y validación que el servidor MCP. */
export function createTaskApiTool(onProposal: (proposal: TaskProposal) => void): {
  tool: ToolDef
  execute: ToolExecutor
} {
  return {
    tool: {
      name: CREATE_TASK_TOOL,
      description:
        'Propose a task that creates or modifies project files. Call it only when files must change; the user approves it before anything runs.',
      input_schema: CREATE_TASK_SCHEMA as unknown as ToolDef['input_schema'],
    },
    execute: async (_name, input) => {
      const parsed = parseCreateTaskArgs(input)
      onProposal(parsed)
      return parsed.ok ? CREATE_TASK_RESPONSE : `[Error: ${parsed.error}]`
    },
  }
}

/** Chat por API (OpenRouter): `run_readonly` como herramienta nativa; misma validación y ejecución que el servidor MCP. */
export function runReadonlyApiTool(root: string): { tool: ToolDef; execute: ToolExecutor } {
  const definition = readonlyToolDefinition()
  return {
    tool: {
      name: RUN_READONLY_TOOL,
      description: definition.description,
      input_schema: definition.inputSchema as unknown as ToolDef['input_schema'],
    },
    execute: async (_name, input) => {
      const out = await runReadonly(input, root)
      return out.isError ? `[Error: ${out.text}]` : out.text
    },
  }
}

export function lessonProposalFromStep(step: ExecutorStepEvent): LessonProposal | null {
  if (step.type !== 'tool_use' || step.label !== PROPOSE_LESSON_STEP_LABEL) return null
  const parsed = parseJson(z.unknown(), step.detail ?? '')
  return parsed.ok
    ? parseProposeLessonArgs(parsed.data)
    : { ok: false, error: 'propose_lesson arguments were not valid JSON' }
}

export function proposeLessonApiTool(onProposal: (proposal: LessonProposal) => void): {
  tool: ToolDef
  execute: ToolExecutor
} {
  return {
    tool: {
      name: PROPOSE_LESSON_TOOL,
      description: PROPOSE_LESSON_DESCRIPTION,
      input_schema: PROPOSE_LESSON_SCHEMA as unknown as ToolDef['input_schema'],
    },
    execute: async (_name, input) => {
      const parsed = parseProposeLessonArgs(input)
      onProposal(parsed)
      return parsed.ok ? PROPOSE_LESSON_RESPONSE : `[Error: ${parsed.error}]`
    },
  }
}

export function openInDevApiTool(onOpen: () => void): { tool: ToolDef; execute: ToolExecutor } {
  return {
    tool: {
      name: OPEN_IN_DEV_TOOL,
      description: OPEN_IN_DEV_DESCRIPTION,
      input_schema: OPEN_IN_DEV_SCHEMA,
    },
    execute: async () => {
      onOpen()
      return OPEN_IN_DEV_RESPONSE
    },
  }
}

export const MESSAGE_SESSION_STEP_LABEL = `mcp__${MCP_SERVER_NAME}__${MESSAGE_SESSION_TOOL}`
export function messageSessionProposalFromStep(
  step: ExecutorStepEvent,
): SessionMessageProposal | null {
  if (step.type !== 'tool_use' || step.label !== MESSAGE_SESSION_STEP_LABEL) return null
  const parsed = parseJson(z.unknown(), step.detail ?? '')
  return parsed.ok
    ? parseMessageSessionArgs(parsed.data)
    : { ok: false, error: 'message_session arguments were not valid JSON' }
}
export function messageSessionApiTool(onProposal: (proposal: SessionMessageProposal) => void): {
  tool: ToolDef
  execute: ToolExecutor
} {
  return {
    tool: {
      name: MESSAGE_SESSION_TOOL,
      description: MESSAGE_SESSION_DESCRIPTION,
      input_schema: MESSAGE_SESSION_SCHEMA as unknown as ToolDef['input_schema'],
    },
    execute: async (_name, input) => {
      const parsed = parseMessageSessionArgs(input)
      onProposal(parsed)
      return parsed.ok ? MESSAGE_SESSION_RESPONSE : `[Error: ${parsed.error}]`
    },
  }
}
