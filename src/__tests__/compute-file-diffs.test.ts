import { describe, it, expect } from 'bun:test'
import { computeFileDiffs, type ContentSnapshot } from '../run/qa.ts'
import type { FileChange } from '../run/contract.ts'

// v0.12/C.2 — visor de diff por run (docs/diff-review-design.md).
describe('computeFileDiffs', () => {
  it('marks a file as "added" when it did not exist before', () => {
    const before: ContentSnapshot = { 'new.ts': { existed: false, content: '' } }
    const written: FileChange[] = [{ path: 'new.ts', content: 'export const x = 1\n' }]

    const [entry] = computeFileDiffs(before, written)

    expect(entry!.status).toBe('added')
    expect(entry!.path).toBe('new.ts')
    expect(entry!.diff).toContain('+export const x = 1')
  })

  it('marks a file as "modified" when it existed before with different content', () => {
    const before: ContentSnapshot = { 'existing.ts': { existed: true, content: 'export const x = 1\n' } }
    const written: FileChange[] = [{ path: 'existing.ts', content: 'export const x = 2\n' }]

    const [entry] = computeFileDiffs(before, written)

    expect(entry!.status).toBe('modified')
    expect(entry!.diff).toContain('-export const x = 1')
    expect(entry!.diff).toContain('+export const x = 2')
  })

  it('produces one entry per written file, preserving order', () => {
    const before: ContentSnapshot = {
      'a.ts': { existed: true, content: 'a' },
      'b.ts': { existed: false, content: '' },
    }
    const written: FileChange[] = [
      { path: 'a.ts', content: 'a2' },
      { path: 'b.ts', content: 'b' },
    ]

    const entries = computeFileDiffs(before, written)

    expect(entries).toHaveLength(2)
    expect(entries[0]!.path).toBe('a.ts')
    expect(entries[0]!.status).toBe('modified')
    expect(entries[1]!.path).toBe('b.ts')
    expect(entries[1]!.status).toBe('added')
  })

  it('returns an empty array when nothing was written', () => {
    expect(computeFileDiffs({}, [])).toEqual([])
  })

  it('treats a file absent from the before-snapshot as added (defensive default)', () => {
    // No debería pasar en la práctica (snapshotContents siempre cubre task.output),
    // pero computeFileDiffs no debe reventar si el path no está en el snapshot.
    const written: FileChange[] = [{ path: 'untracked.ts', content: 'x' }]

    const [entry] = computeFileDiffs({}, written)

    expect(entry!.status).toBe('added')
  })
})
