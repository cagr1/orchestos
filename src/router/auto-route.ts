import type { OrcheConfig, RoleAgent } from '../config/schema.ts'
import type { Task } from '../tasks/schema.ts'

export interface RouteResult {
  agent: RoleAgent
  provider: string
  model: string
  effort?: string
  source: 'task' | 'executor'
}

export function autoRoute(task: Task, cfg: OrcheConfig): RouteResult | null {
  if (task.executor_model)
    return { agent: 'api', provider: task.executor, model: task.executor_model, source: 'task' }
  const a = cfg.roles.executor
  if (!a) return null
  return {
    agent: a.agent,
    provider: a.provider ?? (a.agent === 'api' ? 'openrouter' : a.agent),
    model: a.model,
    effort: a.effort,
    source: 'executor',
  }
}

export function formatRoute(route: RouteResult): string {
  return `${route.agent}/${route.model} (${route.source})${route.effort ? ` · ${route.effort}` : ''}`
}
