import { expect, test } from 'bun:test'
import type { CliHealth } from '../../run/executors/cli-health.ts'
import { startServer } from '../server.ts'
import { createProviderUpdater } from './provider-update.ts'

function fixture() {
  const invalidated: string[] = []
  const health = Object.assign(
    async (): Promise<CliHealth[]> => [
      {
        id: 'codex',
        installed: true,
        path: '/actual/bin/codex',
        version: '0.155.1',
        auth: 'ok',
        checkedAt: 0,
        functional: true,
      },
    ],
    {
      invalidate: () => {
        invalidated.push('health')
      },
    },
  )
  return {
    invalidated,
    dependencies: {
      health,
      invalidateHealth: health.invalidate,
      searchPath: () => '/cli/search/path',
      invalidateProviders: () => {
        invalidated.push('providers')
      },
      invalidateModels: () => {
        invalidated.push('models')
      },
    },
  }
}

test('rejects unsupported CLIs without spawning or invalidating caches', async () => {
  const { dependencies, invalidated } = fixture()
  let spawns = 0
  const update = createProviderUpdater({
    ...dependencies,
    spawn: async () => {
      spawns++
      return { ok: true, exitCode: 0, output: '' }
    },
  })
  expect((await update('opencode')).status).toBe(404)
  expect((await update('unknown')).status).toBe(404)
  expect(spawns).toBe(0)
  expect(invalidated).toEqual([])
})

test('uses the health binary, shared PATH and timeout, truncates output and invalidates all caches', async () => {
  const { dependencies, invalidated } = fixture()
  const update = createProviderUpdater({
    ...dependencies,
    spawn: async (command, options) => {
      expect(command).toEqual(['/actual/bin/codex', 'update'])
      expect(options.env.PATH).toBe('/cli/search/path')
      expect(options.timeout).toBe(300_000)
      return { ok: true, exitCode: 0, output: `prefix${'x'.repeat(4_000)}` }
    },
  })
  expect(await (await update('codex')).json()).toEqual({
    ok: true,
    exitCode: 0,
    output: 'x'.repeat(4_000),
  })
  expect(invalidated).toEqual(['health', 'providers', 'models'])
})

test('rejects concurrent updates with 409 and releases the lock after failure', async () => {
  const { dependencies, invalidated } = fixture()
  let release = () => {}
  const waiting = new Promise<void>((resolve) => {
    release = resolve
  })
  const update = createProviderUpdater({
    ...dependencies,
    spawn: async () => {
      await waiting
      return { ok: false, exitCode: 1, output: 'update failed' }
    },
  })
  const first = update('codex')
  expect((await update('claude')).status).toBe(409)
  release()
  expect(await (await first).json()).toEqual({ ok: false, exitCode: 1, output: 'update failed' })
  expect((await update('codex')).status).toBe(200)
  expect(invalidated).toHaveLength(6)
})

test('spawn errors are reported and still invalidate caches', async () => {
  const { dependencies, invalidated } = fixture()
  const update = createProviderUpdater({
    ...dependencies,
    spawn: async () => {
      throw new Error('spawn failed')
    },
  })
  expect(await (await update('codex')).json()).toEqual({
    ok: false,
    exitCode: null,
    output: 'Error: spawn failed',
  })
  expect(invalidated).toEqual(['health', 'providers', 'models'])
})

test('does not spawn an uninstalled CLI', async () => {
  const { dependencies } = fixture()
  const update = createProviderUpdater({
    ...dependencies,
    spawn: async () => {
      throw new Error('must not spawn')
    },
  })
  expect((await update('claude')).status).toBe(404)
})

test('the update route requires the dashboard token and rejects unsupported CLIs', async () => {
  const previous = process.env.ORCHESTOS_DASHBOARD_TOKEN
  process.env.ORCHESTOS_DASHBOARD_TOKEN = 'cli-update-test-token'
  const { server, url } = startServer(0)
  try {
    const response = await fetch(`${url}/api/providers/opencode/update`, { method: 'POST' })
    expect(response.status).toBe(401)
    const authenticated = await fetch(`${url}/api/providers/opencode/update`, {
      method: 'POST',
      headers: { 'x-orchestos-token': 'cli-update-test-token' },
    })
    expect(authenticated.status).toBe(404)
    expect(await authenticated.json()).toEqual({ error: 'CLI update is not supported' })
  } finally {
    server.stop(true)
    if (previous === undefined) delete process.env.ORCHESTOS_DASHBOARD_TOKEN
    else process.env.ORCHESTOS_DASHBOARD_TOKEN = previous
  }
})
