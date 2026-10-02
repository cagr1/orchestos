import { dashboardProjectFromId, resolveDashboardProject } from './project-context.ts'

export type ProjectScope = { kind: 'project'; id: string; root: string } | { kind: 'none' }

export function requestScope(req: Request): ProjectScope {
  const url = new URL(req.url)
  const header = req.headers.get('x-orchestos-project-id')?.trim()
  const query = url.searchParams.get('project')?.trim()
  if (query === 'none' && !header) return { kind: 'none' }
  const selected = header || (query && query !== 'none' ? query : null)
  if (selected) {
    const project = dashboardProjectFromId(selected)
    return project.id ? { kind: 'project', id: project.id, root: project.root } : { kind: 'none' }
  }
  const project = resolveDashboardProject(req)
  return project.id ? { kind: 'project', id: project.id, root: project.root } : { kind: 'none' }
}

export function ownsRow(scope: ProjectScope, rowProjectId: string | null): boolean {
  return scope.kind === 'project' ? rowProjectId === scope.id : rowProjectId === null
}
