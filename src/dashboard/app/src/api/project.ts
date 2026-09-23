import type { ProjectContext } from '../types/orchestos'

async function getJson<T>(path: string, projectId: string): Promise<T> {
  const response = await fetch(path, { headers: { 'x-orchestos-project-id': projectId } })
  if (!response.ok) throw new Error(`Request failed (${response.status})`)
  return response.json() as Promise<T>
}

export async function getProjectContext(projectId: string): Promise<ProjectContext> {
  const [constitution, context, graph] = await Promise.all([
    getJson<{ content: string; exists: boolean }>('/api/project/constitution', projectId),
    getJson<{ content: string; exists: boolean }>('/api/project/context', projectId),
    getJson<{
      files: number
      edges: number
      languages: Array<{ language: string; files: number }>
      staleFiles: string[]
      gitBranch: string | null
      isCleanWorktree: boolean | null
      indexedAt: string | null
    }>('/api/project/graph', projectId),
  ])
  return {
    constitution: constitution.exists
      ? constitution.content
      : 'CONSTITUTION.md does not exist in this project.',
    contextDoc: context.exists ? context.content : 'CONTEXT.md does not exist in this project.',
    codeGraphNodes: graph.files,
    edges: graph.edges,
    languages: graph.languages,
    staleFiles: graph.staleFiles,
    gitBranch: graph.gitBranch,
    isCleanWorktree: graph.isCleanWorktree,
    indexedAt: graph.indexedAt,
  }
}
