import { expect, test } from 'bun:test'
import { isFunctionalChatCli, resolveNewSessionAgent } from './new-session-agent'

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

test('Dev + excludes signed-out chat CLIs and keeps functional unknown-auth CLIs; terminals stay excluded', () => {
  const catalogs = [
    { id: 'claude', chat: true, installed: true, auth: 'missing', functional: false },
    { id: 'codex', chat: true, installed: true, auth: 'ok', functional: true },
    { id: 'custom', chat: true, installed: true, auth: 'unknown', functional: true },
    { id: 'absent', chat: true, installed: false, auth: 'unknown', functional: false },
    { id: 'opencode', chat: false, installed: true, auth: 'ok', functional: true },
  ]
  expect(catalogs.filter(isFunctionalChatCli).map((cli) => cli.id)).toEqual(['codex', 'custom'])
})
