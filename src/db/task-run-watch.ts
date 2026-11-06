import { db } from './sqlite.ts'

/** R.8.4 — reporte de fin de tarea pendiente; sobrevive al reinicio del dashboard. */
export interface TaskRunWatchRow {
  root: string
  task_id: string
  project_id: string | null
  session_id: string | null
  pid: number
  created_at: string
}

export function upsertTaskRunWatch(row: Omit<TaskRunWatchRow, 'created_at'>): TaskRunWatchRow {
  const created_at = new Date().toISOString()
  db.run(
    `INSERT OR REPLACE INTO task_run_watch (root, task_id, project_id, session_id, pid, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [row.root, row.task_id, row.project_id, row.session_id, row.pid, created_at],
  )
  return { ...row, created_at }
}

export function listTaskRunWatch(): TaskRunWatchRow[] {
  return db.query<TaskRunWatchRow, []>('SELECT * FROM task_run_watch ORDER BY created_at').all()
}

export function getTaskRunWatch(root: string, taskId: string): TaskRunWatchRow | null {
  return (
    db
      .query<TaskRunWatchRow, [string, string]>(
        'SELECT * FROM task_run_watch WHERE root = ? AND task_id = ?',
      )
      .get(root, taskId) ?? null
  )
}

export function deleteTaskRunWatch(row: TaskRunWatchRow): boolean {
  const result = db.run(
    'DELETE FROM task_run_watch WHERE root = ? AND task_id = ? AND pid = ? AND created_at = ?',
    [row.root, row.task_id, row.pid, row.created_at],
  )
  return result.changes === 1
}
