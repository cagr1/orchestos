import { Database } from 'bun:sqlite'
import { afterEach, expect, test } from 'bun:test'
import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  handleApiInstincts,
  handleApiInstinctsGraduate,
  handleApiInstinctsStatus,
} from '../dashboard/handlers/instincts.ts'
import { FUTURE_MIGRATIONS } from '../db/migrate.ts'
import { db } from '../db/sqlite.ts'
import { graduateLesson, planGraduation } from '../instincts/graduate.ts'
import { InstinctValidationError, validateInstinct } from '../instincts/schema.ts'
import {
  deleteInstinct,
  getInstinct,
  insertInstinct,
  listApplicable,
  setInstinctStatus,
  sweepStaleLessons,
} from '../instincts/store.ts'

const ids: string[] = []
const roots: string[] = []
const projectId = 'lifecycle-project'
function root() {
  const path = mkdtempSync(join(tmpdir(), 'lesson-lifecycle-'))
  roots.push(path)
  return path
}
function lesson(overrides: Partial<Parameters<typeof insertInstinct>[0]> = {}) {
  const result = insertInstinct({
    trigger: `lifecycle-${ids.length}`,
    action: 'check the evidence',
    confidence: 1,
    source: 'manual',
    verified: true,
    ...overrides,
  })
  ids.push(result.id)
  return result
}
const url = (id: string) => new URL(`http://localhost/api/instincts/${id}/graduate`)
const request = (body: unknown) =>
  new Request('http://localhost/api/instincts', { method: 'POST', body: JSON.stringify(body) })
afterEach(() => {
  for (const id of ids.splice(0)) deleteInstinct(id)
  db.run('DELETE FROM projects WHERE id = ?', [projectId])
  for (const path of roots.splice(0)) rmSync(path, { recursive: true, force: true })
})
function project(path: string) {
  db.run(
    'INSERT INTO projects (id, path, stack_profile, agents_md, last_updated) VALUES (?, ?, ?, ?, ?)',
    [projectId, path, '{}', '', new Date().toISOString()],
  )
}

test('migration 42 preserves legacy rows, enforces statuses and is idempotent', () => {
  const database = new Database(':memory:')
  try {
    database.exec('CREATE TABLE instincts (id TEXT); INSERT INTO instincts VALUES ("legacy")')
    const migration = FUTURE_MIGRATIONS.find((step) => step.version === 42)!
    migration.precondition(database)
    migration.apply(database)
    migration.postcondition(database)
    const first = database.query('SELECT * FROM instincts').get() as { status_changed_at: string }
    expect(first).toMatchObject({ id: 'legacy', status: 'active' })
    // The staleness clock starts at migration time, so legacy lessons are not swept at once.
    expect(Date.parse(first.status_changed_at)).toBeGreaterThan(Date.now() - 60_000)
    migration.apply(database)
    migration.postcondition(database)
    expect(database.query('SELECT * FROM instincts').get()).toEqual(first)
    expect(() => database.exec("UPDATE instincts SET status = 'unknown'")).toThrow()
    expect(() => database.exec('UPDATE instincts SET status = NULL')).toThrow()
  } finally {
    database.close()
  }
})

test('status validation defaults to active and rejects unknown values', () => {
  const value = lesson()
  const { status: _status, statusChangedAt: _changed, ...legacy } = value
  expect(validateInstinct(legacy)).toMatchObject({ status: 'active', statusChangedAt: null })
  expect(() => validateInstinct({ ...value, status: 'unknown' })).toThrow(InstinctValidationError)
})

