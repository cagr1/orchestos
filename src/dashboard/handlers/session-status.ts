import { readActiveSessionStatuses } from '../../../scripts/session-status.ts'
import { jsonResponse } from '../http.ts'

const statusCache = new Map<
  string,
  { clis: Awaited<ReturnType<typeof readActiveSessionStatuses>>; refreshedAt: number }
>()
const statusRefreshes = new Map<string, Promise<void>>()
const STATUS_CACHE_MAX_AGE_MS = 10_000
const STATUS_REFRESH_TIMEOUT_MS = 3_000

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
        statusCache.set(cacheKey, { clis, refreshedAt: Date.now() })
      })
      .finally(() => statusRefreshes.delete(cacheKey))
    statusRefreshes.set(cacheKey, promise)
    return promise
  }
  if (cached) {
    if (Date.now() - cached.refreshedAt > STATUS_CACHE_MAX_AGE_MS) {
      await Promise.race([
        refresh(),
        new Promise<void>((resolve) => setTimeout(resolve, STATUS_REFRESH_TIMEOUT_MS)),
      ])
      const refreshed = statusCache.get(cacheKey)
      if (refreshed) {
        return jsonResponse({
          available: refreshed.clis.some((cli) => cli.available),
          clis: refreshed.clis,
        })
      }
    } else {
      void refresh()
    }
    return jsonResponse({ available: cached.clis.some((cli) => cli.available), clis: cached.clis })
  }
  await refresh()
  const clis = statusCache.get(cacheKey)?.clis ?? []
  return jsonResponse({ available: clis.some((cli) => cli.available), clis })
}
