import { db } from './sqlite.ts'
import { randomUUID } from 'crypto'

export type MemoryScope = 'session' | 'project' | 'global'

export interface MemoryEntry {
  id: string
  project_id: string
  topic_key: string
  scope: MemoryScope
  content: string
  created_at: string
  updated_at: string
}

export function upsertMemory(
  projectId: string,
  topicKey: string,
  content: string,
  scope: MemoryScope = 'session',
): string {
  const existing = db.query<MemoryEntry, [string, string]>(
    'SELECT * FROM memory_entries WHERE project_id = ? AND topic_key = ?'
  ).get(projectId, topicKey)

  if (existing) {
    const now = new Date().toISOString()
    db.run(
      'UPDATE memory_entries SET content = ?, scope = ?, updated_at = ? WHERE id = ?',
      [content, scope, now, existing.id],
    )
    return existing.id
  }

  const id = randomUUID()
  const now = new Date().toISOString()
  db.run(
    'INSERT INTO memory_entries (id, project_id, topic_key, scope, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, projectId, topicKey, scope, content, now, now],
  )
  return id
}

export function getMemory(projectId: string, topicKey: string): MemoryEntry | null {
  return db.query<MemoryEntry, [string, string]>(
    'SELECT * FROM memory_entries WHERE project_id = ? AND topic_key = ?'
  ).get(projectId, topicKey) ?? null
}

export function listByScope(projectId: string, scope: MemoryScope): MemoryEntry[] {
  return db.query<MemoryEntry, [string, string]>(
    'SELECT * FROM memory_entries WHERE project_id = ? AND scope = ? ORDER BY updated_at DESC'
  ).all(projectId, scope)
}
