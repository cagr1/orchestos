import { afterEach, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expiredDates, preserveFailure, runFlows, selectFlows } from './nightly-ui-gates.ts'

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

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
