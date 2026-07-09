import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { mkdtempSync, rmSync, existsSync, readdirSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { saveSpec, loadSpec } from '../spec/store.ts'
import { archiveSpec, deleteArchivedSpec } from '../spec/archive.ts'

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
    frontmatter: { id: taskId, status: 'draft', createdAt: new Date().toISOString(), clarify: 'none' },
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
    expect(remaining.some(f => f.endsWith('-i8-spec-a.md'))).toBe(false)
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
