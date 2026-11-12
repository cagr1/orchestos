/**
 * src/db/run-steps.ts — G.3.3
 *
 * Pasos en vivo de los executors CLI (external/opencode), keyeados por
 * project_id + task_id; null identifica únicamente la sesión general. `seq` es
 * incremental por proyecto y task_id (no global) para que el dashboard pueda pedir
 * "todo lo nuevo desde seq N" sin condición de carrera entre tasks distintas
 * corriendo en paralelo.
 */

import type { ExecutorStepEvent } from '../run/executors/step-event.ts'
import { redactSensitive } from '../security/secrets.ts'
import { db } from './sqlite.ts'

interface RunStepRecord {
  id: number
  task_id: string
  project_id: string | null
  seq: number
  type: ExecutorStepEvent['type']
  label: string
  detail: string | null
  cost_usd: number | null
  tokens_json: string | null
  created_at: string
}

export function insertRunStep(
  taskId: string,
  event: ExecutorStepEvent,
  projectId: string | null = null,
): void {
  if (event.type === 'reasoning') return
  const label = event.type === 'notice' ? (event.notice?.message ?? event.label) : event.label
  const detail =
    event.type === 'notice' && event.notice ? JSON.stringify(event.notice) : event.detail
  // MAX(seq)+1 solo es correcto si la lectura y la escritura son atómicas.
  // BEGIN IMMEDIATE toma el lock de escritura antes del SELECT, evitando que
  // dos procesos CLI/dashboard calculen el mismo seq al mismo tiempo.
  db.exec('BEGIN IMMEDIATE')
  try {
    const row = db
      .query<{ next: number }, [string, string | null]>(
        'SELECT COALESCE(MAX(seq), 0) + 1 AS next FROM run_steps WHERE task_id = ? AND project_id IS ?',
      )
      .get(taskId, projectId)
    const seq = row?.next ?? 1
    db.run(
      `INSERT INTO run_steps (project_id, task_id, seq, type, label, detail, cost_usd, tokens_json, created_at)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [
        projectId,
        taskId,
        seq,
        event.type,
        redactSensitive(label),
        detail ? redactSensitive(detail) : null,
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
export function getRunSteps(
  taskId: string,
  sinceSeq = 0,
  projectId: string | null = null,
): RunStepRecord[] {
  return db
    .query<RunStepRecord, [string, string | null, number]>(
      'SELECT * FROM run_steps WHERE task_id = ? AND project_id IS ? AND seq > ? ORDER BY seq ASC',
    )
    .all(taskId, projectId, sinceSeq)
}

/** Limpia pasos de una corrida anterior del mismo task_id antes de arrancar una nueva. */
export function clearRunSteps(taskId: string, projectId: string | null = null): void {
  db.run('DELETE FROM run_steps WHERE task_id = ? AND project_id IS ?', [taskId, projectId])
}
