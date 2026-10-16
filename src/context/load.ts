import { getProject, upsertProject } from '../db/projects.ts'
import { buildProfile } from '../detect/profile.ts'
import { generateAgentsMd, type StackProfile } from '../generators/agents-md.ts'

export function loadContext(projectPath: string): string {
  const profile = getProject(projectPath)
  if (!profile) return ''
  return profile.agents_md
}

export async function refreshProjectContext(
  root: string,
): Promise<{ profile: StackProfile; agentsMd: string } | null> {
  const row = getProject(root)
  if (!row) return null

  const profile = await buildProfile(root)
  const agentsMd = generateAgentsMd(profile)
  if (agentsMd !== row.agents_md) upsertProject(root, profile, agentsMd)
  return { profile, agentsMd }
}
