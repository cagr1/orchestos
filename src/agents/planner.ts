import { parse } from 'yaml'
import { readFileSync } from 'fs'
import { validateSubTaskPlan, topoSort } from './sub-task-schema.ts'
import { createSubTask } from './sub-agent.ts'
import type { SubTask } from './sub-agent.ts'
import type { SubTaskPlan } from './sub-task-schema.ts'

export class PlanParseError extends Error {
  constructor(message: string, public readonly raw?: string) {
    super(message)
    this.name = 'PlanParseError'
  }
}

/**
 * Parses YAML text into a validated SubTaskPlan.
 * Throws PlanParseError if YAML is malformed or validation fails.
 */
export function parsePlan(yamlText: string): SubTaskPlan {
  let raw: unknown
  try {
    raw = parse(yamlText)
  } catch (e) {
    throw new PlanParseError(`YAML parse error: ${(e as Error).message}`, yamlText)
  }

  if (typeof raw !== 'object' || raw === null) {
    throw new PlanParseError('parsed YAML is not an object', yamlText)
  }

  try {
    return validateSubTaskPlan(raw)
  } catch (e) {
    throw new PlanParseError((e as Error).message, yamlText)
  }
}

/**
 * Parses YAML text, validates it, and returns fully initialized SubTask instances
 * in topological order (dependencies first).
 */
export function createPlan(yamlText: string): SubTask[] {
  const plan = parsePlan(yamlText)
  const sorted = topoSort(plan.sub_tasks)
  return sorted.map(def => createSubTask(def))
}

/**
 * Reads a YAML file and returns a ready-to-execute plan.
 */
export function parsePlanFromFile(filePath: string): SubTask[] {
  let content: string
  try {
    content = readFileSync(filePath, 'utf-8')
  } catch (e) {
    throw new PlanParseError(`cannot read file "${filePath}": ${(e as Error).message}`)
  }
  return createPlan(content)
}
