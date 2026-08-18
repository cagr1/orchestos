import { existsSync, realpathSync, statSync } from 'fs'
import { resolve } from 'path'
import { getProject, getProjectById } from '../db/projects.ts'

export const PROJECT_ID_HEADER = 'x-orchestos-project-id'

export interface DashboardProjectContext {
  id: string | null
  root: string
  source: 'request' | 'legacy-cwd'
}

export class DashboardProjectError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = 'DashboardProjectError'
  }
}

function checkedProjectRoot(path: string): string {
  if (!existsSync(path)) throw new DashboardProjectError('Project path no longer exists', 410)
  let root: string
  try {
    root = realpathSync(path)
  } catch {
    throw new DashboardProjectError('Project path cannot be resolved', 410)
  }
  if (!statSync(root).isDirectory()) throw new DashboardProjectError('Project path is not a directory', 410)
  return root
}

export function dashboardProjectFromId(id: string): DashboardProjectContext {
  const projectId = id.trim()
  if (!projectId) throw new DashboardProjectError('Project id is required', 400)
  const project = getProjectById(projectId)
  if (!project) throw new DashboardProjectError('Project not found', 404)
  return { id: project.id, root: checkedProjectRoot(project.path), source: 'request' }
}

/**
 * CC.3 — project selection is request-scoped. Registered ids are the only
 * accepted external selector: callers can never submit an arbitrary path.
 * The cwd fallback exists solely until UI.6 sends the header on every request.
 */
export function resolveDashboardProject(req: Request): DashboardProjectContext {
  const url = new URL(req.url)
  const selected = req.headers.get(PROJECT_ID_HEADER)?.trim()
    || url.searchParams.get('project')?.trim()
  if (selected) return dashboardProjectFromId(selected)

  const root = realpathSync(resolve('.'))
  const registered = getProject(root)
  return { id: registered?.id ?? null, root, source: 'legacy-cwd' }
}
