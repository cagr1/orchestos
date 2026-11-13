import { badRequest, readBody, z } from '../../boundary/index.ts'
import { db } from '../../db/sqlite.ts'
import { GraduationSymlinkError, graduateLesson } from '../../instincts/graduate.ts'
import { AUTO_DEFAULTS, MANUAL_DEFAULTS } from '../../instincts/schema.ts'
import {
  approveInstinct,
  deleteInstinct,
  insertInstinct,
  listInstincts,
  setInstinctStatus,
  sweepStaleLessons,
  updateConfidence,
  updateInstinct,
} from '../../instincts/store.ts'
import { errorResponse, jsonResponse } from '../http.ts'
import type { InstinctRow, MutationResult } from '../types.ts'

const lessonFields = {
  trigger: z
    .string()
    .trim()
    .min(1)
    .transform((value) => value.slice(0, 500))
    .optional(),
  action: z
    .string()
    .trim()
    .min(1)
    .transform((value) => value.slice(0, 500))
    .optional(),
  why: z
    .string()
    .trim()
    .transform((value) => value.slice(0, 1000))
    .optional(),
}
const evidenceSchema = z
  .object({
    runId: z.string().max(200).optional(),
    turnId: z.string().max(200).optional(),
    ref: z.string().max(200).optional(),
  })
  .optional()

function instinctMutationError(error: unknown): Response {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('UNIQUE')
    ? errorResponse('A lesson with this trigger already exists', 409)
    : errorResponse(message, 400)
}

function handleApiInstincts(projectId: string | null = null): Response {
  sweepStaleLessons()
  const all = listInstincts({ projectId })
  const rows: InstinctRow[] = all.map((i) => ({
    status: i.status,
    statusChangedAt: i.statusChangedAt,
    id: i.id,
    projectId: i.project_id,
    trigger: i.trigger,
    action: i.action,
    confidence: i.confidence,
    source: i.source,
    verified: i.verified,
    createdAt: i.created_at,
    why: i.why,
    evidence: i.evidence,
    injectedCount: i.injectedCount,
    lastInjectedAt: i.lastInjectedAt,
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

async function handleApiInstinctsStatus(
  req: Request,
  url: URL,
  projectId: string | null = null,
): Promise<Response> {
  const parsed = await readBody(z.object({ status: z.enum(['active', 'retired']) }), req)
  if (!parsed.ok) return badRequest(parsed.error)
  const row = listInstincts({ projectId }).find((item) => item.id === url.pathname.split('/')[3])
  if (!row) return errorResponse('Instinct not found', 404)
  setInstinctStatus(row.id, parsed.data.status)
  return jsonResponse({ ok: true })
}

async function handleApiInstinctsGraduate(
  req: Request,
  url: URL,
  root: string,
  projectId: string | null = null,
): Promise<Response> {
  if (!projectId) return errorResponse('project required', 400)
  const row = listInstincts({ projectId }).find((item) => item.id === url.pathname.split('/')[3])
  if (!row) return errorResponse('Instinct not found', 404)
  if (row.project_id === null) return errorResponse('Global lessons cannot be graduated', 400)
  if (row.status === 'retired' || !row.verified)
    return errorResponse('Lesson must be verified and not retired', 409)
  const parsed = await readBody(z.object({ confirm: z.boolean().optional() }), req)
  if (!parsed.ok) return badRequest(parsed.error)
  try {
    const { path, added, created } = graduateLesson(root, row, {
      write: parsed.data.confirm === true,
    })
    if (parsed.data.confirm === true) setInstinctStatus(row.id, 'retired')
    return jsonResponse({ ok: true, path, added, created })
  } catch (error) {
    if (error instanceof GraduationSymlinkError) return errorResponse(error.message, 409)
    throw error
  }
}

async function handleApiInstinctsCreate(
  req: Request,
  projectId: string | null = null,
): Promise<Response> {
  const parsed = await readBody(z.object({ ...lessonFields, evidence: evidenceSchema }), req)
  if (!parsed.ok)
    return badRequest(parsed.error === 'invalid JSON body' ? 'Invalid JSON' : parsed.error)
  const body = parsed.data
  if (!body.trigger?.trim() || !body.action?.trim()) {
    return errorResponse('trigger and action are required', 400)
  }
  try {
    const instinct = insertInstinct({
      projectId,
      trigger: body.trigger.trim().slice(0, 500),
      action: body.action.trim().slice(0, 500),
      why: body.why,
      evidence: body.evidence,
      ...MANUAL_DEFAULTS,
    })
    return jsonResponse({ ok: true, id: instinct.id })
  } catch (error) {
    return instinctMutationError(error)
  }
}

async function handleApiInstinctsPropose(
  req: Request,
  projectId: string | null = null,
): Promise<Response> {
  const parsed = await readBody(z.object({ ...lessonFields, evidence: evidenceSchema }), req)
  if (!parsed.ok)
    return badRequest(parsed.error === 'invalid JSON body' ? 'Invalid JSON' : parsed.error)
  const body = parsed.data
  if (!body.trigger?.trim() || !body.action?.trim()) {
    return errorResponse('trigger and action are required', 400)
  }
  try {
    const instinct = insertInstinct({
      projectId,
      trigger: body.trigger.trim().slice(0, 500),
      action: body.action.trim().slice(0, 500),
      why: body.why,
      evidence: body.evidence,
      ...AUTO_DEFAULTS,
    })
    return jsonResponse({ ok: true, id: instinct.id })
  } catch (error) {
    return instinctMutationError(error)
  }
}

async function handleApiInstinctsUpdate(
  req: Request,
  url: URL,
  projectId: string | null = null,
): Promise<Response> {
  const id = url.pathname.split('/')[3]
  const row = listInstincts({ projectId }).find((item) => item.id === id)
  if (!row) return errorResponse('Instinct not found', 404)
  const parsed = await readBody(z.object(lessonFields), req)
  if (!parsed.ok)
    return badRequest(parsed.error === 'invalid JSON body' ? 'Invalid JSON' : parsed.error)
  try {
    updateInstinct(row.id, parsed.data)
    return jsonResponse({ ok: true })
  } catch (error) {
    return instinctMutationError(error)
  }
}

async function handleApiInstinctsSetConfidence(
  req: Request,
  url: URL,
  projectId: string | null = null,
): Promise<Response> {
  const id = url.pathname.split('/')[3]
  if (!id) return errorResponse('Missing instinct id', 400)
  const parsed = await readBody(z.object({ confidence: z.number().finite().min(0).max(1) }), req)
  if (!parsed.ok)
    return badRequest(
      parsed.error === 'invalid JSON body'
        ? 'Invalid JSON'
        : parsed.error.startsWith('confidence:')
          ? 'confidence must be a number between 0 and 1'
          : parsed.error,
    )
  const body = parsed.data
  const val = body.confidence
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
  const parsed = await readBody(z.object({ ids: z.array(z.string()).optional() }), req)
  if (!parsed.ok)
    return badRequest(
      parsed.error === 'invalid JSON body'
        ? 'Invalid JSON'
        : parsed.error.startsWith('ids:')
          ? 'ids must be a non-empty array'
          : parsed.error,
    )
  const body = parsed.data
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
  handleApiInstinctsGraduate,
  handleApiInstinctsPropose,
  handleApiInstinctsReject,
  handleApiInstinctsSetConfidence,
  handleApiInstinctsStatus,
  handleApiInstinctsUpdate,
}
