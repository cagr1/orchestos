import type { Database } from 'bun:sqlite'
import { createHash } from 'node:crypto'
import type { OrcheConfig } from '../config/schema.ts'
import { db } from '../db/sqlite.ts'

export type OrchestrationBudget = {
  runId: string
  enabled: boolean
  maxConcurrent: number
  maxTotal: number
}
export function openBudget(
  args: {
    projectRoot: string
    projectId?: string
    parentTaskId: string
    planContent: string
    config?: OrcheConfig['orchestration']
  },
  database: Database = db,
): OrchestrationBudget {
  const config = args.config ?? { enabled: false }
  const maxConcurrent = config.maxConcurrent ?? 1
  const maxTotal = config.maxTotal ?? 1
  const planHash = createHash('sha256').update(args.planContent).digest('hex')
  const runId = createHash('sha256')
    .update(`${args.projectRoot}\0${args.parentTaskId}\0${planHash}`)
    .digest('hex')
  const now = new Date().toISOString()
  database.run(
    `INSERT INTO orchestration_runs
    (run_id, project_id, parent_task_id, max_concurrent, max_total, enabled, total, finished_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, NULL, ?, ?)
    ON CONFLICT(run_id) DO UPDATE SET project_id=excluded.project_id,
      max_concurrent=excluded.max_concurrent, max_total=excluded.max_total, enabled=excluded.enabled,
      total=CASE WHEN orchestration_runs.finished_at IS NOT NULL THEN 0 ELSE orchestration_runs.total END,
      finished_at=NULL, updated_at=excluded.updated_at`,
    [
      runId,
      args.projectId ?? null,
      args.parentTaskId,
      maxConcurrent,
      maxTotal,
      config.enabled ? 1 : 0,
      now,
      now,
    ],
  )
  return { runId, enabled: config.enabled, maxConcurrent, maxTotal }
}

export function reserveChild(
  runId: string,
  childId: string,
  database: Database = db,
): { ok: true } | { ok: false; reason: string } {
  const reserve = database.transaction(() => {
    const row = database
      .query<
        {
          enabled: number
          total: number
          max_concurrent: number
          max_total: number
        },
        [string]
      >('SELECT enabled,total,max_concurrent,max_total FROM orchestration_runs WHERE run_id=?')
      .get(runId)
    if (!row) return { ok: false as const, reason: 'límite de orquestación: presupuesto ausente' }
    if (!row.enabled)
      return { ok: false as const, reason: 'orquestación desactivada en este proyecto' }
    const stale = database
      .query<{ child_id: string; pid: number }, [string]>(
        'SELECT child_id,pid FROM orchestration_leases WHERE run_id=?',
      )
      .all(runId)
    for (const lease of stale) {
      try {
        process.kill(lease.pid, 0)
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ESRCH') {
          database.run('DELETE FROM orchestration_leases WHERE run_id=? AND child_id=?', [
            runId,
            lease.child_id,
          ])
        }
      }
    }
    const leases =
      database
        .query<{ active: number }, [string]>(
          'SELECT COUNT(*) AS active FROM orchestration_leases WHERE run_id=?',
        )
        .get(runId)?.active ?? 0
    if (leases >= row.max_concurrent || row.total >= row.max_total)
      return { ok: false as const, reason: `límite de orquestación: ${row.total}/${row.max_total}` }
    database.run('UPDATE orchestration_runs SET total=total+1,updated_at=? WHERE run_id=?', [
      new Date().toISOString(),
      runId,
    ])
    database.run(
      'INSERT OR REPLACE INTO orchestration_leases (run_id,child_id,pid,created_at) VALUES (?,?,?,?)',
      [runId, childId, process.pid, new Date().toISOString()],
    )
    return { ok: true as const }
  })
  return reserve.immediate()
}

export function releaseChild(runId: string, childId: string, database: Database = db): void {
  database.run('DELETE FROM orchestration_leases WHERE run_id=? AND child_id=?', [runId, childId])
  database.run('UPDATE orchestration_runs SET updated_at=? WHERE run_id=?', [
    new Date().toISOString(),
    runId,
  ])
}

export function finishBudget(runId: string, database: Database = db): void {
  database.run('DELETE FROM orchestration_leases WHERE run_id=?', [runId])
  database.run('UPDATE orchestration_runs SET finished_at=?,updated_at=? WHERE run_id=?', [
    new Date().toISOString(),
    new Date().toISOString(),
    runId,
  ])
}

export function readBudget(
  runId: string,
  database: Database = db,
): { active: number; total: number } | null {
  const row = database
    .query<{ total: number }, [string]>('SELECT total FROM orchestration_runs WHERE run_id=?')
    .get(runId)
  if (!row) return null
  const active =
    database
      .query<{ active: number }, [string]>(
        'SELECT COUNT(*) AS active FROM orchestration_leases WHERE run_id=?',
      )
      .get(runId)?.active ?? 0
  return { active, total: row.total }
}
