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

/**
 * S26.1 — A memory entry that scored above CONFLICT_THRESHOLD in BM25 search.
 * bm25Score is the raw FTS5 value (negative; lower = more similar).
 */
export interface ConflictCandidate {
  entryId: string
  topicKey: string
  bm25Score: number
}

export interface UpsertResult {
  id: string
  /** Entries whose content is semantically similar to the new/updated entry. */
  candidates: ConflictCandidate[]
}

/** Minimum |bm25| to flag an entry as a conflict candidate. */
const CONFLICT_THRESHOLD = 0.5

/**
 * Tokenizes text for FTS5 MATCH queries.
 * Returns null if no meaningful tokens are found (skips BM25 in that case).
 */
function toFtsQuery(text: string): string | null {
  const tokens = text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(t => t.length >= 3)
    // Wrap each token in double quotes so FTS5 treats it as a literal term
    .map(t => `"${t}"`)
  return tokens.length === 0 ? null : tokens.join(' OR ')
}

/** BM25 search against memory_fts, excluding the entry we just wrote. */
function findCandidates(projectId: string, entryId: string, content: string): ConflictCandidate[] {
  const query = toFtsQuery(content)
  if (!query) return []

  try {
    const rows = db.query<{ id: string; topic_key: string; score: number }, [string, string, string]>(
      `SELECT m.id, m.topic_key, bm25(memory_fts) AS score
       FROM memory_fts
       JOIN memory_entries m ON m.rowid = memory_fts.rowid
       WHERE memory_fts MATCH ?
         AND m.project_id = ?
         AND m.id != ?
       ORDER BY bm25(memory_fts)
       LIMIT 5`
    ).all(query, projectId, entryId)

    return rows
      .filter(r => Math.abs(r.score) >= CONFLICT_THRESHOLD)
      .map(r => ({ entryId: r.id, topicKey: r.topic_key, bm25Score: r.score }))
  } catch {
    // FTS5 may throw on unusual query syntax — degrade gracefully
    return []
  }
}

export function upsertMemory(
  projectId: string,
  topicKey: string,
  content: string,
  scope: MemoryScope = 'session',
): UpsertResult {
  const existing = db.query<MemoryEntry, [string, string]>(
    'SELECT * FROM memory_entries WHERE project_id = ? AND topic_key = ?'
  ).get(projectId, topicKey)

  let id: string

  if (existing) {
    const now = new Date().toISOString()
    db.run(
      'UPDATE memory_entries SET content = ?, scope = ?, updated_at = ? WHERE id = ?',
      [content, scope, now, existing.id],
    )
    id = existing.id
  } else {
    id = randomUUID()
    const now = new Date().toISOString()
    db.run(
      'INSERT INTO memory_entries (id, project_id, topic_key, scope, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, projectId, topicKey, scope, content, now, now],
    )
  }

  const candidates = findCandidates(projectId, id, content)
  return { id, candidates }
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
