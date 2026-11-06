import { expect, test } from 'bun:test'
import { devSessionAction, isFunctionalDevCli, resolveNewSessionAgent } from './new-session-agent'

test('resolves the chosen agent role rather than the orchestrator of another agent', () => {
  expect(
    resolveNewSessionAgent('codex', {
      orchestrator: { agent: 'claude', model: 'opus', effort: 'high' },
      executor: { agent: 'codex', model: 'gpt', effort: 'medium' },
    }),
  ).toEqual({ agent: 'codex', model: 'gpt', effort: 'medium' })
})
test('unassigned agents retain the CLI default without an explicit model or effort', () => {
  expect(resolveNewSessionAgent('claude', { executor: null })).toEqual({ agent: 'claude' })
  expect(resolveNewSessionAgent('codex', undefined)).toEqual({ agent: 'codex' })
})
test('multiple roles use orchestrator, executor, reviewer, auxiliary priority', () => {
  const order = ['orchestrator', 'executor', 'reviewer', 'auxiliary']
  for (let index = 0; index < order.length; index++) {
    const roles = Object.fromEntries(
      order
        .slice(index)
        .reverse()
        .map((role) => [
          role,
          {
            agent: 'codex',
            model: role,
            effort: 'low',
          },
        ]),
    )
    expect(resolveNewSessionAgent('codex', roles).model).toBe(order[index])
  }
})

test('Dev + excludes signed-out CLIs and keeps functional unknown-auth CLIs and terminals', () => {
  const catalogs = [
    { id: 'claude', chat: true, installed: true, auth: 'missing', functional: false },
    { id: 'codex', chat: true, installed: true, auth: 'ok', functional: true },
    { id: 'custom', chat: true, installed: true, auth: 'unknown', functional: true },
    { id: 'absent', chat: true, installed: false, auth: 'unknown', functional: false },
    { id: 'opencode', chat: false, terminal: true, installed: true, auth: 'ok', functional: true },
  ]
  expect(catalogs.filter(isFunctionalDevCli).map((cli) => cli.id)).toEqual([
    'codex',
    'custom',
    'opencode',
  ])
})

test('Dev menu includes functional terminal adapters and excludes nonfunctional ones', () => {
  const catalogs = [
    { id: 'claude', chat: true, functional: true },
    { id: 'codex', chat: true, functional: true },
    { id: 'opencode', chat: false, terminal: true, functional: true },
  ]
  expect(catalogs.filter(isFunctionalDevCli).map(devSessionAction)).toEqual([
    { kind: 'new-tab', agent: 'claude' },
    { kind: 'new-tab', agent: 'codex' },
    { kind: 'create-session', agent: 'opencode' },
  ])
  expect(isFunctionalDevCli({ ...catalogs[2], functional: false })).toBe(false)
  expect(isFunctionalDevCli({ id: 'unsupported', chat: false, functional: true })).toBe(false)
})
