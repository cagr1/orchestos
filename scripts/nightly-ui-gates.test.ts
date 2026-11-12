import { afterEach, expect, mock, test } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  expiredDates,
  parseSleeps,
  preserveFailure,
  runFlows,
  runNightly,
  selectFlows,
} from './nightly-ui-gates.ts'

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

test.each(['node', 'bun', 'git'])(
  'publishes preparationError when %s is missing, without running commands or flows',
  async (missing) => {
    const base = mkdtempSync(join(tmpdir(), 'nightly-preparation-'))
    roots.push(base)
    const command = mock(async () => ({ code: 0, output: '' }))
    const prepared = await runNightly({
      base,
      which: (binary) => (binary === missing ? null : `/fixture/bin/${binary}`),
      command,
    })
    expect(prepared).toEqual({ prepared: false, failed: 0 })
    expect(command).not.toHaveBeenCalled()
    const json = readFileSync(join(base, 'ui-gates-latest.json'), 'utf8')
    const result = JSON.parse(json)
    expect(result).toEqual({
      startedAt: expect.any(String),
      finishedAt: expect.any(String),
      sha: null,
      total: 0,
      passed: 0,
      flaky: [],
      failed: [],
      preparationError: `falta ${missing} en el PATH del LaunchAgent; reinstalar con bun run nightly:install`,
    })
    expect(Number.isFinite(Date.parse(result.startedAt))).toBe(true)
    expect(Date.parse(result.finishedAt)).toBeGreaterThanOrEqual(Date.parse(result.startedAt))
    expect(readFileSync(join(base, result.startedAt.slice(0, 10), 'ui-gates.json'), 'utf8')).toBe(
      json,
    )
    expect(existsSync(join(base, 'ui-gates-latest.json.tmp'))).toBe(false)
    expect(existsSync(join(base, 'running'))).toBe(false)
  },
)

test('parseSleeps accepts only Sleep events in the inclusive time range', () => {
  const lines = [
    '2026-11-10 08:03:21 -0500 Sleep               Entering Sleep state due to Maintenance Sleep',
    '2026-11-10 08:03:22 -0500 DarkWake            DarkWake to FullWake',
    '2026-11-10 08:03:23 -0500 Assertions          PID 11324(chrome-headless-shell) Created assertion',
    '2026-11-10 08:03:24 -0500 Wake                Wake from Deep Idle',
    '2026-11-10 08:03:25 -0500 Sleep               Entering Sleep state',
    'not a dated Sleep line',
    '2026-11-10 08:03:26 -0500 DarkWake            Sleep is mentioned, but this is not Sleep',
  ]
  const log = lines.join('\n')
  const expected = lines.filter((_, index) => index === 0 || index === 4)
  expect(
    parseSleeps(log, new Date('2026-11-10T13:03:21Z'), new Date('2026-11-10T13:03:25Z')),
  ).toEqual(expected)
})

test('releases keep-awake after preparation failure', async () => {
  const base = mkdtempSync(join(tmpdir(), 'nightly-keep-awake-failure-'))
  roots.push(base)
  const release = mock(() => {})
  const prepared = await runNightly({
    base,
    keepAwake: () => release,
    which: () => '/fixture/bin/tool',
    command: mock(async () => ({ code: 1, output: 'fetch failed' })),
  })
  expect(prepared).toEqual({ prepared: false, failed: 0 })
  expect(release).toHaveBeenCalledTimes(1)
  expect(existsSync(join(base, 'running'))).toBe(false)
})

