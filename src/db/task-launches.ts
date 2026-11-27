import { db } from './sqlite.ts'

export type TaskLaunchOutcome = 'completed' | 'failed' | 'blocked' | 'interrupted'
export type TaskLaunchSettled = null | { outcome: TaskLaunchOutcome; reason: string | null }

export interface TaskLaunchRow {
  id: string
  root: string
  task_id: string
  project_id: string | null
  session_id: string | null
  pid: number
  started_at: string
  settled_at: string | null
  outcome: TaskLaunchOutcome | null
  reason: string | null
}

export function insertTaskLaunch(
  row: Omit<TaskLaunchRow, 'settled_at' | 'outcome' | 'reason'>,
): void {
  db.run(
    `INSERT INTO task_launches (id, root, task_id, project_id, session_id, pid, started_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [row.id, row.root, row.task_id, row.project_id, row.session_id, row.pid, row.started_at],
  )
}

export function settleTaskLaunch(
  id: string,
  outcome: TaskLaunchOutcome,
  reason: string | null,
): boolean {
  return (
    db.run(
      'UPDATE task_launches SET settled_at = ?, outcome = ?, reason = ? WHERE id = ? AND settled_at IS NULL',
      [new Date().toISOString(), outcome, reason, id],
    ).changes === 1
  )
}

export function getTaskLaunch(id: string): TaskLaunchRow | null {
  return (
    db.query<TaskLaunchRow, [string]>('SELECT * FROM task_launches WHERE id = ?').get(id) ?? null
  )
}

export function latestTaskLaunch(root: string, taskId: string): TaskLaunchRow | null {
  return (
    db
      .query<TaskLaunchRow, [string, string]>(
        'SELECT * FROM task_launches WHERE root = ? AND task_id = ? ORDER BY started_at DESC, rowid DESC LIMIT 1',
      )
      .get(root, taskId) ?? null
  )
}

export function taskLaunchSettled(
  row: Pick<TaskLaunchRow, 'settled_at' | 'outcome' | 'reason'>,
): TaskLaunchSettled {
  return row.settled_at === null || row.outcome === null
    ? null
    : { outcome: row.outcome, reason: row.reason }
}
