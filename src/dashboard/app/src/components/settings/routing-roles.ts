export type RoutingAgent = {
  id: string
  installed: boolean
  taskEngine?: boolean
  generic?: boolean
  label?: string
  models: {
    id: string
    name: string
    efforts?: string[]
    group?: string
    vendor?: string
    default?: boolean
  }[]
  efforts: string[]
  error?: string
}

export type RoutingRoles = Record<string, { agent: string; model: string; effort?: string } | null>
export const ROUTING_ROLE_KEYS = ['orchestrator', 'executor', 'reviewer', 'auxiliary'] as const

export function routingAgentAllowed(
  role: string,
  entry: RoutingAgent,
  hidden: string[],
  assigned?: string,
) {
  return (
    entry.installed &&
    (entry.id === assigned || !hidden.includes(entry.id)) &&
    (role !== 'orchestrator' || entry.id !== 'opencode') &&
    (role === 'executor' || !entry.generic) &&
    (role !== 'executor' || entry.taskEngine !== false)
  )
}

export function routingAgentEnabled(entry: RoutingAgent) {
  return entry.installed && Boolean(entry.generic || entry.models.length)
}

export function routingAssignment(entry: RoutingAgent) {
  return {
    agent: entry.id,
    model:
      entry.models.find((model) => model.default)?.id ??
      entry.models[0]?.id ??
      (entry.generic ? 'default' : ''),
  }
}

export function suggestUnassignedRoles(
  roles: RoutingRoles,
  catalog: RoutingAgent[],
  suggested: string | null,
  hidden: string[],
) {
  if (!suggested || suggested === 'api') return roles
  const entry = catalog.find((agent) => agent.id === suggested)
  if (!entry || !routingAgentEnabled(entry)) return roles
  const unassigned = ROUTING_ROLE_KEYS.filter(
    (role) => !roles[role] && routingAgentAllowed(role, entry, hidden),
  )
  if (!unassigned.length) return roles
  return {
    ...roles,
    ...Object.fromEntries(unassigned.map((role) => [role, routingAssignment(entry)])),
  }
}
