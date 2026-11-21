import { expect, test } from 'bun:test'
import { compareVersions, createCliLatestReader } from './cli-updates.ts'

test('compares numeric segments instead of lexicographic versions', () => {
  expect(compareVersions('0.171.0', '0.155.1')).toBe(1)
  expect(compareVersions('2.1.330', '2.1.99')).toBe(1)
  expect(compareVersions('2.1.99', '2.1.330')).toBe(-1)
  expect(compareVersions('2.1', '2.1.0')).toBe(0)
})

test('deduplicates requests, caches each package for 24 hours and forces refresh', async () => {
  let now = 0
  const calls: string[] = []
  const read = createCliLatestReader(
    async (url) => {
      calls.push(url)
      return { ok: true, text: async () => JSON.stringify({ version: '0.171.0' }) }
    },
    () => now,
  )
  expect(await Promise.all([read('@openai/codex'), read('@openai/codex')])).toEqual([
    '0.171.0',
    '0.171.0',
  ])
  expect(calls).toEqual(['https://registry.npmjs.org/@openai/codex/latest'])
  now = 24 * 60 * 60_000 - 1
  await read('@openai/codex')
  expect(calls).toHaveLength(1)
  now++
  await read('@openai/codex')
  await read('@openai/codex', true)
  await read('@anthropic-ai/claude-code')
  expect(calls).toHaveLength(4)
})

test('network failures return null and retry after one hour', async () => {
  let now = 0
  let calls = 0
  const read = createCliLatestReader(
    async () => {
      if (++calls === 1) throw new Error('offline')
      return { ok: true, text: async () => JSON.stringify({ version: '2.1.330' }) }
    },
    () => now,
  )
  expect(await read('package')).toBeNull()
  now = 60 * 60_000 - 1
  expect(await read('package')).toBeNull()
  expect(calls).toBe(1)
  now++
  expect(await read('package')).toBe('2.1.330')
  expect(calls).toBe(2)
})

test('rejects HTTP failures and malformed versions without throwing', async () => {
  for (const response of [
    { ok: false, text: async () => JSON.stringify({ version: '1.0.0' }) },
    { ok: true, text: async () => JSON.stringify({ version: 123 }) },
    { ok: true, text: async () => JSON.stringify({ version: 'not-a-version' }) },
    { ok: true, text: async () => 'null' },
    { ok: true, text: async () => '{not json' },
    {
      ok: true,
      text: async () => {
        throw new Error('invalid JSON')
      },
    },
  ])
    expect(await createCliLatestReader(async () => response)('package')).toBeNull()
})

test('times out after five seconds even if the fetcher ignores abort, then caches failure', async () => {
  let signal: AbortSignal | undefined
  let calls = 0
  const read = createCliLatestReader(async (_url, init) => {
    signal = init.signal
    calls++
    return new Promise(() => {})
  })
  expect(await read('package')).toBeNull()
  expect(signal?.aborted).toBe(true)
  expect(await read('package')).toBeNull()
  expect(calls).toBe(1)
}, 8_000)
