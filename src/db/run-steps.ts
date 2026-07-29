/**
 * src/db/run-steps.ts — G.3.3
 *
 * Pasos en vivo de los executors CLI (external/opencode), keyeados por
 * task_id — ver comentario de la migración en migrate.ts. `seq` es
 * incremental por task_id (no global) para que el dashboard pueda pedir
 * "todo lo nuevo desde seq N" sin condición de carrera entre tasks distintas
 * corriendo en paralelo.
 */

import { db } from './sqlite.ts'
import type { ExecutorStepEvent } from '../run/executors/step-event.ts'
import { redactSensitive } from '../security/secrets.ts'

export interface RunStepRecord {
  id: number
  task_id: string
  seq: number
  type: ExecutorStepEvent['type']
  label: string
  detail: string | null
  cost_usd: number | null
  tokens_json: string | null
  created_at: string
}

export function insertRunStep(taskId: string, event: ExecutorStepEvent): void {
  const row = db.query<{ next: number }, string>(
    'SELECT COALESCE(MAX(seq), 0) + 1 AS next FROM run_steps WHERE task_id = ?'
  ).get(taskId)
  const seq = row?.next ?? 1
  db.run(
    `INSERT INTO run_steps (task_id, seq, type, label, detail, cost_usd, tokens_json, created_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    [
      taskId, seq, event.type, redactSensitive(event.label), event.detail ? redactSensitive(event.detail) : null,
      event.costUsd ?? null, event.tokens ? JSON.stringify(event.tokens) : null,
      new Date().toISOString(),
    ]
  )
}

/** Pasos de un task con `seq` > `sinceSeq` — polling incremental del dashboard. */
export function getRunSteps(taskId: string, sinceSeq = 0): RunStepRecord[] {
  return db.query<RunStepRecord, [string, number]>(
    'SELECT * FROM run_steps WHERE task_id = ? AND seq > ? ORDER BY seq ASC'
  ).all(taskId, sinceSeq)
}

/** Limpia pasos de una corrida anterior del mismo task_id antes de arrancar una nueva. */
export function clearRunSteps(taskId: string): void {
  db.run('DELETE FROM run_steps WHERE task_id = ?', [taskId])
}
