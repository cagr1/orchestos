import { getProject } from '../db/projects.ts'

export function loadContext(projectPath: string): string {
  const profile = getProject(projectPath)
  if (!profile) return ''
  return profile.agents_md
}