test.each([{ sleepLog: '', hasSleeps: false }, { hasSleeps: true }])(
  'publishes sleeps only when an in-range Sleep event exists',
  async ({ hasSleeps }) => {
    const base = mkdtempSync(join(tmpdir(), 'nightly-sleeps-'))
    roots.push(base)
    const release = mock(() => {})
    let boundary = 0
    const command = mock(async (args: string[]) => {
      if (args[0] === 'git' && args[1] === 'worktree' && args[2] === 'add') {
        const flowDir = join(base, 'worktree/scripts/ui-gate/flows')
        mkdirSync(flowDir, { recursive: true })
        writeFileSync(join(flowDir, 'smoke.mjs'), '')
        return { code: 0, output: '' }
      }
      if (args[0] === 'git' && args[1] === 'rev-parse') return { code: 0, output: 'abc123' }
      if (args[0] === 'bun' && args[1] === 'run' && args[2] === 'ui:gate') {
        boundary = Math.ceil(Date.now() / 1000) * 1000
        while (Date.now() <= boundary) await new Promise((resolve) => setTimeout(resolve, 10))
      }
      return { code: 0, output: '' }
    })
    const prepared = await runNightly({
      base,
      keepAwake: () => release,
      sleepLog: () => {
        if (!hasSleeps) return ''
        const date = new Date(boundary).toISOString()
        return `${date.slice(0, 10)} ${date.slice(11, 19)} +0000 Sleep               Entering Sleep state`
      },
      which: () => '/fixture/bin/tool',
      command: command as never,
    })
    expect(prepared).toEqual({ prepared: true, failed: 0 })
    expect(release).toHaveBeenCalledTimes(1)
    const result = JSON.parse(readFileSync(join(base, 'ui-gates-latest.json'), 'utf8'))
    expect('sleeps' in result).toBe(hasSleeps)
    if (hasSleeps) expect(result.sleeps).toHaveLength(1)
  },
)

test('runs each flow once, retries only failures and builds passed/flaky/failed JSON', async () => {
  const calls: string[] = []
  const times = [new Date('2026-11-08T01:30:00Z'), new Date('2026-11-08T02:00:00Z')]
  const result = await runFlows(
    ['green', 'unstable', 'red'],
    'abc123',
    async (flow, n) => {
      calls.push(`${flow}:${n}`)
      return {
        ok: flow === 'green' || (flow === 'unstable' && n === 2),
        error: `${flow}-${n}`,
        evidence:
          flow === 'green' || (flow === 'unstable' && n === 2) ? [] : [`/${flow}/${n}/result.json`],
      }
    },
    () => times.shift() as Date,
  )
  expect(calls).toEqual(['green:1', 'unstable:1', 'unstable:2', 'red:1', 'red:2'])
  expect(result).toEqual({
    startedAt: '2026-11-08T01:30:00.000Z',
    finishedAt: '2026-11-08T02:00:00.000Z',
    sha: 'abc123',
    total: 3,
    passed: 1,
    flaky: [{ flow: 'unstable', firstError: 'unstable-1', evidence: ['/unstable/1/result.json'] }],
    failed: [
      { flow: 'red', error: 'red-2', evidence: ['/red/1/result.json', '/red/2/result.json'] },
    ],
  })
})

test('runner exceptions fail the flow without abandoning later flows', async () => {
  const result = await runFlows(['broken', 'green'], 'sha', async (flow) => {
    if (flow === 'broken') throw new Error('spawn failed')
    return { ok: true, error: '', evidence: [] }
  })
  expect(result.failed[0]?.error).toContain('spawn failed')
  expect(result.passed).toBe(1)
  expect(result.total).toBe(2)
  expect(result.finishedAt).not.toBe('')
})

test('retains today and six previous dates, ignoring worktree, logs and latest JSON', () => {
  expect(
    expiredDates(
      [
        '2026-11-01',
        '2026-11-02',
        '2026-11-03',
        '2026-11-08',
        '2026-11-09',
        'worktree',
        'ui-gates-latest.json',
        'launchd.log',
      ],
      new Date('2026-11-08T01:30:00Z'),
    ),
  ).toEqual(['2026-11-01'])
  expect(expiredDates(['2026-10-25', '2026-10-26'], new Date('2026-11-01T01:30:00Z'))).toEqual([
    '2026-10-25',
  ])
})

