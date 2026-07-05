import { resolve } from 'path'
import { resetTestData } from '../../db/reset.ts'
import { jsonResponse, errorResponse } from '../http.ts'
import { findClaudeBinary } from '../../run/executors/external.ts'

async function handleApiSystemReset(req: Request): Promise<Response> {
  let body: { confirm?: boolean } = {}
  try { body = await req.json() as { confirm?: boolean } } catch {}
  if (body.confirm !== true) return errorResponse('confirm:true required', 400)
  const summary = resetTestData(resolve('.'))
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

export { handleApiSystemReset, handleApiSystemEnginesExternalAvailability }
