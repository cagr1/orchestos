import { expect, test } from 'bun:test'
import type { CliHealth } from '../../run/executors/cli-health.ts'
import { handleApiChatCliModels } from './chat.ts'

export const healthFixture: CliHealth[] = [
  {
    id: 'claude',
    installed: true,
    path: '/fake/claude',
    version: '1.0.0',
    auth: 'missing',
    functional: false,
    checkedAt: 0,
  },
  {
    id: 'codex',
    installed: true,
    path: '/fake/codex',
    version: '1.0.0',
    auth: 'ok',
    functional: true,
    checkedAt: 0,
  },
  {
    id: 'opencode',
    installed: true,
    path: '/fake/opencode',
    version: '1.0.0',
    auth: 'unknown',
    functional: true,
    checkedAt: 0,
  },
]

test('chat CLI catalog exposes current health without hiding signed-out CLIs or probing real binaries', async () => {
  const catalogs = healthFixture.map((cli) => ({
    id: cli.id,
    installed: true,
    chat: cli.id !== 'opencode',
    models: [],
    efforts: [],
  }))
  const response = await handleApiChatCliModels({
    catalogs: async () => catalogs,
    health: async () => healthFixture,
  })
  expect(await response.json()).toEqual(
    catalogs.map((catalog, index) => ({
      ...catalog,
      auth: healthFixture[index]!.auth,
      functional: healthFixture[index]!.functional,
    })),
  )
  healthFixture[0]!.auth = 'ok'
  healthFixture[0]!.functional = true
  const refreshed = await handleApiChatCliModels({
    catalogs: async () => catalogs,
    health: async () => healthFixture,
  })
  expect((await refreshed.json())[0]).toMatchObject({ id: 'claude', auth: 'ok', functional: true })
})
