import { db } from '../../db/sqlite.ts'
import { AUTO_DEFAULTS, MANUAL_DEFAULTS } from '../../instincts/schema.ts'
import {
  approveInstinct,
  deleteInstinct,
  insertInstinct,
  listInstincts,
  updateConfidence,
} from '../../instincts/store.ts'
import { errorResponse, jsonResponse } from '../http.ts'
import type { InstinctRow, MutationResult } from '../types.ts'

function handleApiInstincts(projectId: string | null = null): Response {
  const all = listInstincts({ projectId })
  const rows: InstinctRow[] = all.map((i) => ({
    id: i.id,
    projectId: i.project_id,
    trigger: i.trigger,
    action: i.action,
    confidence: i.confidence,
    source: i.source,
    verified: i.verified,
    createdAt: i.created_at,
    usagesCount:
      db
        .query<{ count: number }, [string]>('SELECT COUNT(*) AS count FROM runs WHERE skill_id = ?')
        .get(i.id)?.count ?? 0,
  }))
  return jsonResponse(rows)
}

function handleApiInstinctsApprove(url: URL, projectId: string | null = null): Response {
  const parts = url.pathname.split('/')
  const id = parts[3]
  if (!id) return errorResponse('Missing instinct id', 400)
  const row = listInstincts({ projectId }).find((item) => item.id === id)
  const ok = row ? approveInstinct(id) : false
  const result: MutationResult = ok ? { ok: true } : { ok: false, error: 'Instinct not found' }
  return jsonResponse(result, ok ? 200 : 404)
}

function handleApiInstinctsReject(url: URL, projectId: string | null = null): Response {
  const parts = url.pathname.split('/')
  const id = parts[3]
  if (!id) return errorResponse('Missing instinct id', 400)
  const row = listInstincts({ projectId }).find((item) => item.id === id)
  const ok = row ? deleteInstinct(id) : false
  const result: MutationResult = ok ? { ok: true } : { ok: false, error: 'Instinct not found' }
  return jsonResponse(result, ok ? 200 : 404)
}

async function handleApiInstinctsCreate(
  req: Request,
  projectId: string | null = null,
): Promise<Response> {
  let body: { trigger: string; action: string }
  try {
    body = (await req.json()) as { trigger: string; action: string }
  } catch {
    return errorResponse('Invalid JSON', 400)
  }
  if (!body.trigger?.trim() || !body.action?.trim()) {
    return errorResponse('trigger and action are required', 400)
  }
  try {
    const instinct = insertInstinct({
      projectId,
      trigger: body.trigger.trim().slice(0, 500),
      action: body.action.trim().slice(0, 500),
      ...MANUAL_DEFAULTS,
    })
    return jsonResponse({ ok: true, id: instinct.id })
  } catch (e: any) {
    return errorResponse(e.message, 400)
  }
}

async function handleApiInstinctsPropose(
  req: Request,
  projectId: string | null = null,
): Promise<Response> {
  let body: { trigger: string; action: string }
  try {
    body = (await req.json()) as { trigger: string; action: string }
  } catch {
    return errorResponse('Invalid JSON', 400)
  }
  if (!body.trigger?.trim() || !body.action?.trim()) {
    return errorResponse('trigger and action are required', 400)
  }
  try {
    const instinct = insertInstinct({
      projectId,
      trigger: body.trigger.trim().slice(0, 500),
      action: body.action.trim().slice(0, 500),
      ...AUTO_DEFAULTS,
    })
    return jsonResponse({ ok: true, id: instinct.id })
  } catch (e: any) {
    return errorResponse(e.message, 400)
  }
}

async function handleApiInstinctsSetConfidence(
  req: Request,
  url: URL,
  projectId: string | null = null,
): Promise<Response> {
  const id = url.pathname.split('/')[3]
  if (!id) return errorResponse('Missing instinct id', 400)
  let body: { confidence: number }
  try {
    body = (await req.json()) as { confidence: number }
  } catch {
    return errorResponse('Invalid JSON', 400)
  }
  const val = Number(body.confidence)
  if (isNaN(val) || val < 0 || val > 1)
    return errorResponse('confidence must be a number between 0 and 1', 400)
  const row = listInstincts({ projectId }).find((item) => item.id === id)
  const ok = row ? updateConfidence(id, val) : false
  const result: MutationResult = ok ? { ok: true } : { ok: false, error: 'Instinct not found' }
  return jsonResponse(result, ok ? 200 : 404)
}

// I.8 (Mes 18) — solo las propuestas sin verificar podían borrarse (vía
// /reject). Un instinct ya aprobado/activo no tenía forma de eliminarse.
// DELETE plano, semánticamente separado de /reject (que es una decisión de
// revisión de propuesta, no un borrado genérico).
function handleApiInstinctsDelete(url: URL, projectId: string | null = null): Response {
  const id = url.pathname.slice('/api/instincts/'.length)
  if (!id) return errorResponse('Missing instinct id', 400)
  const row = listInstincts({ projectId }).find((item) => item.id === id)
  const ok = row ? deleteInstinct(id) : false
  const result: MutationResult = ok ? { ok: true } : { ok: false, error: 'Instinct not found' }
  return jsonResponse(result, ok ? 200 : 404)
}

// v0.12 Bloque A — borrado en lote, reusa deleteInstinct() por id.
async function handleApiInstinctsBulkDelete(
  req: Request,
  projectId: string | null = null,
): Promise<Response> {
  let body: { ids?: unknown }
  try {
    body = (await req.json()) as { ids?: unknown }
  } catch {
    return errorResponse('Invalid JSON', 400)
  }
  if (!Array.isArray(body.ids) || body.ids.length === 0)
    return errorResponse('ids must be a non-empty array', 400)
  const ids = body.ids.filter((id): id is string => typeof id === 'string')
  let deleted = 0
  const owned = new Set(listInstincts({ projectId }).map((item) => item.id))
  for (const id of ids) if (owned.has(id) && deleteInstinct(id)) deleted++
  return jsonResponse({ ok: true, deleted })
}

export {
  handleApiInstincts,
  handleApiInstinctsApprove,
  handleApiInstinctsBulkDelete,
  handleApiInstinctsCreate,
  handleApiInstinctsDelete,
  handleApiInstinctsPropose,
  handleApiInstinctsReject,
  handleApiInstinctsSetConfidence,
}