test('sweep uses latest activity, only verified active lessons, and Keep restarts age', async () => {
  const now = new Date('2026-11-13T12:00:00.000Z')
  const old = new Date(now.getTime() - 61 * 86400000).toISOString()
  const recent = new Date(now.getTime() - 59 * 86400000).toISOString()
  const stale = lesson()
  const used = lesson()
  const fresh = lesson()
  const unverified = lesson({ verified: false })
  const kept = lesson()
  const retired = lesson()
  for (const item of [stale, used, fresh, unverified, kept, retired])
    db.run('UPDATE instincts SET created_at = ? WHERE id = ?', [old, item.id])
  db.run('UPDATE instincts SET last_injected_at = ? WHERE id = ?', [recent, used.id])
  db.run('UPDATE instincts SET created_at = ? WHERE id = ?', [recent, fresh.id])
  setInstinctStatus(kept.id, 'active', now)
  setInstinctStatus(retired.id, 'retired', now)
  expect(sweepStaleLessons(now)).toBe(1)
  expect(getInstinct(stale.id)).toMatchObject({
    status: 'review',
    statusChangedAt: now.toISOString(),
  })
  for (const item of [used, fresh, unverified, kept])
    expect(getInstinct(item.id)?.status).toBe('active')
  expect(getInstinct(retired.id)?.status).toBe('retired')
  const applicable = listApplicable().map((item) => item.id)
  expect(applicable).not.toContain(stale.id)
  expect(applicable).not.toContain(retired.id)
  expect(applicable).toContain(kept.id)
  expect(sweepStaleLessons(now)).toBe(0)
  expect(setInstinctStatus('missing', 'active', now)).toBe(false)
  setInstinctStatus(stale.id, 'active', now)
  expect(sweepStaleLessons(now)).toBe(0)
  db.run('UPDATE instincts SET created_at = ?, status_changed_at = NULL WHERE id = ?', [
    old,
    stale.id,
  ])
  const response = await handleApiInstincts().json()
  expect(response.find((item: { id: string }) => item.id === stale.id).status).toBe('review')
})

test('graduation plans a new file, append, insertion and duplicate without losing existing text', () => {
  const item = { trigger: 'editing\na file', action: 'read\r\nthe tests' }
  const line = '- When editing a file: read the tests'
  const block = `<!-- orchestos:lessons:start -->\n## Lessons learned\n${line}\n<!-- orchestos:lessons:end -->\n`
  expect(planGraduation(null, item)).toEqual({ after: block, added: [line], created: true })
  for (const current of ['# Existing', '# Existing\n'])
    expect(planGraduation(current, item).after).toBe(`${current}\n${block}`)
  const existing = `# Existing\n\n<!-- orchestos:lessons:start -->\n## Lessons learned\n- When old: keep it\n<!-- orchestos:lessons:end -->\nTail\n`
  const plan = planGraduation(existing, item)
  expect(plan.after).toBe(
    existing.replace('<!-- orchestos:lessons:end -->', `${line}\n<!-- orchestos:lessons:end -->`),
  )
  expect(planGraduation(plan.after, item)).toEqual({ after: plan.after, added: [], created: false })
  // A lesson quoting a marker must not shift the block for the next graduation.
  const quoting = planGraduation(null, {
    trigger: 'x',
    action: 'keep <!-- orchestos:lessons:end --> lines',
  })
  const next = planGraduation(quoting.after, item)
  expect(next.after).toBe(
    quoting.after.replace(
      /\n<!-- orchestos:lessons:end -->\n$/,
      `\n${line}\n<!-- orchestos:lessons:end -->\n`,
    ),
  )
  expect(planGraduation(next.after, item).added).toEqual([])
})

test('graduation rejects symlinks including dangling links without touching their targets', () => {
  const path = root()
  const target = join(path, 'target')
  writeFileSync(target, 'unchanged')
  symlinkSync(target, join(path, 'AGENTS.md'))
  for (const write of [false, true])
    expect(() => graduateLesson(path, { trigger: 't', action: 'a' }, { write })).toThrow(/symlink/)
  expect(readFileSync(target, 'utf8')).toBe('unchanged')
  const dangling = root()
  symlinkSync(join(dangling, 'missing'), join(dangling, 'AGENTS.md'))
  expect(() => graduateLesson(dangling, { trigger: 't', action: 'a' }, { write: true })).toThrow(
    /symlink/,
  )
})

