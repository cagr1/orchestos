import { realpathSync } from 'node:fs'
import { resolve } from 'node:path'
import { createHash } from 'crypto'
import type { StackProfile } from '../generators/agents-md.ts'
import { db } from './sqlite.ts'

export interface ProjectRow {
  id: string
  path: string
  stack_profile: string // JSON string
  agents_md: string
  last_updated: string
}

function hashPath(p: string): string {
  return createHash('sha1').update(p).digest('hex').slice(0, 16)
}

/** Canonicalize project paths for identity and comparison. */
function normalizeProjectPath(path: string): string {
  try {
    return realpathSync(path)
  } catch {
    // Keep path lookups useful for stale registrations whose directory was
    // removed; existing paths still use realpathSync above for symlink parity.
    return resolve(path)
  }
}

function findProjectByNormalizedPath(normalizedPath: string): ProjectRow | null {
  for (const project of listProjects()) {
    if (normalizeProjectPath(project.path) === normalizedPath) return project
  }
  return null
}

export function upsertProject(path: string, profile: StackProfile, agentsMd: string): void {
  const normalizedPath = normalizeProjectPath(path)
  const existing = findProjectByNormalizedPath(normalizedPath)
  const now = new Date().toISOString()
  if (existing) {
    db.run(
      `UPDATE projects
       SET stack_profile = ?, agents_md = ?, last_updated = ?
       WHERE id = ?`,
      [JSON.stringify(profile), agentsMd, now, existing.id],
    )
    return
  }

  const id = hashPath(normalizedPath)
  db.run(
    `INSERT INTO projects (id, path, stack_profile, agents_md, last_updated)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(path) DO UPDATE SET
       stack_profile = excluded.stack_profile,
       agents_md     = excluded.agents_md,
       last_updated  = excluded.last_updated`,
    [id, path, JSON.stringify(profile), agentsMd, now],
  )
}

export function getProject(path: string): ProjectRow | null {
  const normalizedPath = normalizeProjectPath(path)
  return findProjectByNormalizedPath(normalizedPath)
}

export function getProjectById(id: string): ProjectRow | null {
  return db.query<ProjectRow, string>('SELECT * FROM projects WHERE id = ?').get(id) ?? null
}

export function listProjects(): ProjectRow[] {
  return db.query<ProjectRow, []>('SELECT * FROM projects ORDER BY last_updated DESC').all()
}

export function deleteProject(id: string): boolean {
  return db.transaction(() => {
    // Project registration is metadata only. Related database rows are cleaned
    // up, while the repository path is intentionally never touched.
    db.run('DELETE FROM context_chunks WHERE project_id = ?', [id])
    return db.run('DELETE FROM projects WHERE id = ?', [id]).changes > 0
  })()
}
