import { readActiveSessionStatus } from '../../../scripts/session-status.ts'
import { jsonResponse } from '../http.ts'

/**
 * H.7.5 — métricas de la sesión interactiva más reciente del proyecto.
 * Solo devuelve el contrato normalizado: nunca rutas ni contenido del transcript.
 */
export async function handleApiSessionStatus(root: string): Promise<Response> {
  const status = await readActiveSessionStatus({ projectRoot: root })
  return jsonResponse(
    status ?? { available: false, observedAt: null, context: null, rateLimits: null },
  )
}
