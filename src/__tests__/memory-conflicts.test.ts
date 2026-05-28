import { describe, it, expect, beforeAll } from 'bun:test'
import { runMigrations } from '../db/migrate.ts'
import { db } from '../db/sqlite.ts'

const { upsertMemory, insertConflict, listConflicts, resolveConflict } = await import('../db/memory.ts')
import type { ConflictRecord } from '../db/memory.ts'

const TEST_PROJECT = 's26-3-test'

beforeAll(() => {
  runMigrations()
  // clean slate for this test file
  db.run('DELETE FROM memory_conflicts')
  db.run('DELETE FROM memory_entries')
})

describe('insertConflict', () => {
  it('inserts a conflict record and returns its id', () => {
    const a = upsertMemory(TEST_PROJECT, 'topic-a', 'Entry A content')
    const b = upsertMemory(TEST_PROJECT, 'topic-b', 'Entry B content')

    const id = insertConflict(a.id, b.id, 'conflict_with', 'high')
    expect(id).toBeTruthy()
    expect(typeof id).toBe('string')
  })

  it('stores all fields correctly', () => {
    const a = upsertMemory(TEST_PROJECT, 'topic-c', 'Port should be 3000')
    const b = upsertMemory(TEST_PROJECT, 'topic-d', 'Port should be 4000')

    const id = insertConflict(a.id, b.id, 'conflict_with', 'high')

    const row = db.query<ConflictRecord, [string]>(
      'SELECT * FROM memory_conflicts WHERE id = ?'
    ).get(id)
    expect(row).not.toBeNull()
    expect(row!.entry_a_id).toBe(a.id)
    expect(row!.entry_b_id).toBe(b.id)
    expect(row!.relation).toBe('conflict_with')
    expect(row!.confidence).toBe('high')
    expect(row!.resolved_at).toBeNull()
    expect(row!.created_at).toBeTruthy()
  })
})

describe('listConflicts', () => {
  it('returns only unresolved conflicts', () => {
    const a = upsertMemory(TEST_PROJECT, 'topic-e', 'Config X')
    const b = upsertMemory(TEST_PROJECT, 'topic-f', 'Config Y not X')

    insertConflict(a.id, b.id, 'conflict_with', 'high')
    const c = upsertMemory(TEST_PROJECT, 'topic-g', 'Unrelated')
    const d = upsertMemory(TEST_PROJECT, 'topic-h', 'Also unrelated')

    const resolvedId = insertConflict(c.id, d.id, 'compatible', 'medium')
    resolveConflict(resolvedId)

    const all = db.query<ConflictRecord, []>(
      'SELECT * FROM memory_conflicts'
    ).all()
    const unresolved = listConflicts()

    expect(unresolved.length).toBeLessThan(all.length)
    expect(unresolved.every(r => r.resolved_at === null)).toBeTrue()
  })

  it('filters by project when projectId is provided', () => {
    const otherProject = 's26-3-other'
    const a = upsertMemory(TEST_PROJECT, 'topic-i', 'Alpha')
    const b = upsertMemory(TEST_PROJECT, 'topic-j', 'Bravo')
    const idA = insertConflict(a.id, b.id, 'related', 'low')

    const c = upsertMemory(otherProject, 'topic-k', 'Charlie')
    const d = upsertMemory(otherProject, 'topic-l', 'Delta')
    const idB = insertConflict(c.id, d.id, 'scoped', 'medium')

    const projectConflicts = listConflicts(TEST_PROJECT)
    const otherConflicts = listConflicts(otherProject)

    expect(projectConflicts.some(r => r.id === idA)).toBeTrue()
    expect(projectConflicts.some(r => r.id === idB)).toBeFalse()
    expect(otherConflicts.some(r => r.id === idB)).toBeTrue()
    expect(otherConflicts.some(r => r.id === idA)).toBeFalse()
  })

  it('returns empty array when no conflicts', () => {
    const emptyProject = 's26-3-empty'
    expect(listConflicts(emptyProject)).toEqual([])
  })
})

describe('resolveConflict', () => {
  it('sets resolved_at timestamp', () => {
    const a = upsertMemory(TEST_PROJECT, 'topic-m', 'Old value')
    const b = upsertMemory(TEST_PROJECT, 'topic-n', 'New value')
    const id = insertConflict(a.id, b.id, 'supersedes', 'high')

    resolveConflict(id)

    const row = db.query<ConflictRecord, [string]>(
      'SELECT * FROM memory_conflicts WHERE id = ?'
    ).get(id)
    expect(row!.resolved_at).not.toBeNull()
    expect(row!.resolved_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('is idempotent (updating already resolved does not throw)', () => {
    const a = upsertMemory(TEST_PROJECT, 'topic-o', 'Version 1')
    const b = upsertMemory(TEST_PROJECT, 'topic-p', 'Version 2')
    const id = insertConflict(a.id, b.id, 'compatible', 'low')

    resolveConflict(id)
    resolveConflict(id)

    const row = db.query<ConflictRecord, [string]>(
      'SELECT * FROM memory_conflicts WHERE id = ?'
    ).get(id)
    expect(row!.resolved_at).not.toBeNull()
  })
})
