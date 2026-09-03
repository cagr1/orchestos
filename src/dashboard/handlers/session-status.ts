import { readActiveSessionStatuses } from '../../../scripts/session-status.ts'
import { jsonResponse } from '../http.ts'

/**
 * H.7.5 — métricas de la sesión interactiva más reciente del proyecto.
 * Solo devuelve el contrato normalizado: nunca rutas ni contenido del transcript.
 */
export async function handleApiSessionStatus(root: string): Promise<Response> {
  const clis = await readActiveSessionStatuses({ projectRoot: root })
  return jsonResponse(
    { available: clis.some((cli) => cli.available), clis },
  )
}
