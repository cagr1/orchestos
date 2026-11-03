import { expect, test } from 'bun:test'
import type { SessionStatus } from '../../../scripts/session-status.ts'
import { createCliHealthReader } from '../../run/executors/cli-health.ts'
import { KNOWN_CLIS } from '../../run/executors/cli-registry.ts'
import { handleApiSessionStatus } from './session-status.ts'

test('session endpoint exposes quota capability and current health using fake probes, including cached reads', async () => {
  let loggedIn = false
  const reader = createCliHealthReader({
    env: {},
    home: '/fake',
    readFile: () => '{"provider":{"type":"api"}}',
    loginPath: () => null,
    which: (binary) => (binary === 'gemini' ? null : `/fake/${binary}`),
    now: () => 0,
    command: async () => '1.2.3',
    authCommand: async (binary) => ({
      stdout: binary.endsWith('/claude')
        ? JSON.stringify({ loggedIn })
        : binary.endsWith('/codex')
          ? 'Logged in using ChatGPT'
          : '2 credentials',
      exitCode: 0,
    }),
  })
  const statuses: SessionStatus[] = KNOWN_CLIS.map((cli) => ({
    id: cli.id,
    binary: cli.binary,
    icon: cli.icon,
    label: cli.label,
    readBoundary: cli.readBoundary,
    installed: cli.id !== 'gemini',
    available: false,
    observedAt: null,
    context: null,
    rateLimits: null,
  }))
  // An unregistered status never gains capability or health by accident.
  statuses.push({ ...statuses[0]!, id: 'unknown-cli' })
  const deps = { health: () => reader(true), statuses: async () => statuses }
  const response = await handleApiSessionStatus('/fake/UI.46-quota', deps)
  const body = await response.json()
  expect(body.clis).toHaveLength(statuses.length)
  for (const cli of body.clis) {
    expect(cli.quotaSource).toBe(['claude', 'codex'].includes(cli.id))
    expect(cli.functional).toBe(!['claude', 'gemini', 'unknown-cli'].includes(cli.id))
  }
  expect(body.clis[0]).not.toHaveProperty('authDetail')
  expect(body.clis[0]).not.toHaveProperty('path')
  loggedIn = true
  const cached = await handleApiSessionStatus('/fake/UI.46-quota', deps)
  expect((await cached.json()).clis[0]).toMatchObject({
    id: 'claude',
    functional: true,
    quotaSource: true,
  })
})
