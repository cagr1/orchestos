import { getProject, type ProjectRow, upsertProject } from '../db/projects.ts'
import { buildProfile } from '../detect/profile.ts'
import { generateAgentsMd } from '../generators/agents-md.ts'

/**
 * Registers a project in the local database without materializing any files in
 * its root. Both the CLI index command and the dashboard folder picker share
 * this boundary so registering a project never implies initializing it.
 */
export async function ensureProject(root: string): Promise<ProjectRow> {
  const existing = getProject(root)
  if (existing) return existing

  const profile = await buildProfile(root)
  const agentsMd = generateAgentsMd(profile)
  upsertProject(root, profile, agentsMd)

  const created = getProject(root)
  if (!created) throw new Error(`[project] failed to save project context for ${root}`)
  return created
}
