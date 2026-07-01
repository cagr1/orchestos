import { resolve } from 'path'
import { resetTestData } from '../../db/reset.ts'
import { jsonResponse, errorResponse } from '../http.ts'

async function handleApiSystemReset(req: Request): Promise<Response> {
  let body: { confirm?: boolean } = {}
  try { body = await req.json() as { confirm?: boolean } } catch {}
  if (body.confirm !== true) return errorResponse('confirm:true required', 400)
  const summary = resetTestData(resolve('.'))
  return jsonResponse({ ok: true, ...summary })
}

export { handleApiSystemReset }
