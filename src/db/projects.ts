import { realpathSync } from 'node:fs'
import { resolve } from 'node:path'
import { createHash } from 'crypto'
import type { StackProfile } from '../generators/agents-md.ts'
import { PROJECT_ICONS } from '../projects/settings.ts'
import { db } from './sqlite.ts'

export interface ProjectRow {
  id: string
  path: string
  stack_profile: string // JSON string
  agents_md: string
  last_updated: string
  removed_at: string | null
  display_name: string | null
  icon: string | null
  base_branch: string | null
  setup_script: string | null
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

export type ProjectSettings = Pick<
  ProjectRow,
  'display_name' | 'icon' | 'base_branch' | 'setup_script'
>

export function updateProjectSettings(
  id: string,
  partial: Partial<ProjectSettings>,
): ProjectRow | null {
  const project = getProjectById(id)
  if (!project || project.removed_at) return null
  const normalized: Partial<ProjectSettings> = {}
  for (const key of ['display_name', 'icon', 'base_branch', 'setup_script'] as const) {
    if (!Object.hasOwn(partial, key)) continue
    const value = partial[key]
    if (value !== null && typeof value !== 'string')
      throw new Error(`${key} must be a string or null`)
    const text = value?.trim() || null
    if (key === 'display_name' && text && text.length > 80)
      throw new Error('Name must be at most 80 characters')
    if (key === 'icon' && text && !PROJECT_ICONS.some((icon) => icon === text))
      throw new Error('Invalid project icon')
    if (key === 'setup_script' && value && value.length > 10_000)
      throw new Error('Setup script must be at most 10000 characters')
    if (key === 'base_branch' && text) {
      // Validate a local branch, never an option, tag, commit expression or shell fragment.
      const format = Bun.spawnSync(['git', 'check-ref-format', `refs/heads/${text}`])
      if (format.exitCode !== 0) throw new Error(`Invalid base branch: ${text}`)
      const check = Bun.spawnSync(
        [
          'git',
          '-C',
          project.path,
          'rev-parse',
          '--verify',
          '--end-of-options',
          `refs/heads/${text}`,
        ],
        { stdout: 'ignore', stderr: 'ignore' },
      )
      if (check.exitCode !== 0) throw new Error(`Base branch "${text}" does not exist locally`)
    }
    normalized[key] = key === 'setup_script' && text ? value : text
  }
  const keys = Object.keys(normalized) as (keyof ProjectSettings)[]
  if (keys.length)
    db.run(`UPDATE projects SET ${keys.map((key) => `${key} = ?`).join(', ')} WHERE id = ?`, [
      ...keys.map((key) => normalized[key] ?? null),
      id,
    ])
  return getProjectById(id)
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
