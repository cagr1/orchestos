import { afterEach, expect, test } from 'bun:test'
import { getRunApprovals, resolveRunApproval } from './runs'

const originalFetch = globalThis.fetch
afterEach(() => {
  globalThis.fetch = originalFetch
})

test('approval requests keep the project header and encode the run id', async () => {
  const pending = [
    { runId: 'run/a', approvalId: 'a', kind: 'command' as const, detail: { command: 'mkdir a' } },
  ]
  globalThis.fetch = (async (url, init) => {
    expect(url).toBe('/api/runs/run%2Fa/approval')
    expect(new Headers(init?.headers).get('x-orchestos-project-id')).toBe('project')
    return Response.json({ pending, events: [] })
  }) as unknown as typeof fetch
  expect(await getRunApprovals('run/a', 'project')).toEqual(pending)
})

test('all three decisions send the approval id and project scope', async () => {
  for (const decision of ['approve', 'reject', 'approve-always'] as const) {
    globalThis.fetch = (async (url, init) => {
      expect(url).toBe('/api/runs/run/approval')
      expect(init?.method).toBe('POST')
      expect(new Headers(init?.headers).get('x-orchestos-project-id')).toBe('project')
      expect(JSON.parse(init?.body as string)).toEqual({ approvalId: 'approval', decision })
      return Response.json({ ok: true })
    }) as unknown as typeof fetch
    await resolveRunApproval('run', 'project', 'approval', decision)
  }
})

test('GET and POST surface server errors and reject an empty approval response', async () => {
  globalThis.fetch = (async () =>
    Response.json({ error: 'Already resolved' }, { status: 409 })) as unknown as typeof fetch
  await expect(getRunApprovals('run', 'project')).rejects.toThrow('Already resolved')
  await expect(resolveRunApproval('run', 'project', 'approval', 'reject')).rejects.toThrow(
    'Already resolved',
  )
  globalThis.fetch = (async () => new Response('invalid')) as unknown as typeof fetch
  await expect(getRunApprovals('run', 'project')).rejects.toThrow('Approval response was empty')
})
