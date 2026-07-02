/**
 * src/run/executors/types.ts — G.2
 *
 * Interface que desacopla la generación de archivos (el "ejecutor") de la
 * capa de verificación (contrato, checks, QA, evidencia) que vive en
 * harness.ts. Diseño completo: docs/executor-engine-design.md (G.1).
 *
 * Un engine SOLO genera — nunca escribe a disco, nunca llama insertRun,
 * nunca corre checks ni QA. Esas cuatro cosas son universales a cualquier
 * engine y quedan en el harness.
 */

import type { FileChange } from '../contract.ts'
import type { CostBreakdownEntry } from '../transcript-parser.ts'
import type { RunContext } from '../middleware.ts'

export interface ExecutorOutcome {
  files: FileChange[]
  inputTokens: number
  outputTokens: number
  usd: number
  /** 1 para single-shot; N para engines multi-turno (agéntico, G.3) */
  iterations: number
  /** Desglose de costo por vuelta — MEDICIÓN, no límite. Reusa CostBreakdownEntry ya existente. */
  costByIteration: CostBreakdownEntry[]
  log: string[]
}

export interface ExecutorEngine {
  run(
    ctx: RunContext,
    opts: { maxTokens: number; maxIterations: number },
  ): Promise<ExecutorOutcome>
}
