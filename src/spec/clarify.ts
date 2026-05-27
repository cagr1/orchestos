/**
 * src/spec/clarify.ts
 *
 * Heurística v0 para detectar tareas ambiguas que deberían pedir
 * aclaración antes de gastar tokens.
 *
 * Criterio: description contiene palabras "sin dirección clara" Y no tiene
 * ningún archivo target en input[]. Si ambas condiciones se cumplen → flag.
 *
 * Deliberadamente simple — sin LLM call extra. Mes 5 puede hacer esto
 * de forma semántica si hay evidencia de que vale la pena.
 */

import type { Task } from '../tasks/schema.ts'

/** Palabras que indican ambigüedad sin un target de archivo */
const AMBIGUOUS_VERBS = [
  'optimize', 'optimiza', 'optimizar',
  'improve',  'mejora',   'mejorar',
  'refactor', 'refactoriza', 'refactorizar',
  'cleanup',  'clean up', 'limpia', 'limpiar',
  'enhance',  'mejora',
  'update',   'actualiza', 'actualizar',
  'review',   'revisa', 'revisar',
]

/**
 * Returns true if the task description is ambiguous and has no explicit input files.
 * Ambiguous = contains a broad verb without a specific file target.
 */
export function needsClarify(task: Task): boolean {
  // If there are explicit input files, the scope is already bounded
  if (task.input.length > 0) return false

  const desc = task.description.toLowerCase()
  return AMBIGUOUS_VERBS.some(verb => desc.includes(verb))
}

/**
 * Returns a human-readable reason why the task was flagged.
 */
export function clarifyReason(task: Task): string {
  const desc = task.description.toLowerCase()
  const matched = AMBIGUOUS_VERBS.find(verb => desc.includes(verb)) ?? 'broad scope'
  return `Task uses "${matched}" without specifying which files to target in input[].`
}
