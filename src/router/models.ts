import type { TaskClass } from './classify.ts'

// OpenRouter model IDs — change any of these without touching the rest of the code.
// Full list: https://openrouter.ai/models
export const MODEL_MAP: Record<TaskClass, string> = {
  plan:      'anthropic/claude-opus-4-7',
  implement: 'anthropic/claude-sonnet-4-6',
  fix:       'anthropic/claude-haiku-4-5',
  review:    'anthropic/claude-sonnet-4-6',
  doc:       'anthropic/claude-haiku-4-5',
}

// Want to use other providers? Just swap the model IDs:
// fix:  'openai/gpt-4o-mini'
// doc:  'google/gemini-2.5-flash'
// plan: 'openai/gpt-4o'

export function resolveModel(taskClass: TaskClass): string {
  return MODEL_MAP[taskClass]
}
