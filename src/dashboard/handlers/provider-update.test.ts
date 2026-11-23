import { expect, test } from 'bun:test'
import type { CliHealth } from '../../run/executors/cli-health.ts'
import { startServer } from '../server.ts'
import { cliInUse, createProviderUpdater } from './provider-update.ts'

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
      detect: () => ({
        method: 'standalone' as const,
        command: ['/actual/bin/codex', 'update'],
        latest: null,
        realPath: '/actual/bin/codex',
      }),
      inUse: () => null,
      refreshUpdates: async () => {
        invalidated.push('updates')
      },
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
  expect((await update('gemini')).status).toBe(404)
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
    method: 'standalone',
    version: '0.155.1',
  })
  expect(invalidated).toEqual(['health', 'providers', 'models', 'updates'])
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
  expect(await (await first).json()).toEqual({
    ok: false,
    exitCode: 1,
    output: 'update failed',
    method: 'standalone',
    version: '0.155.1',
  })
  expect((await update('codex')).status).toBe(200)
  expect(invalidated).toHaveLength(8)
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
    method: 'standalone',
    version: '0.155.1',
  })
  expect(invalidated).toEqual(['health', 'providers', 'models', 'updates'])
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
    const response = await fetch(`${url}/api/providers/gemini/update`, { method: 'POST' })
    expect(response.status).toBe(401)
    const authenticated = await fetch(`${url}/api/providers/gemini/update`, {
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

test('unknown method refuses without spawn or invalidation', async () => {
  const { dependencies, invalidated } = fixture()
  let spawns = 0
  const update = createProviderUpdater({
    ...dependencies,
    detect: () => ({ method: 'unknown', command: null, latest: null, realPath: '/mystery/codex' }),
    spawn: async () => {
      spawns++
      return { ok: true, exitCode: 0, output: '' }
    },
  })
  const response = await update('codex')
  expect(response.status).toBe(409)
  expect(await response.json()).toEqual({
    ok: false,
    error:
      "OrchestOS can't tell how Codex was installed (/mystery/codex). Update it the way you installed it.",
  })
  expect(spawns).toBe(0)
  expect(invalidated).toEqual([])
})
test('running tasks and chat turns refuse without spawning', async () => {
  for (const kind of ['task', 'chat turn']) {
    const { dependencies } = fixture()
    const update = createProviderUpdater({
      ...dependencies,
      inUse: () => kind,
      spawn: async () => {
        throw new Error('must not spawn')
      },
    })
    const response = await update('codex')
    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({
      ok: false,
      error: `Codex is in use by a running ${kind}. Update it when it finishes.`,
    })
  }
})
test('npm uses manager PATH and returns the refreshed version', async () => {
  const { dependencies } = fixture()
  let refreshed = false
  const update = createProviderUpdater({
    ...dependencies,
    detect: () => ({
      method: 'npm',
      command: ['/npm/bin/npm', 'install', '-g', '@openai/codex@latest'],
      managerDir: '/npm/bin',
      realPath: '/npm/lib/codex',
      latest: null,
    }),
    health: async (refresh) => {
      refreshed = Boolean(refresh)
      return (await dependencies.health()).map((state) => ({
        ...state,
        version: refresh ? '0.171.0' : state.version,
      }))
    },
    spawn: async (command, options) => {
      expect(command).toEqual(['/npm/bin/npm', 'install', '-g', '@openai/codex@latest'])
      expect(options.env.PATH).toBe('/npm/bin:/cli/search/path')
      return { ok: true, exitCode: 0, output: 'done' }
    },
  })
  expect(await (await update('codex')).json()).toMatchObject({
    ok: true,
    method: 'npm',
    version: '0.171.0',
  })
  expect(refreshed).toBe(true)
})

test('waits for the update status refresh before returning the response', async () => {
  const { dependencies } = fixture()
  let finishRefresh = () => {}
  let refreshStarted = false
  const update = createProviderUpdater({
    ...dependencies,
    refreshUpdates: () => {
      refreshStarted = true
      return new Promise<void>((resolve) => {
        finishRefresh = resolve
      })
    },
  })
  let responseReturned = false
  const responsePromise = update('codex').then((response) => {
    responseReturned = true
    return response
  })
  await new Promise((resolve) => setTimeout(resolve, 0))
  expect(refreshStarted).toBe(true)
  expect(responseReturned).toBe(false)
  finishRefresh()
  expect((await responsePromise).status).toBe(200)
  expect(responseReturned).toBe(true)
})

const watchedTask = {
  root: '/project',
  task_id: 'task-1',
  project_id: null,
  session_id: null,
  pid: 123,
  created_at: 'now',
}

function cliInUseDependencies(engine: string | undefined) {
  return {
    rows: () => [watchedTask],
    runner: () => false,
    alive: () => true,
    tasks: () => [{ id: 'task-1', engine }],
    chatAgents: () => [],
  }
}

test('cliInUse treats an alive PID as a task when runner inspection fails', () => {
  expect(cliInUse('codex', cliInUseDependencies('codex'))).toBe('task')
})

test('cliInUse ignores a dead PID when runner inspection fails', () => {
  expect(cliInUse('codex', { ...cliInUseDependencies('codex'), alive: () => false })).toBeNull()
})

test('cliInUse ignores a task assigned to another CLI', () => {
  expect(cliInUse('codex', cliInUseDependencies('external'))).toBeNull()
})

test('cliInUse fails closed for an unknown task engine', () => {
  expect(cliInUse('codex', cliInUseDependencies('unknown-engine'))).toBe('task')
})

test('cliInUse treats an unknown chat agent as an active chat turn', () => {
  expect(
    cliInUse('codex', { ...cliInUseDependencies('codex'), chatAgents: () => [undefined] }),
  ).toBe('chat turn')
})
