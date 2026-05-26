/**
 * Task classification module.
 * Defines the TaskClass union type and the classifyTask function,
 * which maps natural language prompts (English/Spanish) onto one of five task categories.
 */

export type TaskClass = 'plan' | 'implement' | 'fix' | 'review' | 'doc'

/**
 * Classifies a task prompt into one of five categories based on keyword matching.
 * Supports both English and Spanish keywords.
 * @param prompt - The task description to classify
 * @returns A TaskClass indicating the type of task: 'plan', 'fix', 'doc', 'review', or 'implement' (default)
 */
export function classifyTask(prompt: string): TaskClass {
  const p = prompt.toLowerCase()
  if (/plan|arquitectura|diseña|estructura|architect|design|scaffold/.test(p)) return 'plan'
  if (/fix|error|bug|falla|corrige|broken|crash|fails|wrong/.test(p)) return 'fix'
  if (/documenta|explica|describe|doc|comment|readme|changelog/.test(p)) return 'doc'
  if (/revisa|review|analiza|audit|check|inspect|evalúa/.test(p)) return 'review'
  return 'implement'
}
