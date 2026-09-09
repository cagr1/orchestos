import { Database } from 'bun:sqlite'
import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  listPlanItemsWithDeps,
  preparePlanItemClose,
  setDeps,
  upsertPlanItem,
  wouldCreateDependencyCycle,
} from './plan-items.ts'

function fixtureDb(): Database {
  const database = new Database(':memory:')
  database.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE plan_items (
      id TEXT PRIMARY KEY, sprint TEXT NOT NULL, block TEXT, delegation TEXT NOT NULL,
      title TEXT NOT NULL, body TEXT NOT NULL DEFAULT '', status TEXT NOT NULL,
      commit_sha TEXT, closed_at TEXT, position INTEGER NOT NULL,
      CHECK (status = 'open' OR commit_sha IS NOT NULL)
    );
    CREATE TABLE plan_item_deps (
      item_id TEXT NOT NULL REFERENCES plan_items(id) ON DELETE CASCADE,
      depends_on TEXT NOT NULL REFERENCES plan_items(id) ON DELETE RESTRICT,
      PRIMARY KEY (item_id, depends_on), CHECK (item_id <> depends_on)
    );
    CREATE TABLE plan_doc_segments (
      doc TEXT NOT NULL, position INTEGER NOT NULL, kind TEXT NOT NULL, text TEXT,
      item_id TEXT, PRIMARY KEY (doc, position)
    );
  `)
  for (const [id, position] of [
    ['A', 0],
    ['B', 1],
    ['C', 2],
  ] as const) {
    upsertPlanItem(
      { id, sprint: 'Sprint fixture', delegation: '⚡', title: id, status: 'open', position },
      database,
    )
  }
  return database
}

describe('plan item dependency projection', () => {
  test('orders edges by dependency position and derives blockedBy and ready without N+1 queries', () => {
    const database = fixtureDb()
    setDeps('C', ['B', 'A'], database)
    const c = listPlanItemsWithDeps(database).find((item) => item.id === 'C')
    expect(c?.dependsOn).toEqual(['A', 'B'])
    expect(c?.blockedBy).toEqual(['A', 'B'])
    expect(c?.ready).toBe(false)
    database.close()
  })

  test('rejects a direct or transitive dependency cycle before it is written', () => {
    const database = fixtureDb()
    setDeps('B', ['A'], database)
    setDeps('C', ['B'], database)
    expect(wouldCreateDependencyCycle('A', ['A'], database)).toBe(true)
    expect(wouldCreateDependencyCycle('A', ['C'], database)).toBe(true)
    expect(wouldCreateDependencyCycle('C', ['A'], database)).toBe(false)
    database.close()
  })
})

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('preparePlanItemClose', () => {
  test('changes exactly one item segment and keeps rendered plan byte-exact', () => {
    const database = fixtureDb()
    const root = mkdtempSync(join(tmpdir(), 'plan-close-'))
    roots.push(root)
    const plan =
      '## Sprint fixture\n- [ ] **A — ⚡ A.**\n- [ ] **B — ⚡ B.**\n- [ ] **C — ⚡ C.**\n'
    writeFileSync(join(root, 'PLAN.md'), plan, 'utf-8')
    database.run('INSERT INTO plan_doc_segments VALUES (?, ?, ?, ?, ?)', [
      'PLAN.md',
      0,
      'prose',
      '## Sprint fixture\n',
      null,
    ])
    database.run('INSERT INTO plan_doc_segments VALUES (?, ?, ?, ?, ?)', [
      'PLAN.md',
      1,
      'item',
      '- [ ] **A — ⚡ A.**\n',
      'A',
    ])
    database.run('INSERT INTO plan_doc_segments VALUES (?, ?, ?, ?, ?)', [
      'PLAN.md',
      2,
      'item',
      '- [ ] **B — ⚡ B.**\n',
      'B',
    ])
    database.run('INSERT INTO plan_doc_segments VALUES (?, ?, ?, ?, ?)', [
      'PLAN.md',
      3,
      'item',
      '- [ ] **C — ⚡ C.**\n',
      'C',
    ])

    const closed = preparePlanItemClose({
      id: 'A',
      root,
      provisionalSha: 'provisional',
      now: '2026-09-09T00:00:00.000Z',
      database,
    })
    expect(closed.status).toBe('done')
    expect(readFileSync(join(root, 'PLAN.md'), 'utf-8')).toBe(
      '## Sprint fixture\n- [x] **A — ⚡ A.**\n- [ ] **B — ⚡ B.**\n- [ ] **C — ⚡ C.**\n',
    )
    expect(listPlanItemsWithDeps(database).find((item) => item.id === 'B')?.status).toBe('open')
    database.close()
  })

  test('a filesystem failure rolls back the database and leaves PLAN.md unchanged', () => {
    const database = fixtureDb()
    const root = mkdtempSync(join(tmpdir(), 'plan-close-fail-'))
    roots.push(root)
    const plan =
      '## Sprint fixture\n- [ ] **A — ⚡ A.**\n- [ ] **B — ⚡ B.**\n- [ ] **C — ⚡ C.**\n'
    writeFileSync(join(root, 'PLAN.md'), plan, 'utf-8')
    database.run('INSERT INTO plan_doc_segments VALUES (?, ?, ?, ?, ?)', [
      'PLAN.md',
      0,
      'prose',
      '## Sprint fixture\n',
      null,
    ])
    database.run('INSERT INTO plan_doc_segments VALUES (?, ?, ?, ?, ?)', [
      'PLAN.md',
      1,
      'item',
      '- [ ] **A — ⚡ A.**\n',
      'A',
    ])
    database.run('INSERT INTO plan_doc_segments VALUES (?, ?, ?, ?, ?)', [
      'PLAN.md',
      2,
      'item',
      '- [ ] **B — ⚡ B.**\n',
      'B',
    ])
    database.run('INSERT INTO plan_doc_segments VALUES (?, ?, ?, ?, ?)', [
      'PLAN.md',
      3,
      'item',
      '- [ ] **C — ⚡ C.**\n',
      'C',
    ])

    expect(() =>
      preparePlanItemClose({
        id: 'A',
        root,
        provisionalSha: 'provisional',
        now: '2026-09-09T00:00:00.000Z',
        database,
        writePlan: () => {
          throw new Error('disk full')
        },
      }),
    ).toThrow('disk full')
    expect(listPlanItemsWithDeps(database).find((item) => item.id === 'A')?.status).toBe('open')
    expect(readFileSync(join(root, 'PLAN.md'), 'utf-8')).toBe(plan)
    database.close()
  })
})
