import { db } from '../../db/sqlite.ts'
import { listConflicts, resolveConflict, deleteMemoryEntry } from '../../db/memory.ts'
import type { MemoryEntry } from '../../db/memory.ts'
import type { MemoryRow, MutationResult } from '../types.ts'
import { jsonResponse, errorResponse } from '../http.ts'

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

// Bloque E (Mes 18, ex-IDEAS #9b) — `orchestos memory conflicts` no tenía
// ningún equivalente en el dashboard, ni siquiera de solo lectura.
function handleApiMemoryConflicts(url?: URL): Response {
  const projectId = url?.searchParams.get('project')?.trim() || undefined
  try {
    return jsonResponse(listConflicts(projectId))
  } catch {
    return jsonResponse([])
  }
}

// I.5 (Mes 18) — el panel de conflictos era de solo lectura; sin esto no
// había forma de bajar un conflicto de la lista una vez revisado.
function handleApiMemoryConflictResolve(url: URL): Response {
  const parts = url.pathname.split('/')
  const id = parts[4]
  if (!id) return errorResponse('Missing conflict id', 400)
  const ok = resolveConflict(id)
  const result: MutationResult = ok ? { ok: true } : { ok: false, error: 'Conflict not found' }
  return jsonResponse(result, ok ? 200 : 404)
}

// I.8 (Mes 18) — Memory (entries) no tenía forma de borrar registros desde el dashboard.
function handleApiMemoryDelete(url: URL): Response {
  const id = url.pathname.slice('/api/memory/'.length)
  if (!id) return errorResponse('Missing entry id', 400)
  const ok = deleteMemoryEntry(id)
  const result: MutationResult = ok ? { ok: true } : { ok: false, error: 'Entry not found' }
  return jsonResponse(result, ok ? 200 : 404)
}

// v0.12 Bloque A — borrado en lote, reusa deleteMemoryEntry() por id.
async function handleApiMemoryBulkDelete(req: Request): Promise<Response> {
  let body: { ids?: unknown }
  try { body = (await req.json()) as { ids?: unknown } } catch { return errorResponse('Invalid JSON', 400) }
  if (!Array.isArray(body.ids) || body.ids.length === 0) return errorResponse('ids must be a non-empty array', 400)
  const ids = body.ids.filter((id): id is string => typeof id === 'string')
  let deleted = 0
  for (const id of ids) if (deleteMemoryEntry(id)) deleted++
  return jsonResponse({ ok: true, deleted })
}

export { handleApiMemory, handleApiMemoryConflicts, handleApiMemoryConflictResolve, handleApiMemoryDelete, handleApiMemoryBulkDelete }
