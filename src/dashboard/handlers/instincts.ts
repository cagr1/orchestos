import { listInstincts, approveInstinct, deleteInstinct, insertInstinct, updateConfidence } from '../../instincts/store.ts'
import { MANUAL_DEFAULTS, AUTO_DEFAULTS } from '../../instincts/schema.ts'
import type { InstinctRow, MutationResult } from '../types.ts'
import { jsonResponse, errorResponse } from '../http.ts'

function handleApiInstincts(): Response {
  const all = listInstincts()
  const rows: InstinctRow[] = all.map(i => ({
    id: i.id,
    trigger: i.trigger,
    action: i.action,
    confidence: i.confidence,
    source: i.source,
    verified: i.verified,
    createdAt: i.created_at,
  }))
  return jsonResponse(rows)
}

function handleApiInstinctsApprove(url: URL): Response {
  const parts = url.pathname.split('/')
  const id = parts[3]
  if (!id) return errorResponse('Missing instinct id', 400)
  const ok = approveInstinct(id)
  const result: MutationResult = ok ? { ok: true } : { ok: false, error: 'Instinct not found' }
  return jsonResponse(result, ok ? 200 : 404)
}

function handleApiInstinctsReject(url: URL): Response {
  const parts = url.pathname.split('/')
  const id = parts[3]
  if (!id) return errorResponse('Missing instinct id', 400)
  const ok = deleteInstinct(id)
  const result: MutationResult = ok ? { ok: true } : { ok: false, error: 'Instinct not found' }
  return jsonResponse(result, ok ? 200 : 404)
}

async function handleApiInstinctsCreate(req: Request): Promise<Response> {
  let body: { trigger: string; action: string }
  try { body = (await req.json()) as { trigger: string; action: string } } catch { return errorResponse('Invalid JSON', 400) }
  if (!body.trigger?.trim() || !body.action?.trim()) {
    return errorResponse('trigger and action are required', 400)
  }
  try {
    const instinct = insertInstinct({
      trigger: body.trigger.trim().slice(0, 500),
      action: body.action.trim().slice(0, 500),
      ...MANUAL_DEFAULTS,
    })
    return jsonResponse({ ok: true, id: instinct.id })
  } catch (e: any) {
    return errorResponse(e.message, 400)
  }
}

async function handleApiInstinctsPropose(req: Request): Promise<Response> {
  let body: { trigger: string; action: string }
  try { body = (await req.json()) as { trigger: string; action: string } } catch { return errorResponse('Invalid JSON', 400) }
  if (!body.trigger?.trim() || !body.action?.trim()) {
    return errorResponse('trigger and action are required', 400)
  }
  try {
    const instinct = insertInstinct({
      trigger: body.trigger.trim().slice(0, 500),
      action: body.action.trim().slice(0, 500),
      ...AUTO_DEFAULTS,
    })
    return jsonResponse({ ok: true, id: instinct.id })
  } catch (e: any) {
    return errorResponse(e.message, 400)
  }
}

async function handleApiInstinctsSetConfidence(req: Request, url: URL): Promise<Response> {
  const id = url.pathname.split('/')[3]
  if (!id) return errorResponse('Missing instinct id', 400)
  let body: { confidence: number }
  try { body = (await req.json()) as { confidence: number } } catch { return errorResponse('Invalid JSON', 400) }
  const val = Number(body.confidence)
  if (isNaN(val) || val < 0 || val > 1) return errorResponse('confidence must be a number between 0 and 1', 400)
  const ok = updateConfidence(id, val)
  const result: MutationResult = ok ? { ok: true } : { ok: false, error: 'Instinct not found' }
  return jsonResponse(result, ok ? 200 : 404)
}

export { handleApiInstincts, handleApiInstinctsApprove, handleApiInstinctsReject, handleApiInstinctsCreate, handleApiInstinctsPropose, handleApiInstinctsSetConfidence }
