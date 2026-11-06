import { describe, expect, test } from 'bun:test'
import {
  ROUTING_ROLE_KEYS,
  type RoutingAgent,
  routingAgentAllowed,
  routingAssignment,
  suggestUnassignedRoles,
} from './routing-roles'

const cli: RoutingAgent = {
  id: 'codex',
  label: 'Codex',
  installed: true,
  taskEngine: true,
  models: [
    { id: 'first', name: 'First' },
    { id: 'preferred', name: 'Preferred', default: true },
  ],
  efforts: [],
}

describe('ONB.2 routing suggestions', () => {
  test('fills each unassigned role with the selector default model', () => {
    const roles = suggestUnassignedRoles({}, [cli], 'codex', [])
    for (const role of ROUTING_ROLE_KEYS)
      expect(roles[role]).toEqual({ agent: 'codex', model: 'preferred' })
    expect(routingAssignment({ ...cli, models: [cli.models[0]] }).model).toBe('first')
  })
  test('keeps assigned roles intact and disappears when nothing can be filled', () => {
    const assignment = { agent: 'other', model: 'kept', effort: 'medium' }
    const roles = suggestUnassignedRoles({ executor: assignment }, [cli], 'codex', [])
    expect(roles.executor).toBe(assignment)
    expect(suggestUnassignedRoles(roles, [cli], 'codex', [])).toBe(roles)
  })
  test('OpenCode cannot fill orchestrator', () => {
    const opencode = { ...cli, id: 'opencode' }
    const roles = suggestUnassignedRoles({}, [opencode], 'opencode', [])
    expect(roles.orchestrator).toBeUndefined()
    for (const role of ['executor', 'reviewer', 'auxiliary'])
      expect(roles[role]?.agent).toBe('opencode')
    expect(suggestUnassignedRoles(roles, [opencode], 'opencode', [])).toBe(roles)
  })
  test('generic CLIs fill only executor and use its default model fallback', () => {
    const generic = { ...cli, id: 'custom', generic: true, models: [] }
    expect(suggestUnassignedRoles({}, [generic], 'custom', [])).toEqual({
      executor: { agent: 'custom', model: 'default' },
    })
  })
  test('taskEngine false excludes executor, matching the selector', () => {
    const noEngine = { ...cli, taskEngine: false }
    expect(routingAgentAllowed('executor', noEngine, [])).toBe(false)
    const roles = suggestUnassignedRoles({}, [noEngine], 'codex', [])
    expect(roles.executor).toBeUndefined()
    expect(roles.reviewer?.agent).toBe('codex')
  })
  test('null, API, missing, uninstalled, hidden and disabled candidates do not suggest', () => {
    const empty = {}
    for (const suggestion of [null, 'api', 'missing'])
      expect(suggestUnassignedRoles(empty, [cli], suggestion, [])).toBe(empty)
    for (const candidate of [
      { ...cli, installed: false },
      { ...cli, models: [] },
    ])
      expect(suggestUnassignedRoles(empty, [candidate], 'codex', [])).toBe(empty)
    expect(suggestUnassignedRoles(empty, [cli], 'codex', ['codex'])).toBe(empty)
    expect(routingAgentAllowed('executor', cli, ['codex'], 'codex')).toBe(true)
  })
})
