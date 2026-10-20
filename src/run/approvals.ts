import { randomUUID } from 'node:crypto'
import { existsSync, realpathSync } from 'node:fs'
import { dirname, isAbsolute, relative, resolve } from 'node:path'
import { db } from '../db/sqlite.ts'
import { isProcessAlive } from './file-lock.ts'

export type ApprovalMode = 'supervised' | 'auto-edit' | 'full'
export type ApprovalDecision = 'approve' | 'reject' | 'approve-always'
export interface ApprovalRequest {
  kind: 'command' | 'edit'
  detail: { command?: string; cwd?: string; diff?: string; files?: string[] }
  /** Classification and exact identity supplied by the adapter, never inferred from command names. */
  readOnly?: boolean
  commandKey?: string
  withinProject?: boolean
}
export interface ApprovalAdapter {
  requestApproval(request: ApprovalRequest): Promise<'approve' | 'reject'>
}
export interface PendingApproval extends ApprovalRequest {
  runId: string
  approvalId: string
}

/** Resolve existing ancestors too: a new file beneath a symlink must not inherit a grant. */
export function approvalPathWithin(projectRoot: string, path: string, cwd = projectRoot): boolean {
  try {
    const canonical = (value: string): string => {
      if (existsSync(value)) return realpathSync(value)
      const parent = dirname(value)
      if (parent === value) throw new Error('No existing ancestor')
      return resolve(canonical(parent), relative(parent, value))
    }
    const rel = relative(canonical(resolve(projectRoot)), canonical(resolve(cwd, path)))
    return rel !== '..' && !rel.startsWith('../') && !isAbsolute(rel)
  } catch {
    return false
  }
}

export function decideApproval(
  mode: ApprovalMode,
  request: ApprovalRequest,
  alwaysGranted: ReadonlySet<string>,
): 'auto-approve' | 'ask' {
  if (mode === 'full') return 'auto-approve'
  if (request.kind === 'command' && request.readOnly === true) return 'auto-approve'
  if (request.kind === 'edit')
    return request.withinProject === true && (mode === 'auto-edit' || alwaysGranted.has('edit'))
      ? 'auto-approve'
      : 'ask'
  return request.commandKey && alwaysGranted.has(`command:${request.commandKey}`)
    ? 'auto-approve'
    : 'ask'
}

