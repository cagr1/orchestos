import { expect, test } from 'bun:test'
import type { CliHealth } from '../../run/executors/cli-health.ts'
import { createCliUpdateStatus } from './cli-update-status.ts'

const url = new URL('http://localhost/api/cli-updates')
const state: CliHealth = {
  id: 'codex',
  installed: true,
  path: '/bin/codex',
  version: '1.0.0',
  auth: 'ok',
  checkedAt: 0,
  functional: true,
}
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))
test('returns immediately while health waits, then publishes the refresh', async () => {
  let release: (states: CliHealth[]) => void = () => {}
  const health = new Promise<CliHealth[]>((resolve) => {
    release = resolve
  })
  const read = createCliUpdateStatus({
    health: () => health,
    detect: () => ({
      method: 'unknown',
      command: null,
      realPath: '/bin/codex',
      latest: { kind: 'npm', pkg: '@openai/codex' },
    }),
    latest: async () => '2.0.0',
    now: () => 123,
  })
  expect(await read(url).json()).toEqual({ checking: true, checkedAt: null, clis: [] })
  release([state, { ...state, id: 'other' }, { ...state, id: 'claude', installed: false }])
  await settle()
  expect(await read(url).json()).toEqual({
    checking: false,
    checkedAt: 123,
    clis: [
      {
        id: 'codex',
        label: 'Codex',
        version: '1.0.0',
        latestVersion: '2.0.0',
        updateAvailable: true,
        method: 'unknown',
        canUpdate: false,
        reason:
          "OrchestOS can't tell how Codex was installed (/bin/codex). Update it the way you installed it.",
      },
    ],
  })
})
test('stale and forced checks deduplicate in-flight refreshes; invalidation triggers another', async () => {
  let now = 0
  let calls = 0
  const read = createCliUpdateStatus({
    health: async () => {
      calls++
      return [state]
    },
    detect: () => ({
      method: 'standalone',
      command: ['/bin/codex', 'update'],
      realPath: '/bin/codex',
      latest: null,
    }),
    now: () => now,
  })
  read(url)
  read(url)
  expect(calls).toBe(1)
  await settle()
  expect((await read(url).json()).checking).toBe(false)
  now = 30 * 60_000
  expect((await read(url).json()).checking).toBe(true)
  read(url)
  expect(calls).toBe(2)
  await settle()
  expect((await read(new URL(`${url}?refresh=1`)).json()).checking).toBe(true)
  expect(calls).toBe(3)
  await settle()
  read.invalidate()
  expect((await read(url).json()).checking).toBe(true)
  expect(calls).toBe(4)
  await settle()
})

test('refreshNow publishes a fresh health snapshot while an older refresh is pending', async () => {
  const releases: Array<(states: CliHealth[]) => void> = []
  const read = createCliUpdateStatus({
    health: () => new Promise<CliHealth[]>((resolve) => releases.push(resolve)),
    detect: () => ({
      method: 'standalone',
      command: ['/bin/codex', 'update'],
      realPath: '/bin/codex',
      latest: null,
    }),
    now: () => 456,
  })

  read(url)
  expect(releases).toHaveLength(1)
  const fresh = { ...state, version: '2.0.0' }
  const refresh = read.refreshNow()
  expect(releases).toHaveLength(2)
  const releaseFresh = releases[1]
  if (!releaseFresh) throw new Error('fresh refresh was not started')
  releaseFresh([fresh])
  await refresh
  expect(await read(url).json()).toMatchObject({
    checking: false,
    checkedAt: 456,
    clis: [{ id: 'codex', version: '2.0.0' }],
  })
  const releaseStale = releases[0]
  if (!releaseStale) throw new Error('stale refresh was not started')
  releaseStale([state])
  await settle()
  expect(await read(url).json()).toMatchObject({ clis: [{ id: 'codex', version: '2.0.0' }] })
})
