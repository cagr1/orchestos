import { readActiveSessionStatuses } from '../../../scripts/session-status.ts'
import { jsonResponse } from '../http.ts'

const statusCache = new Map<
  string,
  { clis: Awaited<ReturnType<typeof readActiveSessionStatuses>> }
>()
const statusRefreshes = new Map<string, Promise<void>>()

/**
 * H.7.5 — métricas de la sesión interactiva más reciente del proyecto.
 * Solo devuelve el contrato normalizado: nunca rutas ni contenido del transcript.
 */
export async function handleApiSessionStatus(root: string): Promise<Response> {
  // Explicit transcript paths are test/runtime overrides and must not share the
  // project's normal cache entry.
  const cacheKey = `${root}\0${process.env.ORCHESTOS_SESSION_TRANSCRIPT ?? ''}`
  const cached = statusCache.get(cacheKey)
  const refresh = async () => {
    const pending = statusRefreshes.get(cacheKey)
    if (pending) return pending
    const promise = readActiveSessionStatuses({ projectRoot: root })
      .then((clis) => {
        statusCache.set(cacheKey, { clis })
      })
      .finally(() => statusRefreshes.delete(cacheKey))
    statusRefreshes.set(cacheKey, promise)
    return promise
  }
  if (cached) {
    void refresh()
    return jsonResponse({ available: cached.clis.some((cli) => cli.available), clis: cached.clis })
  }
  await refresh()
  const clis = statusCache.get(cacheKey)?.clis ?? []
  return jsonResponse({ available: clis.some((cli) => cli.available), clis })
}