interface SessionRow {
  id: string
  project_id: string | null
  task_id: string
  owner_pid: number
  active: number
  grants: string
}
interface ApprovalRow {
  id: string
  run_id: string
  request_json: string
  decision: ApprovalDecision | 'auto' | null
}
function event(runId: string, type: string, payload: unknown): void {
  db.run('INSERT INTO approval_events (run_id, type, payload_json) VALUES (?, ?, ?)', [
    runId,
    type,
    JSON.stringify(payload),
  ])
}
export function approvalEvents(runId: string): unknown[] {
  return db
    .query<{ type: string; payload_json: string }, [string]>(
      'SELECT type, payload_json FROM approval_events WHERE run_id = ? ORDER BY id',
    )
    .all(runId)
    .map((row) => ({ type: row.type, ...JSON.parse(row.payload_json) }))
}
export function finishApprovalRun(runId: string): void {
  db.transaction(() => {
    const pending = db
      .query<ApprovalRow, [string]>(
        'SELECT * FROM action_approvals WHERE run_id = ? AND decision IS NULL',
      )
      .all(runId)
    for (const row of pending) {
      db.run("UPDATE action_approvals SET decision = 'reject' WHERE id = ?", [row.id])
      event(runId, 'approval_resolved', { runId, approvalId: row.id, decision: 'reject' })
    }
    db.run('UPDATE approval_runs SET active = 0 WHERE id = ?', [runId])
  }).immediate()
}
export function getApprovalRun(runId: string): SessionRow | null {
  const row = db.query<SessionRow, [string]>('SELECT * FROM approval_runs WHERE id = ?').get(runId)
  if (row?.active && !isProcessAlive(row.owner_pid)) {
    finishApprovalRun(runId)
    row.active = 0
  }
  return row
}
export function activeApprovalRun(taskId: string, projectId: string | null): string | null {
  const rows = db
    .query<SessionRow, [string, string | null]>(
      'SELECT * FROM approval_runs WHERE task_id = ? AND project_id IS ? AND active = 1 ORDER BY rowid DESC',
    )
    .all(taskId, projectId)
  return rows.find((row) => getApprovalRun(row.id)?.active)?.id ?? null
}
export function pendingApprovals(runId: string): PendingApproval[] {
  getApprovalRun(runId)
  return db
    .query<ApprovalRow, [string]>(
      'SELECT * FROM action_approvals WHERE run_id = ? AND decision IS NULL ORDER BY rowid',
    )
    .all(runId)
    .map((row) => ({ runId, approvalId: row.id, ...JSON.parse(row.request_json) }))
}
export function resolveApproval(
  runId: string,
  approvalId: string,
  decision: ApprovalDecision,
): { scope: 'once' | 'task' } | null {
  const session = getApprovalRun(runId)
  if (!session?.active) return null
  return db
    .transaction(() => {
      const row = db
        .query<ApprovalRow, [string, string]>(
          'SELECT * FROM action_approvals WHERE id = ? AND run_id = ? AND decision IS NULL',
        )
        .get(approvalId, runId)
      if (!row) return null
      const request: ApprovalRequest = JSON.parse(row.request_json)
      const grant =
        request.kind === 'edit'
          ? request.withinProject === true
            ? 'edit'
            : undefined
          : request.commandKey
            ? `command:${request.commandKey}`
            : undefined
      const scope = decision === 'approve-always' && grant ? 'task' : 'once'
      if (scope === 'task') {
        const current = getApprovalRun(runId)!
        const grants = new Set<string>(JSON.parse(current.grants))
        grants.add(grant!)
        db.run('UPDATE approval_runs SET grants = ? WHERE id = ?', [
          JSON.stringify([...grants]),
          runId,
        ])
      }
      db.run('UPDATE action_approvals SET decision = ? WHERE id = ?', [decision, approvalId])
      event(runId, 'approval_resolved', { runId, approvalId, decision })
      return { scope } as { scope: 'once' | 'task' }
    })
    .immediate()
}

export function createApprovalRun(
  runId: string,
  taskId: string,
  projectId: string | null,
  mode: ApprovalMode,
): ApprovalAdapter {
  db.run(
    'INSERT INTO approval_runs (id, task_id, project_id, owner_pid, active, grants) VALUES (?, ?, ?, ?, 1, ?)',
    [runId, taskId, projectId, process.pid, '[]'],
  )
  return {
    async requestApproval(request) {
      const session = getApprovalRun(runId)
      if (!session?.active) return 'reject'
      const approvalId = randomUUID()
      const automatic =
        decideApproval(mode, request, new Set(JSON.parse(session.grants))) === 'auto-approve'
      db.transaction(() => {
        db.run(
          'INSERT INTO action_approvals (id, run_id, request_json, decision) VALUES (?, ?, ?, ?)',
          [approvalId, runId, JSON.stringify(request), automatic ? 'auto' : null],
        )
        event(
          runId,
          automatic ? 'approval_resolved' : 'approval_requested',
          automatic
            ? { runId, approvalId, decision: 'auto' }
            : { runId, approvalId, kind: request.kind, detail: request.detail },
        )
      }).immediate()
      if (automatic) return 'approve'
      for (;;) {
        const row = db
          .query<ApprovalRow, [string]>('SELECT * FROM action_approvals WHERE id = ?')
          .get(approvalId)
        if (!row || row.decision)
          return row?.decision && row.decision !== 'reject' ? 'approve' : 'reject'
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
    },
  }
}
