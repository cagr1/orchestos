import { expect, test } from 'bun:test'
import type { OrcheConfig } from '../config/schema.ts'
import { CODEX_TASK_SANDBOX } from './executors/codex.ts'
import { CLAUDE_TASK_ALLOWED_TOOLS } from './executors/external.ts'
import { OPENCODE_TASK_AUTO_FLAG } from './executors/opencode.ts'
import { describePermissions } from './permissions.ts'

function cfg(agent?: string, permissionMode?: 'manual'): OrcheConfig {
  return {
    config_version: 1,
    roles: agent ? { executor: { agent, model: 'm' } } : {},
    models: {},
    permissionMode,
  } as unknown as OrcheConfig
}

test('claude: la descripción contiene cada herramienta del flag real', () => {
  const d = describePermissions(cfg('claude'))
  for (const tool of CLAUDE_TASK_ALLOWED_TOOLS.split(',')) expect(d.tasks).toContain(tool)
  expect(d.tasks).toContain('no shell')
  expect(d.chat).toBe('read-only')
  expect(d.mode).toBe('yolo')
})

test('codex y opencode leen su flag de la constante', () => {
  expect(describePermissions(cfg('codex')).tasks).toContain(CODEX_TASK_SANDBOX)
  expect(describePermissions(cfg('opencode')).tasks).toContain(OPENCODE_TASK_AUTO_FLAG)
})

test('sin executor asignado: solo worktree; manual se refleja', () => {
  expect(describePermissions(cfg()).tasks).toBe('isolated worktree')
  expect(describePermissions(cfg('claude', 'manual')).mode).toBe('manual')
})
