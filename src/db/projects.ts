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
  removed_at: string | null
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

function findStoredProjectByNormalizedPath(normalizedPath: string): ProjectRow | null {
  const projects = db
    .query<ProjectRow, []>('SELECT * FROM projects ORDER BY last_updated DESC')
    .all()
  return projects.find((project) => normalizeProjectPath(project.path) === normalizedPath) ?? null
}

export function upsertProject(path: string, profile: StackProfile, agentsMd: string): void {
  const normalizedPath = normalizeProjectPath(path)
  const existing = findStoredProjectByNormalizedPath(normalizedPath)
  const now = new Date().toISOString()
  if (existing) {
    db.run(
      `UPDATE projects
       SET stack_profile = ?, agents_md = ?, last_updated = ?
       WHERE id = ?`,
      [JSON.stringify(profile), agentsMd, now, existing.id],
    )
    db.run('UPDATE projects SET removed_at = NULL WHERE id = ?', [existing.id])
    return
  }

  const id = hashPath(normalizedPath)
  db.run(
    `INSERT INTO projects (id, path, stack_profile, agents_md, last_updated, removed_at)
     VALUES (?, ?, ?, ?, ?, NULL)
     ON CONFLICT(path) DO UPDATE SET
       stack_profile = excluded.stack_profile,
       agents_md     = excluded.agents_md,
       last_updated  = excluded.last_updated,
       removed_at    = NULL`,
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
  return db
    .query<ProjectRow, []>(
      'SELECT * FROM projects WHERE removed_at IS NULL ORDER BY last_updated DESC',
    )
    .all()
}

export function deleteProject(id: string): boolean {
  return (
    db.run('UPDATE projects SET removed_at = ? WHERE id = ? AND removed_at IS NULL', [
      new Date().toISOString(),
      id,
    ]).changes > 0
  )
}

function tablesWithProjectId(): string[] {
  const tables = db
    .query<{ name: string }, []>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )
    .all()
  return tables
    .filter(({ name }) => name !== 'projects')
    .filter(({ name }) =>
      db
        .query<{ name: string }, []>(`PRAGMA table_info("${name.replaceAll('"', '""')}")`)
        .all()
        .some((column) => column.name === 'project_id'),
    )
    .map(({ name }) => name)
}

export function purgeProject(id: string): boolean {
  return db.transaction(() => {
    if (!getProjectById(id)) return false

    // Remove non-project-keyed dependants first. The project-scoped rows are
    // discovered from PRAGMA below so new project tables cannot be forgotten.
    db.run('DELETE FROM eval_trials WHERE run_id IN (SELECT id FROM runs WHERE project_id = ?)', [
      id,
    ])
    db.run(
      `DELETE FROM memory_conflicts
       WHERE entry_a_id IN (SELECT id FROM memory_entries WHERE project_id = ?)
          OR entry_b_id IN (SELECT id FROM memory_entries WHERE project_id = ?)`,
      [id, id],
    )

    for (const table of tablesWithProjectId()) {
      db.run(`DELETE FROM "${table.replaceAll('"', '""')}" WHERE project_id = ?`, [id])
    }
    return db.run('DELETE FROM projects WHERE id = ?', [id]).changes > 0
  })()
}
