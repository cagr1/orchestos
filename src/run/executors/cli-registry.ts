/**
 * src/run/executors/cli-registry.ts — G.4.2
 *
 * Detección GENÉRICA de CLIs instalados — registro de datos, no una función
 * `findXBinary()` por cada CLI (corrección de Carlos 2026-07-27: agregar un
 * CLI nuevo debe ser una entrada acá, no código nuevo en otro archivo).
 *
 * Detección es una capa separada de ejecución: un CLI puede aparecer
 * `installed: true` sin tener un `ExecutorEngine` real todavía (Codex hoy,
 * ver PLAN.md § G.4.2b) — `detectInstalledClis()` solo responde "¿está en
 * PATH?", nunca "¿se puede correr una tarea con esto?".
 *
 * `findClaudeBinary()`/`findOpencodeBinary()` (external.ts/opencode.ts) NO
 * se reemplazan por esto — siguen ahí con su mensaje de error específico
 * por engine. Este registro es la capa de detección que alimenta UI/cascada
 * (G.4.3/G.4.4), no el guard interno de cada executor.
 */

export interface CliDefinition {
  id: 'claude' | 'codex' | 'opencode' | 'kimi'
  binary: string
  label: string
}

/** Agregar un CLI nuevo = una entrada acá. `kimi` queda sin binario real
 * todavía (solo `Kimi.app`, GUI) — se detecta igual, `installed` da false
 * hasta que exista un binario alcanzable por PATH. */
export const KNOWN_CLIS: CliDefinition[] = [
  { id: 'claude', binary: 'claude', label: 'Claude Code' },
  { id: 'codex', binary: 'codex', label: 'Codex' },
  { id: 'opencode', binary: 'opencode', label: 'opencode' },
  { id: 'kimi', binary: 'kimi', label: 'Kimi' },
]

export interface CliDetectionResult {
  id: CliDefinition['id']
  label: string
  binary: string
  installed: boolean
  path: string | null
}

export function detectInstalledClis(): CliDetectionResult[] {
  return KNOWN_CLIS.map(def => {
    const path = Bun.which(def.binary)
    return { id: def.id, label: def.label, binary: def.binary, installed: !!path, path }
  })
}
