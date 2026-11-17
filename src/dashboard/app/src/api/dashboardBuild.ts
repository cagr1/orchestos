export interface DashboardBuildResponse {
  startedAt: string
  startCommit: string | null
  headCommit: string | null
}

export async function getDashboardBuild(signal?: AbortSignal): Promise<DashboardBuildResponse> {
  const response = await fetch('/api/dashboard-build', { signal })
  if (!response.ok) throw new Error(`Request failed (${response.status})`)
  return response.json() as Promise<DashboardBuildResponse>
}

export function staleBuild(info: DashboardBuildResponse): { from: string; to: string } | null {
  if (!info.startCommit || !info.headCommit || info.startCommit === info.headCommit) return null
  return { from: info.startCommit.slice(0, 7), to: info.headCommit.slice(0, 7) }
}
