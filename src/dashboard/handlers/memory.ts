import { db } from '../../db/sqlite.ts'
import type { MemoryEntry } from '../../db/memory.ts'
import type { MemoryRow } from '../types.ts'
import { jsonResponse } from '../http.ts'

function handleApiMemory(url?: URL): Response {
  const q = url?.searchParams.get('q')?.trim()
  try {
    const rows = q
      ? db.query<MemoryEntry, [string]>(
          `SELECT e.id, e.project_id, e.topic_key, e.scope, e.content, e.created_at, e.updated_at
           FROM memory_entries e
           JOIN memory_fts ON memory_fts.rowid = e.rowid
           WHERE memory_fts MATCH ?
           ORDER BY bm25(memory_fts)
           LIMIT 200`
        ).all(`"${q.replace(/"/g, '""')}"*`)
      : db.query<MemoryEntry, []>(
          'SELECT id, project_id, topic_key, scope, content, created_at, updated_at FROM memory_entries ORDER BY updated_at DESC LIMIT 200'
        ).all()
    const result: MemoryRow[] = rows.map(m => ({
      id: m.id,
      projectId: m.project_id,
      topicKey: m.topic_key,
      scope: m.scope as MemoryRow['scope'],
      content: m.content,
      updatedAt: m.updated_at,
    }))
    return jsonResponse(result)
  } catch {
    return jsonResponse([] as MemoryRow[])
  }
}

export { handleApiMemory }
