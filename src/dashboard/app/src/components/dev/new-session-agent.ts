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

export interface DevSessionCli {
  id: string
  chat?: boolean
  terminal?: boolean
  functional?: boolean
}

export function isFunctionalDevCli(cli: DevSessionCli): boolean {
  return Boolean(cli.functional && (cli.chat || cli.terminal))
}

export function devSessionAction(cli: DevSessionCli): {
  kind: 'create-session' | 'new-tab'
  agent: string
} {
  return { kind: cli.terminal ? 'create-session' : 'new-tab', agent: cli.id }
}
