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
  const p = prompt.toLowerCase().trim()
  // "plan"/"design"/"diseña" only signal planning intent when they lead the
  // sentence as an imperative ("Design the architecture...", "Plan the
  // migration..."). Matched anywhere in the text they false-positive on
  // completely ordinary implementation language ("responsive design",
  // "pricing plan") and silently downgrade a real build task to the
  // lightweight planner-tier model instead of the executor model — regression
  // found 2026-07-17 (Mes 22, crypto-terminal-v3: "...responsive design, no
  // build tooling" routed to claude-haiku-4-5/planner instead of
  // deepseek/executor_heavy). Unambiguous structural terms stay bare-matched.
  if (/^(plan|design|diseña)\b/.test(p)) return 'plan'
  if (/arquitectura|estructura|architect|scaffold|blueprint|roadmap/.test(p)) return 'plan'
  if (/fix|error|bug|falla|corrige|broken|crash|fails|wrong/.test(p)) return 'fix'
  if (/documenta|explica|describe|doc|comment|readme|changelog/.test(p)) return 'doc'
  if (/revisa|review|analiza|audit|check|inspect|evalúa/.test(p)) return 'review'
  return 'implement'
}
