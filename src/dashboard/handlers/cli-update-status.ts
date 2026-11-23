import { readCliHealth } from '../../run/executors/cli-health.ts'
import type { CliInstallMethod } from '../../run/executors/cli-install-method.ts'
import { cliInstallReason, detectCliInstall } from '../../run/executors/cli-install-method.ts'
import { allClis } from '../../run/executors/cli-registry.ts'
import { compareVersions, readLatestFor } from '../../run/executors/cli-updates.ts'
import { jsonResponse } from '../http.ts'

export interface CliUpdateEntry {
  id: string
  label: string
  version: string | null
  latestVersion: string | null
  updateAvailable: boolean
  method: CliInstallMethod
  canUpdate: boolean
  reason?: string
}
export function createCliUpdateStatus(
  dependencies: {
    health?: typeof readCliHealth
    detect?: typeof detectCliInstall
    latest?: typeof readLatestFor
    now?: () => number
  } = {},
) {
  let clis: CliUpdateEntry[] = []
  let checkedAt: number | null = null
  let pending: Promise<void> | undefined
  let generation = 0
  const now = dependencies.now ?? Date.now
  function refresh(): Promise<void> {
    const current = generation
    let task: Promise<void>
    task = (async () => {
      const states = await (dependencies.health ?? readCliHealth)()
      const entries = await Promise.all(
        states
          .filter(
            (state) =>
              state.installed && state.path && ['claude', 'codex', 'opencode'].includes(state.id),
          )
          .map(async (state): Promise<CliUpdateEntry> => {
            const install = (dependencies.detect ?? detectCliInstall)(state.id, state.path ?? '')
            const latestVersion = install.latest
              ? await (dependencies.latest ?? readLatestFor)(install.latest)
              : null
            const label = allClis().find((cli) => cli.id === state.id)?.label ?? state.id
            return {
              id: state.id,
              label,
              version: state.version,
              latestVersion,
              updateAvailable: Boolean(
                state.version && latestVersion && compareVersions(state.version, latestVersion) < 0,
              ),
              method: install.method,
              canUpdate: install.command !== null,
              ...(install.command === null
                ? { reason: cliInstallReason(label, install.realPath) }
                : {}),
            }
          }),
      )
      if (current === generation) {
        clis = entries
        checkedAt = now()
      }
    })()
      .catch(() => {
        if (current === generation) checkedAt = now()
      })
      .finally(() => {
        if (pending === task) pending = undefined
      })
    pending = task
    return task
  }
  const read = (url: URL) => {
    if (
      !pending &&
      (checkedAt === null ||
        now() - checkedAt >= 30 * 60_000 ||
        url.searchParams.get('refresh') === '1')
    )
      refresh()
    return jsonResponse({ checking: pending !== undefined, checkedAt, clis })
  }
  return Object.assign(read, {
    invalidate: () => {
      generation++
      checkedAt = null
    },
    refreshNow: () => {
      generation++
      return refresh()
    },
  })
}
export const handleApiCliUpdates = createCliUpdateStatus()