test('status handler validates payload and project ownership', async () => {
  const path = root()
  project(path)
  const item = lesson({ projectId })
  expect(
    (await handleApiInstinctsStatus(request({ status: 'review' }), url(item.id), projectId)).status,
  ).toBe(400)
  expect(
    (await handleApiInstinctsStatus(request({ status: 'retired' }), url(item.id), 'foreign'))
      .status,
  ).toBe(404)
  expect(
    (await handleApiInstinctsStatus(request({ status: 'retired' }), url(item.id), projectId))
      .status,
  ).toBe(200)
  expect(getInstinct(item.id)?.status).toBe('retired')
  expect(
    (await handleApiInstinctsStatus(request({ status: 'active' }), url(item.id), projectId)).status,
  ).toBe(200)
  expect(getInstinct(item.id)?.status).toBe('active')
})

test('graduate handler rejects global, foreign, unverified, retired and symlink lessons', async () => {
  const path = root()
  project(path)
  const item = lesson({ projectId })
  const global = lesson()
  const unverified = lesson({ projectId, verified: false })
  expect((await handleApiInstinctsGraduate(request({}), url(item.id), path)).status).toBe(400)
  expect(
    (await handleApiInstinctsGraduate(request({}), url(global.id), path, projectId)).status,
  ).toBe(400)
  expect(
    (await handleApiInstinctsGraduate(request({}), url(item.id), path, 'foreign')).status,
  ).toBe(404)
  expect(
    (await handleApiInstinctsGraduate(request({}), url('missing'), path, projectId)).status,
  ).toBe(404)
  expect(
    (await handleApiInstinctsGraduate(request({}), url(unverified.id), path, projectId)).status,
  ).toBe(409)
  setInstinctStatus(item.id, 'retired')
  expect(
    (await handleApiInstinctsGraduate(request({}), url(item.id), path, projectId)).status,
  ).toBe(409)
  setInstinctStatus(item.id, 'active')
  expect(
    (await handleApiInstinctsGraduate(request({ confirm: 'yes' }), url(item.id), path, projectId))
      .status,
  ).toBe(400)
  symlinkSync(join(path, 'missing'), join(path, 'AGENTS.md'))
  expect(
    (await handleApiInstinctsGraduate(request({ confirm: true }), url(item.id), path, projectId))
      .status,
  ).toBe(409)
  expect(getInstinct(item.id)?.status).toBe('active')
})

test('preview does not write; confirm recalculates current content and retires without reinjection', async () => {
  const path = root()
  project(path)
  const item = lesson({ projectId })
  const preview = await handleApiInstinctsGraduate(request({}), url(item.id), path, projectId)
  expect(await preview.json()).toEqual({
    ok: true,
    path: join(path, 'AGENTS.md'),
    added: [`- When ${item.trigger}: ${item.action}`],
    created: true,
  })
  expect(existsSync(join(path, 'AGENTS.md'))).toBe(false)
  expect(getInstinct(item.id)?.status).toBe('active')
  writeFileSync(join(path, 'AGENTS.md'), '# Changed after preview\n')
  const confirmed = await handleApiInstinctsGraduate(
    request({ confirm: true, after: 'client content' }),
    url(item.id),
    path,
    projectId,
  )
  expect(confirmed.status).toBe(200)
  expect(readFileSync(join(path, 'AGENTS.md'), 'utf8')).toBe(
    planGraduation('# Changed after preview\n', item).after,
  )
  expect(getInstinct(item.id)?.status).toBe('retired')
  expect(listApplicable(projectId).map((row) => row.id)).not.toContain(item.id)
  setInstinctStatus(item.id, 'active')
  const duplicate = await handleApiInstinctsGraduate(
    request({ confirm: true }),
    url(item.id),
    path,
    projectId,
  )
  expect((await duplicate.json()).added).toEqual([])
  expect(getInstinct(item.id)?.status).toBe('retired')
})
