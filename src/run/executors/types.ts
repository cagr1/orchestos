/**
 * src/run/executors/types.ts — G.2
 *
 * Interface que desacopla la generación de archivos (el "ejecutor") de la
 * capa de verificación (contrato, checks, QA, evidencia) que vive en
 * harness.ts. Diseño completo: docs/done/design/executor-engine-design.md (G.1).
 *
 * Un engine SOLO genera — nunca escribe a disco, nunca llama insertRun,
 * nunca corre checks ni QA. Esas cuatro cosas son universales a cualquier
 * engine y quedan en el harness.
 */

import type { ApprovalAdapter } from '../approvals.ts'
import type { FileChange } from '../contract.ts'
import type { RunContext } from '../middleware.ts'
import type { CostBreakdownEntry } from '../transcript-parser.ts'
import type { ExecutorStepEvent } from './step-event.ts'

export interface ExecutorOutcome {
  cliSessionId?: string
  files: FileChange[]
  inputTokens: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
  outputTokens: number
  /** CX.6 — contexto real de la última llamada y ventana que reporta el CLI; ausente = no medido. */
  contextUsed?: number | null
  contextWindow?: number | null
  /** Último mensaje de texto del agente (ERP.4.8); solo engines CLI que lo exponen. */
  finalText?: string
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
    opts: {
      approvals?: ApprovalAdapter
      maxTokens: number
      maxIterations: number
      /**
       * Wall-clock timeout en ms — solo lo usa el ejecutor externo (B.1,
       * docs/done/design/external-executor-design.md §4). Campo opcional y aditivo:
       * single-shot/agentic lo ignoran, cero ripple. Garantía de
       * terminación, NO un tope de gasto (mismo principio que
       * maxIterations en agentic.ts).
       */
      timeoutMs?: number
      /**
       * G.3.3 — invocado en vivo por cada evento NDJSON normalizado que el
       * engine externo (claude/opencode) emite mientras corre. Solo
       * external.ts/opencode.ts lo usan; single-shot/agentic lo ignoran
       * (no son multi-turno vía CLI). Cero ripple si no se pasa.
       */
      onStep?: (event: ExecutorStepEvent) => void
    },
  ): Promise<ExecutorOutcome>
}
