/**
 * UI.8.6 — descripción honesta de lo que puede hacer el agente, derivada de los flags reales
 * de los builders (no de literales duplicados): si un flag cambia, el texto cambia solo.
 */
import { resolveRole } from '../config/load.ts'
import type { OrcheConfig } from '../config/schema.ts'
import { CODEX_TASK_SANDBOX } from './executors/codex.ts'
import { CLAUDE_TASK_ALLOWED_TOOLS } from './executors/external.ts'
import { OPENCODE_TASK_AUTO_FLAG } from './executors/opencode.ts'

export interface PermissionsDescription {
  mode: 'yolo' | 'manual'
  chat: string
  tasks: string
}

export function describePermissions(cfg: OrcheConfig): PermissionsDescription {
  let agent: string | undefined
  try {
    agent = resolveRole(cfg, 'executor').agent
  } catch {
    agent = undefined
  }
  let tasks = 'isolated worktree'
  if (agent === 'claude')
    tasks = `isolated worktree · tools: ${CLAUDE_TASK_ALLOWED_TOOLS.split(',').join(', ')} · no shell`
  else if (agent === 'codex') tasks = `isolated worktree · sandbox ${CODEX_TASK_SANDBOX}`
  else if (agent === 'opencode')
    tasks = `isolated worktree · all tools auto-approved (${OPENCODE_TASK_AUTO_FLAG})`
  return { mode: cfg.permissionMode === 'manual' ? 'manual' : 'yolo', chat: 'read-only', tasks }
}
