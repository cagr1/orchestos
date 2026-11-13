import { badRequest, readBody, z } from '../../boundary/index.ts'
import { resetTestData } from '../../db/reset.ts'
import { findClaudeBinary } from '../../run/executors/external.ts'
import { errorResponse, jsonResponse } from '../http.ts'

async function handleApiSystemReset(
  req: Request,
  root: string,
  projectId: string | null,
): Promise<Response> {
  if (!projectId) return errorResponse('project required', 400)
  const parsed = await readBody(z.object({ confirm: z.boolean().optional() }), req)
  if (!parsed.ok)
    return badRequest(
      parsed.error === 'invalid JSON body'
        ? 'confirm:true required'
        : parsed.error.startsWith('confirm:')
          ? 'confirm:true required'
          : parsed.error,
    )
  const body = parsed.data
  if (body.confirm !== true) return errorResponse('confirm:true required', 400)
  const summary = resetTestData(root, projectId)
  return jsonResponse({ ok: true, ...summary })
}

/**
 * C.2 — el composer del dashboard consulta este endpoint cuando el usuario
 * selecciona `engine: external` y muestra un aviso si el binario no está.
 * Mismo `Bun.which` que el engine y la CLI usan — sin drift, sin decisiones
 * independientes. `hint` apunta a la página de instalación oficial para que
 * el usuario no se quede adivinando.
 */
function handleApiSystemEnginesExternalAvailability(): Response {
  const path = findClaudeBinary()
  return jsonResponse({
    engine: 'external',
    available: path !== null,
    path,
    installUrl: 'https://claude.com/download',
  })
}

export { handleApiSystemEnginesExternalAvailability, handleApiSystemReset }
