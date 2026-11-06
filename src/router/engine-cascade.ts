/** Match a task's output or skill to its first configured agent rule. */

import type { OrcheConfig, TaskAgentRule } from '../config/schema.ts'

import {
  cliTaskEngineIds,
  taskEngineById,
  taskEngineForCli,
} from '../run/executors/task-engines.ts'

export function taskAgentIds(): string[] {
  return ['local', ...cliTaskEngineIds().map((id) => taskEngineById(id)!.cliId), 'api']
}

export function taskFieldsFromRule(
  rule: TaskAgentRule,
  cfg: OrcheConfig,
): { engine?: string; executor_model?: string; cli_effort?: string } | { error: string } {
  const engine = taskEngineForCli(rule.agent)?.engineId
  if (engine && !rule.model && rule.agent !== cfg.roles.executor?.agent)
    return {
      error: `Task rule for ${rule.agent} has no model. Set it in Settings → Task rules.`,
    }
  return {
    ...(engine ? { engine } : {}),
    ...(rule.model ? { executor_model: rule.model } : {}),
    ...(rule.cli_effort ? { cli_effort: rule.cli_effort } : {}),
  }
}
/**
 * I.3 (Mes 30, 2026-09-04) — reglas persistentes por proyecto. `output` matchea por glob (Bun.Glob,
 * sin dependencia nueva) contra `Task.output`; `skill` por id exacto. Decisión
 * de implementación (no producto): si una tarea matchea reglas de ambos tipos,
 * gana `output` por ser más específico (una tarea puede tener skill genérica
 * pero vivir en una carpeta con dueño claro). Primera regla que matchea, en
 * orden de declaración, gana — sin merge de reglas parciales.
 */
export function resolveProjectAgentRule(
  rules: TaskAgentRule[] | undefined,
  task: { output: string[]; skill?: string },
): TaskAgentRule | undefined {
  if (!rules?.length) return undefined
  const byOutput = rules.find(
    (r) =>
      r.match.output?.length &&
      task.output.some((path) =>
        r.match.output!.some((pattern) => new Bun.Glob(pattern).match(path)),
      ),
  )
  if (byOutput) return byOutput
  if (!task.skill) return undefined
  return rules.find((r) => r.match.skill === task.skill)
}
