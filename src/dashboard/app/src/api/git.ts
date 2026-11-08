export interface GitChange {
  path: string
  status: 'M' | 'A' | 'D' | 'R' | 'U'
  additions: number
  deletions: number
}

async function request<T>(path: string, projectId: string): Promise<T> {
  const response = await fetch(path, { headers: { 'x-orchestos-project-id': projectId } })
  if (!response.ok) throw new Error(`Request failed (${response.status})`)
  return response.json() as Promise<T>
}

export function getGitChanges(projectId: string, ignoreWhitespace = false) {
  return request<{ branch: string | null; files: GitChange[] }>(
    `/api/git/changes${ignoreWhitespace ? '?ignoreWhitespace=1' : ''}`,
    projectId,
  )
}

export function getGitDiff(path: string, projectId: string, ignoreWhitespace = false) {
  return request<{ path: string; patch: string }>(
    `/api/git/diff?path=${encodeURIComponent(path)}${ignoreWhitespace ? '&ignoreWhitespace=1' : ''}`,
    projectId,
  )
}
