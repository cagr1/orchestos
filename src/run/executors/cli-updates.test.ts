import { expect, test } from 'bun:test'
import { compareVersions, createCliLatestReader, createGithubLatestReader } from './cli-updates.ts'

test('compares numeric segments instead of lexicographic versions', () => {
  expect(compareVersions('0.171.0', '0.155.1')).toBe(1)
  expect(compareVersions('2.1.330', '2.1.99')).toBe(1)
  expect(compareVersions('2.1.99', '2.1.330')).toBe(-1)
  expect(compareVersions('2.1', '2.1.0')).toBe(0)
})

test('deduplicates requests, caches each package for 6 hours and forces refresh', async () => {
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
  now = 6 * 60 * 60_000 - 1
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

test('GitHub chooses the highest stable semver, sends headers and caches six hours', async () => {
  let now = 0
  let calls = 0
  const read = createGithubLatestReader(
    async (url, init) => {
      calls++
      expect(url).toBe('https://api.github.com/repos/anomalyco/opencode/releases?per_page=30')
      expect(init.headers).toEqual({
        Accept: 'application/vnd.github+json',
        'User-Agent': 'orchestos',
      })
      return {
        ok: true,
        text: async () =>
          JSON.stringify([
            ...['v2.3.2', 'v2.3.1', 'v1.19.6', 'process-daemon-v0.6.0', 'v2.3.0'].map(
              (tag_name) => ({ tag_name, draft: false, prerelease: false }),
            ),
            { tag_name: 'v9.0.0', draft: true, prerelease: false },
            { tag_name: 'v8.0.0', draft: false, prerelease: true },
          ]),
      }
    },
    () => now,
  )
  expect(await Promise.all([read('anomalyco/opencode'), read('anomalyco/opencode')])).toEqual([
    '2.3.2',
    '2.3.2',
  ])
  expect(calls).toBe(1)
  now = 6 * 60 * 60_000 - 1
  await read('anomalyco/opencode')
  expect(calls).toBe(1)
  now++
  await read('anomalyco/opencode')
  expect(calls).toBe(2)
})
test('GitHub rejects bad JSON, invalid shape, non-ok and empty stable releases', async () => {
  for (const [ok, body] of [
    [false, '[]'],
    [true, '{bad'],
    [true, '{}'],
    [true, '[{"tag_name":"v2.0.0"}]'],
    [true, '[]'],
  ] as const) {
    expect(
      await createGithubLatestReader(async () => ({ ok, text: async () => body }))('repo'),
    ).toBeNull()
  }
})
test('GitHub times out and caches failures for one hour', async () => {
  let now = 0
  let calls = 0
  let signal: AbortSignal | undefined
  const read = createGithubLatestReader(
    async (_url, init) => {
      signal = init.signal
      if (++calls === 1) return new Promise(() => {})
      return {
        ok: true,
        text: async () => '[{"tag_name":"2.3.2","draft":false,"prerelease":false}]',
      }
    },
    () => now,
  )
  expect(await read('repo')).toBeNull()
  expect(signal?.aborted).toBe(true)
  now = 60 * 60_000 - 1
  expect(await read('repo')).toBeNull()
  expect(calls).toBe(1)
  now++
  expect(await read('repo')).toBe('2.3.2')
}, 8000)
