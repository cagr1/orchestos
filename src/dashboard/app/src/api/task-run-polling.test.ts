import { expect, test } from 'bun:test'
import { commitAndRunProjectTask, runProjectTask } from './chat'
import { runTask } from './tasks'

const launchers = {
  chat: () => runProjectTask('t', 'p'),
  'commit-run': () => commitAndRunProjectTask('t', ['out.txt'], 'p'),
  settings: () => runTask('t', 'p', () => {}),
}

type Snapshot = {
  status: string
  retryCount: number
  retryReason: string | null
  runId: string | null
}

async function poll(launch: () => Promise<void>, snapshots: Snapshot[]) {
  const originalFetch = globalThis.fetch
  const originalNow = Date.now
  const originalTimeout = globalThis.setTimeout
  let now = 0
  let reads = 0
  let posts = 0
  Date.now = () => now
  globalThis.setTimeout = ((handler: () => void) => {
    now += 60_000
    handler()
    return 0
  }) as unknown as typeof setTimeout
  globalThis.fetch = (async (_input, init) => {
    if (init?.method === 'POST') {
      posts++
      return Response.json({ ok: true })
    }
    const snapshot = snapshots[Math.min(reads++, snapshots.length - 1)]
    if (!snapshot) throw new Error('Missing test snapshot')
    return Response.json({ exists: true, tasks: [{ id: 't', description: 'Test', ...snapshot }] })
  }) as typeof fetch
  try {
    let error: string | undefined
    try {
      await launch()
    } catch (cause) {
      error = (cause as Error).message
    }
    return { reads, posts, error }
  } finally {
    globalThis.fetch = originalFetch
    Date.now = originalNow
    globalThis.setTimeout = originalTimeout
  }
}

const pending: Snapshot = { status: 'pending', retryCount: 0, retryReason: null, runId: null }
const failed: Snapshot = {
  status: 'pending',
  retryCount: 1,
  retryReason: 'missing declared output(s): out.txt',
  runId: 'r1',
}

for (const [name, launch] of Object.entries(launchers)) {
  test(`${name}: pending → running → pending with a failed attempt releases the action`, async () => {
    expect(await poll(launch, [pending, { ...pending, status: 'running' }, failed])).toEqual({
      reads: 3,
      posts: 1,
      error: `Retry scheduled: ${failed.retryReason}`,
    })
  })

  test(`${name}: stale failure before retry does not complete the new attempt`, async () => {
    expect(
      await poll(launch, [
        failed,
        failed,
        { ...failed, status: 'running', runId: 'r2' },
        { ...failed, retryCount: 2, runId: 'r2' },
      ]),
    ).toEqual({ reads: 4, posts: 1, error: `Retry scheduled: ${failed.retryReason}` })
  })

  test(`${name}: a new run can fail pending without changing the retry counter`, async () => {
    expect(await poll(launch, [failed, { ...failed, runId: 'r2' }])).toEqual({
      reads: 2,
      posts: 1,
      error: `Retry scheduled: ${failed.retryReason}`,
    })
  })

  test(`${name}: the CLI can increment retries without persisting a new run id`, async () => {
    expect(await poll(launch, [failed, { ...failed, retryCount: 2 }])).toEqual({
      reads: 2,
      posts: 1,
      error: `Retry scheduled: ${failed.retryReason}`,
    })
  })

  test(`${name}: an unchanged pending task keeps the full ten-minute deadline`, async () => {
    const result = await poll(launch, [pending])
    expect(result.error).toBe('Task t remained pending after 10 minutes')
    expect(result.reads).toBeGreaterThanOrEqual(10)
  })

  test(`${name}: permanent failure surfaces its reason`, async () => {
    expect(await poll(launch, [pending, { ...failed, status: 'failed_permanent' }])).toEqual({
      reads: 2,
      posts: 1,
      error: failed.retryReason,
    })
  })

  test(`${name}: dirty tree pending ends the wait without a failed attempt`, async () => {
    const result = await poll(launch, [
      pending,
      { ...pending, retryReason: 'uncommitted changes: out.txt' },
    ])
    expect(result.reads).toBe(2)
    expect(result.error).toBe(name === 'settings' ? 'uncommitted changes: out.txt' : undefined)
  })

  test(`${name}: a new active run is still awaited until done`, async () => {
    expect(
      await poll(launch, [
        pending,
        { ...pending, status: 'running', runId: 'r1' },
        { ...pending, status: 'done', runId: 'r1' },
      ]),
    ).toEqual({ reads: 3, posts: 1, error: undefined })
  })
}
