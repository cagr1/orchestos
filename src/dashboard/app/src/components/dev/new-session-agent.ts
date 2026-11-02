import type { ConfigResponse } from '../../api/settings'

export function resolveNewSessionAgent(
  agent: string,
  roles: ConfigResponse['roleAssignments'],
): { agent: string; model?: string; effort?: string } {
  for (const role of ['orchestrator', 'executor', 'reviewer', 'auxiliary']) {
    const assignment = roles?.[role]
    if (assignment?.agent === agent) return { ...assignment }
  }
  return { agent }
}

export function isFunctionalChatCli(cli: { chat?: boolean; functional?: boolean }): boolean {
  return Boolean(cli.chat && cli.functional)
}
