import type { ProjectContext } from '../types/orchestos'

async function getJson<T>(path: string, projectId: string): Promise<T> {
  const response = await fetch(path, { headers: { 'x-orchestos-project-id': projectId } })
  if (!response.ok) throw new Error(`Request failed (${response.status})`)
  return response.json() as Promise<T>
}

export async function getProjectContext(projectId: string): Promise<ProjectContext> {
  const [context, git] = await Promise.all([
    getJson<{ content: string; exists: boolean }>('/api/project/context', projectId),
    getJson<{
      gitBranch: string | null
      isCleanWorktree: boolean | null
    }>('/api/project/git', projectId),
  ])
  return {
    contextDoc: context.exists ? context.content : 'CONTEXT.md does not exist in this project.',
    gitBranch: git.gitBranch,
    isCleanWorktree: git.isCleanWorktree,
  }
}

export interface ProjectGitStatus {
  isGitRepo: boolean
  hasCommits: boolean
}

export function getProjectGit(projectId: string): Promise<ProjectGitStatus> {
  return getJson<ProjectGitStatus>('/api/project/git', projectId)
}

export async function initializeProjectGit(
  projectId: string,
): Promise<{ ok: boolean; commit: string; excluded: string[] }> {
  const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/git-init`, {
    method: 'POST',
  })
  const data = (await response.json()) as {
    ok: boolean
    commit: string
    excluded: string[]
    error?: string
  }
  if (!response.ok) throw new Error(data.error ?? `Request failed (${response.status})`)
  return data
}
