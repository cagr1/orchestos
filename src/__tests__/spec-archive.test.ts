/**
 * S29.4 — Tests for spec archive and updated listSpecs.
 */

import { describe, it, expect, beforeEach } from 'bun:test'
import { mkdirSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { saveSpec, listSpecs, specPath } from '../spec/store.ts'
import { archiveSpec } from '../spec/archive.ts'
import type { Spec } from '../spec/store.ts'

function tmpRoot(): string {
  const dir = join(tmpdir(), `orchestos-test-archive-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  mkdirSync(dir, { recursive: true })
  return dir
}

function makeSpec(id: string, status: 'draft' | 'approved' = 'draft'): Spec {
  return {
    frontmatter: { id, status, createdAt: new Date().toISOString(), clarify: 'none' },
    body: '## Contexto\nfoo\n\n## Criterios de aceptación\n- [ ] WHEN x THEN y\n',
  }
}

describe('archiveSpec', () => {
  let root: string

  beforeEach(() => {
    root = tmpRoot()
  })

  it('throws when spec does not exist', () => {
    expect(() => archiveSpec(root, 'nonexistent')).toThrow(/No spec found/)
  })

  it('moves the spec file to archive directory', () => {
    saveSpec(root, makeSpec('add-auth'))
    const originalPath = specPath(root, 'add-auth')
    expect(existsSync(originalPath)).toBe(true)

    archiveSpec(root, 'add-auth')

    expect(existsSync(originalPath)).toBe(false)

    const archiveDir = join(root, '.orchestos/specs/archive')
    expect(existsSync(archiveDir)).toBe(true)
  })

  it('returns the archive path and archivedAt date', () => {
    saveSpec(root, makeSpec('add-payment'))
    const result = archiveSpec(root, 'add-payment')

    expect(result.archivedPath).toContain('add-payment')
    expect(result.archivedPath).toContain('archive')
    expect(result.archivedAt).toBeTruthy()
    expect(new Date(result.archivedAt).getFullYear()).toBe(new Date().getFullYear())
  })

  it('archive filename includes date prefix YYYY-MM-DD', () => {
    saveSpec(root, makeSpec('fix-bug'))
    const result = archiveSpec(root, 'fix-bug')

    const datePrefix = new Date().toISOString().slice(0, 10)
    expect(result.archivedPath).toContain(datePrefix)
  })

  it('archived file has status: archived in frontmatter', () => {
    saveSpec(root, makeSpec('refactor-db', 'approved'))
    archiveSpec(root, 'refactor-db')

    const datePrefix = new Date().toISOString().slice(0, 10)
    const archiveDir = join(root, '.orchestos/specs/archive')
    const { readFileSync } = require('fs')
    const archivedContent = readFileSync(join(archiveDir, `${datePrefix}-refactor-db.md`), 'utf-8')
    expect(archivedContent).toContain('status: archived')
    expect(archivedContent).toContain('archivedAt:')
  })

  it('idempotent: archiving twice fails on second call (original already gone)', () => {
    saveSpec(root, makeSpec('task-1'))
    archiveSpec(root, 'task-1')
    expect(() => archiveSpec(root, 'task-1')).toThrow(/No spec found/)
  })
})

describe('listSpecs with archived', () => {
  let root: string

  beforeEach(() => {
    root = tmpRoot()
  })

  it('excludes archived specs by default', () => {
    saveSpec(root, makeSpec('active-task'))
    saveSpec(root, makeSpec('done-task'))
    archiveSpec(root, 'done-task')

    const specs = listSpecs(root)
    const ids = specs.map(s => s.frontmatter.id)
    expect(ids).toContain('active-task')
    expect(ids).not.toContain('done-task')
  })

  it('includes archived specs when includeArchived=true', () => {
    saveSpec(root, makeSpec('active-task'))
    saveSpec(root, makeSpec('done-task'))
    archiveSpec(root, 'done-task')

    const specs = listSpecs(root, true)
    const ids = specs.map(s => s.frontmatter.id)
    expect(ids).toContain('active-task')
    expect(ids).toContain('done-task')
  })

  it('archived spec has status archived when loaded via listSpecs --all', () => {
    saveSpec(root, makeSpec('completed'))
    archiveSpec(root, 'completed')

    const specs = listSpecs(root, true)
    const archived = specs.find(s => s.frontmatter.id === 'completed')
    expect(archived).toBeDefined()
    expect(archived!.frontmatter.status).toBe('archived')
    expect(archived!.frontmatter.archivedAt).toBeTruthy()
  })

  it('returns empty list when no specs exist', () => {
    expect(listSpecs(root)).toHaveLength(0)
    expect(listSpecs(root, true)).toHaveLength(0)
  })
})
