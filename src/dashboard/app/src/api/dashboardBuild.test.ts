import { afterEach, describe, expect, it } from 'bun:test'
import { getDashboardBuild, staleBuild } from './dashboardBuild'

const originalFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('dashboard build client', () => {
  it('fetches build metadata and passes the abort signal', async () => {
    const info = { startedAt: '2026-11-17T00:00:00.000Z', startCommit: null, headCommit: null }
    const controller = new AbortController()
    globalThis.fetch = (async (path, init) => {
      expect(path).toBe('/api/dashboard-build')
      expect(init?.signal).toBe(controller.signal)
      return Response.json(info)
    }) as typeof fetch
    expect(await getDashboardBuild(controller.signal)).toEqual(info)
  })

  it('rejects an unsuccessful response', async () => {
    globalThis.fetch = (async () => new Response(null, { status: 503 })) as unknown as typeof fetch
    await expect(getDashboardBuild()).rejects.toThrow('Request failed (503)')
  })
})

describe('staleBuild', () => {
  const startedAt = '2026-11-17T00:00:00.000Z'

  it('returns shortened commits only when both SHAs exist and differ', () => {
    expect(
      staleBuild({ startedAt, startCommit: 'a'.repeat(40), headCommit: 'b'.repeat(40) }),
    ).toEqual({ from: 'aaaaaaa', to: 'bbbbbbb' })
    // Compare the complete SHA, even when the displayed prefixes happen to match.
    expect(staleBuild({ startedAt, startCommit: 'abcdefg1', headCommit: 'abcdefg2' })).toEqual({
      from: 'abcdefg',
      to: 'abcdefg',
    })
  })

  it('returns null for matching or missing commits', () => {
    for (const [startCommit, headCommit] of [
      ['same', 'same'],
      [null, 'head'],
      ['start', null],
      [null, null],
    ]) {
      expect(
        staleBuild({ startedAt, startCommit: startCommit ?? null, headCommit: headCommit ?? null }),
      ).toBeNull()
    }
  })
})
