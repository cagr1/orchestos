import {
  readActiveSessionStatuses,
  readClaudeStatuslineRateLimits,
  refreshClaudeUsageLive,
  type SessionStatus,
} from '../../../scripts/session-status.ts'
import { readCliHealth } from '../../run/executors/cli-health.ts'
import { allClis } from '../../run/executors/cli-registry.ts'
import { jsonResponse } from '../http.ts'

const statusCache = new Map<
  string,
  { clis: Awaited<ReturnType<typeof readActiveSessionStatuses>>; refreshedAt: number }
>()
const statusRefreshes = new Map<string, Promise<void>>()
const STATUS_CACHE_MAX_AGE_MS = 10_000
const STATUS_REFRESH_TIMEOUT_MS = 3_000

export function claudeUsageRefresher(
  env: NodeJS.ProcessEnv = process.env,
): (() => ReturnType<typeof refreshClaudeUsageLive>) | undefined {
  if (env.ORCHESTOS_CLAUDE_USAGE_LIVE === '0') return undefined
  return () => refreshClaudeUsageLive()
}

export function withFreshClaudeQuota(
  clis: SessionStatus[],
  read = readClaudeStatuslineRateLimits,
): SessionStatus[] {
  let reading: ReturnType<typeof readClaudeStatuslineRateLimits>
  try {
    reading = read()
  } catch {
    return clis
  }
  if (!reading) return clis

  return clis.map((cli) => {
    if (cli.id !== 'claude') return cli
    const rateLimits = { source: 'claude' as const, windows: reading.windows }
    if (cli.available) return { ...cli, rateLimits }
    return {
      ...cli,
      available: true,
      observedAt: reading.observedAt,
      context: null,
      rateLimits,
    }
  })
}

/**
 * H.7.5 — métricas de la sesión interactiva más reciente del proyecto.
 * Solo devuelve el contrato normalizado: nunca rutas ni contenido del transcript.
 */
export async function handleApiSessionStatus(
  root: string,
  deps: {
    health?: typeof readCliHealth
    statuses?: typeof readActiveSessionStatuses
  } = {},
): Promise<Response> {
  const health = await (deps.health ?? readCliHealth)()
  const definitions = allClis()
  const respond = (statuses: SessionStatus[]) => {
    const clis = statuses.map((cli) => ({
      ...cli,
      functional: health.find((entry) => entry.id === cli.id)?.functional ?? false,
      quotaSource: definitions.find((entry) => entry.id === cli.id)?.quotaSource ?? false,
    }))
    return jsonResponse({ available: clis.some((cli) => cli.available), clis })
  }
  // Explicit transcript paths are test/runtime overrides and must not share the
  // project's normal cache entry.
  const cacheKey = `${root}\0${process.env.ORCHESTOS_SESSION_TRANSCRIPT ?? ''}`
  const cached = statusCache.get(cacheKey)
  const refresh = async () => {
    const pending = statusRefreshes.get(cacheKey)
    if (pending) return pending
    const promise = (deps.statuses ?? readActiveSessionStatuses)({
      projectRoot: root,
      refreshClaudeUsage: claudeUsageRefresher(),
    })
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
        // Claude's statusline is cheap; keep its quota fresh even when Codex delays refresh.
        // The slow Codex rate-limit request must not age Claude's displayed quota.
        const clis = withFreshClaudeQuota(refreshed.clis)
        return respond(clis)
      }
    } else {
      // Si falla en segundo plano, se conserva la caché.
      void refresh().catch(() => {})
    }
    const clis = withFreshClaudeQuota(cached.clis)
    return respond(clis)
  }
  await refresh()
  const clis = withFreshClaudeQuota(statusCache.get(cacheKey)?.clis ?? [])
  return respond(clis)
}
