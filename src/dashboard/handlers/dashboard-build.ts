import { jsonResponse } from '../http.ts'
import type { DashboardBuildResponse } from '../types.ts'

export interface DashboardBuildProbe {
  readHeadCommit(root: string): string | null
}

export const systemDashboardBuildProbe: DashboardBuildProbe = {
  readHeadCommit(root) {
    try {
      const result = Bun.spawnSync(['git', '-C', root, 'rev-parse', 'HEAD'], {
        stdout: 'pipe',
        stderr: 'pipe',
      })
      return result.exitCode === 0 ? result.stdout.toString().trim() || null : null
    } catch {
      return null
    }
  },
}

export function createDashboardBuildHandler(
  root: string,
  probe: DashboardBuildProbe = systemDashboardBuildProbe,
): () => Response {
  const startedAt = new Date().toISOString()
  const startCommit = probe.readHeadCommit(root)
  return () => {
    const info: DashboardBuildResponse = {
      startedAt,
      startCommit,
      headCommit: probe.readHeadCommit(root),
    }
    return jsonResponse(info)
  }
}
