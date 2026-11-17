import { describe, expect, it } from 'bun:test'
import { createDashboardBuildHandler } from '../handlers/dashboard-build.ts'

describe('GET /api/dashboard-build handler', () => {
  it('preserves the start commit and time while reading HEAD on every request', async () => {
    const root = '/fake/orchestos'
    const first = 'a'.repeat(40)
    const second = 'b'.repeat(40)
    let head: string | null = first
    const roots: string[] = []
    const handler = createDashboardBuildHandler(root, {
      readHeadCommit(path) {
        roots.push(path)
        return head
      },
    })
    const initial = await handler().json()
    expect(initial).toEqual({
      startedAt: expect.any(String),
      startCommit: first,
      headCommit: first,
    })
    expect(new Date(initial.startedAt).toISOString()).toBe(initial.startedAt)
    head = second
    expect(await handler().json()).toEqual({ ...initial, headCommit: second })
    head = null
    expect(await handler().json()).toEqual({ ...initial, headCommit: null })
    expect(roots).toEqual([root, root, root, root])
  })

  it('returns null commits for an installation without git', async () => {
    const handler = createDashboardBuildHandler('/installed/orchestos', {
      readHeadCommit: () => null,
    })
    expect(await handler().json()).toEqual({
      startedAt: expect.any(String),
      startCommit: null,
      headCommit: null,
    })
  })
})
