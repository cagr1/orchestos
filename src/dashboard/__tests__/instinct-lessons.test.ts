import { afterEach, expect, test } from 'bun:test'
import { db } from '../../db/sqlite.ts'
import { deleteInstinct, getInstinct } from '../../instincts/store.ts'
import {
  handleApiInstincts,
  handleApiInstinctsCreate,
  handleApiInstinctsPropose,
  handleApiInstinctsUpdate,
} from '../handlers/instincts.ts'

const ids: string[] = []
afterEach(() => {
  for (const id of ids.splice(0)) deleteInstinct(id)
  db.run('DELETE FROM projects WHERE id = ?', ['lesson-owned-project'])
})
const request = (body: unknown, method = 'POST') =>
  new Request('http://localhost/api/instincts', { method, body: JSON.stringify(body) })

test('create and propose retain why/evidence and list exposes injection counters', async () => {
  for (const [handler, source, verified] of [
    [handleApiInstinctsCreate, 'manual', true],
    [handleApiInstinctsPropose, 'auto', false],
  ] as const) {
    const evidence = { turnId: 'turn-lesson', runId: 'run-lesson', ref: 'session:message' }
    const response = await handler(
      request({ trigger: `when ${source}`, action: 'do', why: 'reason', evidence }),
    )
    expect(response.status).toBe(200)
    const { id } = await response.json()
    ids.push(id)
    expect(getInstinct(id)).toMatchObject({
      trigger: `when ${source}`,
      action: 'do',
      why: 'reason',
      evidence,
      source,
      verified,
    })
    const rows = await handleApiInstincts().json()
    expect(rows.find((row: { id: string }) => row.id === id)).toMatchObject({
      why: 'reason',
      evidence,
      injectedCount: 0,
      lastInjectedAt: null,
    })
  }
})

test('PATCH trims fields, clips lengths, retains defaults and enforces project ownership', async () => {
  db.run(
    'INSERT INTO projects (id, path, stack_profile, agents_md, last_updated) VALUES (?, ?, ?, ?, ?)',
    ['lesson-owned-project', '/tmp/lrn-owned-project', '{}', '', new Date().toISOString()],
  )
  const created = await handleApiInstinctsPropose(
    request({ trigger: 'old', action: 'old', why: 'old', evidence: { turnId: 'original' } }),
    'lesson-owned-project',
  )
  expect(created.status).toBe(200)
  const { id } = await created.json()
  ids.push(id)
  const url = new URL(`http://localhost/api/instincts/${id}`)
  const foreign = await handleApiInstinctsUpdate(
    request({ action: 'foreign' }, 'PATCH'),
    url,
    'other-project',
  )
  expect(foreign.status).toBe(404)
  expect(getInstinct(id)?.action).toBe('old')
  const response = await handleApiInstinctsUpdate(
    request(
      { trigger: `  ${'t'.repeat(600)}  `, action: ' changed ', why: 'w'.repeat(1100) },
      'PATCH',
    ),
    url,
    'lesson-owned-project',
  )
  expect(response.status).toBe(200)
  expect(getInstinct(id)).toMatchObject({
    trigger: 't'.repeat(500),
    action: 'changed',
    why: 'w'.repeat(1000),
    evidence: { turnId: 'original' },
    source: 'auto',
    verified: false,
  })
  expect(
    (
      await handleApiInstinctsUpdate(
        request({ action: '  ' }, 'PATCH'),
        url,
        'lesson-owned-project',
      )
    ).status,
  ).toBe(400)
  expect(
    (
      await handleApiInstinctsUpdate(
        request({}, 'PATCH'),
        new URL('http://localhost/api/instincts/missing'),
      )
    ).status,
  ).toBe(404)
  expect(db.query('SELECT verified FROM instincts WHERE id = ?').get(id)).toEqual({ verified: 0 })
})

test('create clips lesson text and rejects malformed evidence', async () => {
  const response = await handleApiInstinctsCreate(
    request({
      trigger: 't'.repeat(600),
      action: 'a'.repeat(600),
      why: 'w'.repeat(1200),
      evidence: { ref: 'r'.repeat(200) },
    }),
  )
  const { id } = await response.json()
  ids.push(id)
  expect(getInstinct(id)).toMatchObject({
    trigger: 't'.repeat(500),
    action: 'a'.repeat(500),
    why: 'w'.repeat(1000),
  })
  for (const evidence of [{ ref: 5 }, { runId: 'r'.repeat(201) }, [], 'invalid'])
    expect(
      (await handleApiInstinctsCreate(request({ trigger: 't', action: 'a', evidence }))).status,
    ).toBe(400)
})

test('create and PATCH report duplicate triggers as conflicts', async () => {
  const first = await handleApiInstinctsCreate(
    request({ trigger: 'duplicate trigger', action: 'one' }),
  )
  expect(first.status).toBe(200)
  const { id } = await first.json()
  ids.push(id)

  const duplicate = await handleApiInstinctsCreate(
    request({ trigger: 'duplicate trigger', action: 'two' }),
  )
  expect(duplicate.status).toBe(409)
  expect(await duplicate.json()).toEqual({ error: 'A lesson with this trigger already exists' })

  const other = await handleApiInstinctsCreate(request({ trigger: 'another trigger', action: 'x' }))
  const { id: otherId } = await other.json()
  ids.push(otherId)
  const patched = await handleApiInstinctsUpdate(
    request({ trigger: 'duplicate trigger' }, 'PATCH'),
    new URL(`http://localhost/api/instincts/${otherId}`),
  )
  expect(patched.status).toBe(409)
  expect(await patched.json()).toEqual({ error: 'A lesson with this trigger already exists' })
})
