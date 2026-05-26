export type TaskClass = 'plan' | 'implement' | 'fix' | 'review' | 'doc'

export function classifyTask(prompt: string): TaskClass {
  const p = prompt.toLowerCase()
  if (/plan|arquitectura|diseña|estructura|architect|design|scaffold/.test(p)) return 'plan'
  if (/fix|error|bug|falla|corrige|broken|crash|fails|wrong/.test(p)) return 'fix'
  if (/documenta|explica|describe|doc|comment|readme|changelog/.test(p)) return 'doc'
  if (/revisa|review|analiza|audit|check|inspect|evalúa/.test(p)) return 'review'
  return 'implement'
}
