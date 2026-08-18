import { listProjects } from '../../db/projects.ts'
import { jsonResponse } from '../http.ts'
import type { ProjectRow } from '../types.ts'

export function handleApiProjects(): Response {
  const rows: ProjectRow[] = listProjects().map(project => ({
    id: project.id,
    path: project.path,
    stackProfile: project.stack_profile,
    lastUpdated: project.last_updated,
  }))
  return jsonResponse(rows)
}
