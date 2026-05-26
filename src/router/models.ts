import type { TaskClass } from './classify.ts'

export type ModelKey = string

export const MODEL_MAP: Record<TaskClass, ModelKey> = {
  plan:      'claude-opus-4-7',
  implement: 'claude-sonnet-4-6',
  fix:       'claude-haiku-4-5',
  review:    'claude-sonnet-4-6',
  doc:       'claude-haiku-4-5',
}

export function resolveModel(taskClass: TaskClass): ModelKey {
  return MODEL_MAP[taskClass]
}
