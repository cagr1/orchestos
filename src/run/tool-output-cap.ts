/**
 * src/run/tool-output-cap.ts — IDEAS.md #32 / PLAN.md Mes 22 Bloque A.1+A.2
 *
 * Ningún punto del executor agéntico truncaba outputs de tools antes de que
 * entraran a `messages[]`: read_file devolvía el archivo completo y run_check
 * el stdout/stderr enteros. Un archivo grande o un check verboso infla el
 * prompt hasta que contextWindow−prompt ya no da para maxTokens → `pending`
 * automático (feedback-context-no-max-tokens). capToolOutput() es la
 * mitigación nativa (sin deps): cap duro por tool-result con marcador legible.
 */

const DEFAULT_MAX_CHARS = 25_000

export function capToolOutput(text: string, maxChars: number = DEFAULT_MAX_CHARS): string {
  if (text.length <= maxChars) return text
  const omitted = text.length - maxChars
  const truncated = text.slice(0, maxChars)
  return `${truncated}\n[...truncado: ${omitted} chars omitidos de ${text.length}]`
}

/**
 * Truncado cabeza+cola para stdout/stderr de checks: los errores casi siempre
 * viven al final, así que cortar solo la cabeza (como capToolOutput) los
 * perdería. Conserva una porción inicial y una final, con el marcador en medio.
 */
export function capCheckOutput(text: string, maxChars: number = DEFAULT_MAX_CHARS): string {
  if (text.length <= maxChars) return text
  const halfBudget = Math.floor(maxChars / 2)
  const head = text.slice(0, halfBudget)
  const tail = text.slice(text.length - halfBudget)
  const omitted = text.length - (2 * halfBudget)
  return `${head}\n[...truncado: ${omitted} chars omitidos de ${text.length}]\n${tail}`
}