test('only excludes opencode-terminal when its required binary is unavailable', () => {
  const flows = ['smoke', 'opencode-terminal', 'codex-live', 'chat-streaming']
  expect(selectFlows(flows, false)).toEqual(['chat-streaming', 'codex-live', 'smoke'])
  expect(selectFlows(flows, true)).toEqual([
    'chat-streaming',
    'codex-live',
    'opencode-terminal',
    'smoke',
  ])
})

test('archives result and captures so they survive runDir cleanup, without copying gate HOME', () => {
  const root = mkdtempSync(join(tmpdir(), 'nightly-test-'))
  const external = mkdtempSync(join(tmpdir(), 'nightly-external-'))
  roots.push(root, external)
  const result = join(root, 'result.json')
  const shot = join(root, 'failure.png')
  const outside = join(external, 'private.png')
  writeFileSync(shot, 'screenshot')
  writeFileSync(outside, 'private')
  writeFileSync(join(root, 'credentials.json'), 'never archive')
  writeFileSync(result, JSON.stringify([{ pass: false, capturas: [shot, outside] }]))
  const destination = join(root, 'archive')
  const evidence = preserveFailure(`FAIL smoke\nEVIDENCE ${result}\n`, destination)
  expect(evidence).toEqual([
    result,
    root,
    join(destination, 'result.json'),
    join(destination, '0-0-failure.png'),
  ])
  rmSync(result)
  rmSync(shot)
  expect(JSON.parse(readFileSync(join(destination, 'result.json'), 'utf8'))[0].pass).toBe(false)
  expect(readFileSync(join(destination, '0-0-failure.png'), 'utf8')).toBe('screenshot')
})

function nightlyFixture() {
  const base = mkdtempSync(join(tmpdir(), 'nightly-aud26-'))
  roots.push(base)
  return {
    base,
    which: () => '/fixture/bin/tool',
    keepAwake: () => () => {},
    sleepLog: () => '',
    command: async (args: string[]) => {
      if (args[1] === 'worktree' && args[2] === 'add') {
        const dir = join(base, 'worktree/scripts/ui-gate/flows')
        mkdirSync(dir, { recursive: true })
        writeFileSync(join(dir, 'smoke.mjs'), '')
      }
      return { code: args[2] === 'ui:gate' ? 1 : 0, output: args[1] === 'rev-parse' ? 'sha' : '' }
    },
  }
}

test('AUD.26 reports prepared but failed when every flow is red', async () => {
  expect(await runNightly(nightlyFixture())).toEqual({ prepared: true, failed: 1 })
})

test('AUD.26 recovers a dead PID lock and records recovery', async () => {
  const options = nightlyFixture()
  const child = Bun.spawn(['true'])
  await child.exited
  mkdirSync(join(options.base, 'running'))
  writeFileSync(join(options.base, 'running/pid'), String(child.pid))
  expect(await runNightly(options)).toEqual({ prepared: true, failed: 1 })
  const log = join(options.base, new Date().toISOString().slice(0, 10), 'ui-gates.log')
  expect(readFileSync(log, 'utf8')).toContain(`candado huérfano de PID ${child.pid} recuperado`)
})

test('AUD.26 recovers a lock with no PID', async () => {
  const options = nightlyFixture()
  mkdirSync(join(options.base, 'running'))
  expect(await runNightly(options)).toEqual({ prepared: true, failed: 1 })
})

test('AUD.26 keeps a live PID lock', async () => {
  const options = nightlyFixture()
  mkdirSync(join(options.base, 'running'))
  writeFileSync(join(options.base, 'running/pid'), String(process.pid))
  await expect(runNightly(options)).rejects.toThrow('corrida ya activa')
  expect(readFileSync(join(options.base, 'running/pid'), 'utf8')).toBe(String(process.pid))
})
