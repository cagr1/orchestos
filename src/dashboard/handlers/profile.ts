import { readUserProfile, writeUserProfile } from '../../config/user-profile.ts'
import { errorResponse, jsonResponse } from '../http.ts'

export function handleApiProfileGet(): Response {
  return jsonResponse(readUserProfile())
}

export async function handleApiProfilePut(req: Request): Promise<Response> {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return errorResponse('Invalid JSON', 400)
  }
  if (!body || typeof body !== 'object' || !('codes' in body) || typeof body.codes !== 'boolean')
    return errorResponse('codes must be a boolean', 400)
  writeUserProfile({ codes: body.codes })
  return jsonResponse(readUserProfile())
}
