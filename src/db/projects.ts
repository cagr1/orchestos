import { db } from './sqlite.ts'
import type { StackProfile } from '../generators/agents-md.ts'
import { createHash } from 'crypto'

export interface ProjectRow {
  id: string
  path: string
  stack_profile: string   // JSON string
  agents_md: string
  last_updated: string
}

function hashPath(p: string): string {
  return createHash('sha1').update(p).digest('hex').slice(0, 16)
}

export function upsertProject(path: string, profile: StackProfile, agentsMd: string): void {
  const id = hashPath(path)
  const now = new Date().toISOString()
  db.run(
    `INSERT INTO projects (id, path, stack_profile, agents_md, last_updated)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(path) DO UPDATE SET
       stack_profile = excluded.stack_profile,
       agents_md     = excluded.agents_md,
       last_updated  = excluded.last_updated`,
    [id, path, JSON.stringify(profile), agentsMd, now]
  )
}

export function getProject(path: string): ProjectRow | null {
  return db.query<ProjectRow, string>(
    'SELECT * FROM projects WHERE path = ?'
  ).get(path) ?? null
}

export function listProjects(): ProjectRow[] {
  return db.query<ProjectRow, []>('SELECT * FROM projects ORDER BY last_updated DESC').all()
}
