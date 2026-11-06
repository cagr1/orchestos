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
