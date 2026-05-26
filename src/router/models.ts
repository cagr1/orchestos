import type { TaskClass } from './classify.ts'

// OpenRouter model IDs — change any of these without touching the rest of the code.
// Full list: https://openrouter.ai/models
export const MODEL_MAP: Record<TaskClass, string> = {
  plan:      'deepseek/deepseek-v4-flash',
  implement: 'deepseek/deepseek-v4-flash',
  fix:       'deepseek/deepseek-v4-flash',
  review:    'deepseek/deepseek-v4-flash',
  doc:       'deepseek/deepseek-v4-flash',
}

// Want to use other providers? Just swap the model IDs:
// fix:  'openai/gpt-4o-mini'
// doc:  'google/gemini-2.5-flash'
// plan: 'openai/gpt-4o'

export function resolveModel(taskClass: TaskClass): string {
  return MODEL_MAP[taskClass]
}
