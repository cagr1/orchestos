/**
 * src/db/run-steps.ts — G.3.3
 *
 * Pasos en vivo de los executors CLI (external/opencode), keyeados por
 * task_id — ver comentario de la migración en migrate.ts. `seq` es
 * incremental por task_id (no global) para que el dashboard pueda pedir
 * "todo lo nuevo desde seq N" sin condición de carrera entre tasks distintas
 * corriendo en paralelo.
 */

import type { ExecutorStepEvent } from '../run/executors/step-event.ts'
import { redactSensitive } from '../security/secrets.ts'
import { db } from './sqlite.ts'

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
  // MAX(seq)+1 solo es correcto si la lectura y la escritura son atómicas.
  // BEGIN IMMEDIATE toma el lock de escritura antes del SELECT, evitando que
  // dos procesos CLI/dashboard calculen el mismo seq al mismo tiempo.
  db.exec('BEGIN IMMEDIATE')
  try {
    const row = db
      .query<{ next: number }, string>(
        'SELECT COALESCE(MAX(seq), 0) + 1 AS next FROM run_steps WHERE task_id = ?',
      )
      .get(taskId)
    const seq = row?.next ?? 1
    db.run(
      `INSERT INTO run_steps (task_id, seq, type, label, detail, cost_usd, tokens_json, created_at)
       VALUES (?,?,?,?,?,?,?,?)`,
      [
        taskId,
        seq,
        event.type,
        redactSensitive(event.label),
        event.detail ? redactSensitive(event.detail) : null,
        event.costUsd ?? null,
        event.tokens ? JSON.stringify(event.tokens) : null,
        new Date().toISOString(),
      ],
    )
    db.exec('COMMIT')
  } catch (error) {
    try {
      db.exec('ROLLBACK')
    } catch {
      /* preserve original error */
    }
    throw error
  }
}

/** Pasos de un task con `seq` > `sinceSeq` — polling incremental del dashboard. */
export function getRunSteps(taskId: string, sinceSeq = 0): RunStepRecord[] {
  return db
    .query<RunStepRecord, [string, number]>(
      'SELECT * FROM run_steps WHERE task_id = ? AND seq > ? ORDER BY seq ASC',
    )
    .all(taskId, sinceSeq)
}

/** Limpia pasos de una corrida anterior del mismo task_id antes de arrancar una nueva. */
export function clearRunSteps(taskId: string): void {
  db.run('DELETE FROM run_steps WHERE task_id = ?', [taskId])
}
