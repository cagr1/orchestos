import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { archiveSpec, deleteArchivedSpec } from '../spec/archive.ts'
import { loadSpec, saveSpec } from '../spec/store.ts'

// I.8 (Mes 18) — Specs solo tenía archive (soft); deleteArchivedSpec agrega
// el borrado permanente, a propósito restringido a specs ya archivadas.

let root: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'orchestos-i8-specs-'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

function draftSpec(taskId: string) {
  saveSpec(root, {
    frontmatter: {
      id: taskId,
      status: 'draft',
      createdAt: new Date().toISOString(),
      clarify: 'none',
    },
    body: '## Notes\nplaceholder\n',
  })
}

describe('deleteArchivedSpec', () => {
  it('deletes an archived spec file and it no longer loads', () => {
    draftSpec('i8-spec-a')
    archiveSpec(root, 'i8-spec-a')

    const ok = deleteArchivedSpec(root, 'i8-spec-a')
    expect(ok).toBe(true)

    const archiveDir = join(root, '.orchestos/specs/archive')
    const remaining = existsSync(archiveDir) ? readdirSync(archiveDir) : []
    expect(remaining.some((f) => f.endsWith('-i8-spec-a.md'))).toBe(false)
  })

  it('returns false for a spec that was never archived', () => {
    draftSpec('i8-spec-b')
    const ok = deleteArchivedSpec(root, 'i8-spec-b')
    expect(ok).toBe(false)
    // el draft activo no se tocó
    expect(loadSpec(root, 'i8-spec-b')).not.toBeNull()
  })

  it('returns false for a completely unknown task id', () => {
    expect(deleteArchivedSpec(root, 'no-such-spec')).toBe(false)
  })
})

it('AUD.20 deleting foo preserves bar-foo and deletes every foo version', () => {
  draftSpec('bar-foo')
  const other = archiveSpec(root, 'bar-foo')
  expect(deleteArchivedSpec(root, 'foo')).toBe(false)
  expect(existsSync(other.archivedPath)).toBe(true)
  draftSpec('foo')
  const first = archiveSpec(root, 'foo')
  draftSpec('foo')
  const second = archiveSpec(root, 'foo')
  expect(deleteArchivedSpec(root, 'foo')).toBe(true)
  expect(existsSync(first.archivedPath)).toBe(false)
  expect(existsSync(second.archivedPath)).toBe(false)
  expect(existsSync(other.archivedPath)).toBe(true)
})

it('AUD.20-fix deleting foo preserves the distinct foo.2 spec', () => {
  draftSpec('foo')
  const first = archiveSpec(root, 'foo')
  draftSpec('foo')
  const second = archiveSpec(root, 'foo')
  draftSpec('foo.2')
  const other = archiveSpec(root, 'foo.2')
  expect(second.archivedPath).toMatch(/-foo~2\.md$/)
  expect(deleteArchivedSpec(root, 'foo')).toBe(true)
  expect(existsSync(first.archivedPath)).toBe(false)
  expect(existsSync(second.archivedPath)).toBe(false)
  expect(existsSync(other.archivedPath)).toBe(true)
})
