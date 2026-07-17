/**
 * src/router/auto-route.ts
 *
 * Maps a Task + OrcheConfig to a concrete {provider, model} pair.
 * Uses classifyTask (existing) to determine the role, then looks up the config.
 *
 * Priority (highest → lowest):
 *   1. task.executor_model (per-task override in tasks.yaml)
 *   2. config role match  (from orchestos.config.yaml)
 *   3. null               → harness falls back to resolveModel + task.executor
 */

import { classifyTask, type TaskClass } from './classify.ts'
import type { OrcheConfig, ModelRoleConfig } from '../config/schema.ts'
import type { Task } from '../tasks/schema.ts'

export interface RouteResult {
  provider: string
  model: string
  /** Which config role was matched (for logging/display) */
  role: 'planner' | 'executor_heavy' | 'executor_light' | 'default'
}

/** Maps classifyTask output → config role */
const CLASS_TO_ROLE: Record<TaskClass, 'planner' | 'executor_heavy' | 'executor_light' | 'default'> = {
  plan:      'planner',
  fix:       'executor_heavy',
  implement: 'executor_heavy',
  review:    'executor_light',
  doc:       'executor_light',
}

/**
 * Resolve the route for a task given the loaded config.
 * Returns null if config is the default (no user file found) — signals harness to use legacy path.
 */
export function autoRoute(task: Task, config: OrcheConfig, configFound: boolean): RouteResult | null {
  // Per-task executor_model always wins — but we still need a provider
  // The provider comes from the role lookup; model is overridden by the task field.
  // If no config file was found AND no per-task override → return null (legacy path)
  if (!configFound && !task.executor_model) return null

  const taskClass = classifyTask(task.description)
  let role = CLASS_TO_ROLE[taskClass]
  // Structural guarantee, independent of classifyTask's keyword heuristic:
  // the planner role never becomes the executor for a task with real output
  // files. Planner is for planning/scaffolding-without-deliverables; a task
  // that declares files to write must run on an executor tier, even if the
  // description got misclassified as 'plan'.
  if (role === 'planner' && task.output.length > 0) role = 'executor_heavy'
  const roleCfg: ModelRoleConfig = config.models[role]

  const provider = roleCfg.provider
  const model    = task.executor_model ?? (roleCfg.model || roleCfg.provider)

  return { provider, model, role }
}

/**
 * Format a RouteResult for display in config show / runs --detail.
 * e.g. "openrouter/deepseek/deepseek-v4-flash (executor_heavy)"
 */
export function formatRoute(r: RouteResult): string {
  const modelStr = r.model ? `${r.provider}/${r.model}` : r.provider
  return `${modelStr} (${r.role})`
}
