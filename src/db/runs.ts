import { randomUUID } from 'crypto'
import { redactSensitive } from '../security/secrets.ts'
import { db } from './sqlite.ts'

export interface RunRecord {
  id: string
  project_id: string | null
  prompt: string
  task_class: string
  model: string
  provider: string
  skill_id: string | null
  task_id: string | null
  allowed_outputs: string | null
  files_attempted: string | null
  files_authorized: string | null
  files_blocked: string | null
  /** Compatibility projection of successful explicit reads; NULL = unknown.
   * Legacy rows without read_audit_json are unverified, regardless of this value. */
  files_read?: string | null
  read_audit_json?: string | null
  snapshot_before: string | null
  snapshot_after: string | null
  qa_verdict: string | null
  qa_reason: string | null
  qa_model: string | null
  qa_criteria_json?: string | null
  checks_json: string | null
  constitution_rules: number | null
  context_source: string | null
  context_tokens: number | null
  embed_hits: number | null
  context_warnings_json: string | null
  cost_breakdown_json: string | null
  file_diffs: string | null
  /** TRUST.7: base previa al merge, medida bajo su candado; NULL = rango desconocido. */
  commit_base_sha?: string | null
  /** ERP.7.2a: HEAD aplicado en la rama base; NULL = sin commit o run previo. */
  commit_sha?: string | null
  reverted_sha?: string | null
  reverted_at?: string | null
  /** O.3: JSON [{id, candidate, applied, reason}] — NULL si el run nunca llegó al stage de QA. */
  skill_gates_json: string | null
  status: 'done' | 'blocked' | 'failed'
  input_tokens: number
  cache_read_tokens: number
  cache_write_tokens: number
  cli_session_id: string | null
  /** CX.6: contexto real (última llamada) y ventana medida por el CLI; NULL = no medido. */
  context_used_tokens?: number | null
  context_window_tokens?: number | null
  /** ERP.4.8: último mensaje del ejecutor en runs fallidos/bloqueados (≤4000 chars); NULL = sin texto o run ok. */
  executor_reply?: string | null
  output_tokens: number
  usd_cost: number
  elapsed_ms: number
  result: string | null
  created_at: string
}

type InsertRunRecord = Omit<
  RunRecord,
  | 'id'
  | 'cache_read_tokens'
  | 'cache_write_tokens'
  | 'cli_session_id'
  | 'created_at'
  | 'files_read'
  | 'qa_model'
  | 'qa_criteria_json'
  | 'checks_json'
  | 'constitution_rules'
  | 'context_source'
  | 'context_tokens'
  | 'embed_hits'
  | 'context_warnings_json'
  | 'cost_breakdown_json'
  | 'file_diffs'
  | 'skill_gates_json'
  | 'commit_sha'
  | 'reverted_sha'
  | 'reverted_at'
> & {
  id?: string
  files_read?: string | null
  qa_model?: string | null
  qa_criteria_json?: string | null
  checks_json?: string | null
  constitution_rules?: number | null
  context_source?: string | null
  context_tokens?: number | null
  embed_hits?: number | null
  context_warnings_json?: string | null
  cost_breakdown_json?: string | null
  file_diffs?: string | null
  commit_base_sha?: string | null
  commit_sha?: string | null
  skill_gates_json?: string | null
  executor_reply?: string | null
  cache_read_tokens?: number
  cache_write_tokens?: number
  cli_session_id?: string | null
  context_used_tokens?: number | null
  context_window_tokens?: number | null
}

const EXECUTOR_REPLY_MAX = 4000

function clipExecutorReply(value: string | null | undefined): string | null {
  if (value == null) return null
  return value.length > EXECUTOR_REPLY_MAX ? `${value.slice(0, EXECUTOR_REPLY_MAX - 1)}…` : value
}

export function insertRun(r: InsertRunRecord): string {
  const scrub = (value: string | null | undefined): string | null =>
    value == null ? null : redactSensitive(value)
  const id = r.id ?? randomUUID()
  const now = new Date().toISOString()
  db.run(
    `INSERT INTO runs (
      id, project_id, prompt, task_class, model, provider, skill_id, task_id,
      allowed_outputs, files_attempted, files_authorized, files_blocked,
      files_read, read_audit_json, qa_criteria_json,
      snapshot_before, snapshot_after, qa_verdict, qa_reason, qa_model, checks_json,
      constitution_rules, context_source, context_tokens, embed_hits, context_warnings_json,
      cost_breakdown_json, file_diffs, skill_gates_json,
      status, input_tokens, cache_read_tokens, cache_write_tokens, output_tokens, usd_cost, elapsed_ms, result, created_at, cli_session_id, executor_reply, context_used_tokens, context_window_tokens, commit_sha, commit_base_sha
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      scrub(r.project_id),
      scrub(r.prompt),
      scrub(r.task_class),
      scrub(r.model),
      scrub(r.provider),
      scrub(r.skill_id),
      scrub(r.task_id),
      scrub(r.allowed_outputs),
      scrub(r.files_attempted),
      scrub(r.files_authorized),
      scrub(r.files_blocked),
      scrub(r.files_read),
      scrub(r.read_audit_json),
      scrub(r.qa_criteria_json) ?? null,
      scrub(r.snapshot_before),
      scrub(r.snapshot_after),
      scrub(r.qa_verdict),
      scrub(r.qa_reason),
      scrub(r.qa_model) ?? null,
      scrub(r.checks_json) ?? null,
      r.constitution_rules ?? null,
      scrub(r.context_source),
      r.context_tokens ?? null,
      r.embed_hits ?? null,
      scrub(r.context_warnings_json) ?? null,
      scrub(r.cost_breakdown_json) ?? null,
      scrub(r.file_diffs) ?? null,
      scrub(r.skill_gates_json) ?? null,
      r.status,
      r.input_tokens,
      r.cache_read_tokens ?? 0,
      r.cache_write_tokens ?? 0,
      r.output_tokens,
      r.usd_cost,
      r.elapsed_ms,
      scrub(r.result),
      now,
      scrub(r.cli_session_id),
      scrub(clipExecutorReply(r.executor_reply)) ?? null,
      r.context_used_tokens ?? null,
      r.context_window_tokens ?? null,
      r.commit_sha ?? null,
      r.commit_base_sha ?? null,
    ],
  )
  return id
}

/** ERP.7.2a — registra que la tarea fue deshecha por `revertedSha`. */
export function markRunReverted(id: string, revertedSha: string): void {
  db.run('UPDATE runs SET reverted_sha = ?, reverted_at = ? WHERE id = ?', [
    revertedSha,
    new Date().toISOString(),
    id,
  ])
}

export function normalizeRunLimit(limit: number, fallback = 20, max = 1000): number {
  if (limit === 0) return 0
  if (!Number.isFinite(limit) || limit < 1) return fallback
  return Math.min(Math.floor(limit), max)
}

export function listRuns(limit = 20): RunRecord[] {
  if (limit === 0) {
    return db.query<RunRecord, []>('SELECT * FROM runs ORDER BY created_at DESC').all()
  }
  // 0 is reserved for the explicit CLI export path. Every bounded caller gets
  // a finite, positive limit even if input came from a URL or CLI string.
  const safeLimit = normalizeRunLimit(limit)
  return db
    .query<RunRecord, number>('SELECT * FROM runs ORDER BY created_at DESC LIMIT ?')
    .all(safeLimit)
}

export function listRunsByProjectId(projectId: string, limit = 20): RunRecord[] {
  if (limit === 0) {
    return db
      .query<RunRecord, string>('SELECT * FROM runs WHERE project_id = ? ORDER BY created_at DESC')
      .all(projectId)
  }
  const safeLimit = normalizeRunLimit(limit)
  return db
    .query<RunRecord, [string, number]>(
      'SELECT * FROM runs WHERE project_id = ? ORDER BY created_at DESC LIMIT ?',
    )
    .all(projectId, safeLimit)
}

export function listContextRuns(projectId: string | null, limit = 10): RunRecord[] {
  const safeLimit = normalizeRunLimit(limit)
  if (projectId === null) {
    return db
      .query<RunRecord, number>(
        "SELECT * FROM runs WHERE task_class IS NULL OR task_class != 'chat' ORDER BY created_at DESC LIMIT ?",
      )
      .all(safeLimit)
  }
  return db
    .query<RunRecord, [string, number]>(
      "SELECT * FROM runs WHERE project_id = ? AND (task_class IS NULL OR task_class != 'chat') ORDER BY created_at DESC LIMIT ?",
    )
    .all(projectId, safeLimit)
}

export function listRunsWithoutProjectId(limit = 20): RunRecord[] {
  const safeLimit = normalizeRunLimit(limit)
  return db
    .query<RunRecord, number>(
      'SELECT * FROM runs WHERE project_id IS NULL ORDER BY created_at DESC LIMIT ?',
    )
    .all(safeLimit)
}

export function getRun(id: string): RunRecord | null {
  return db.query<RunRecord, string>('SELECT * FROM runs WHERE id = ?').get(id) ?? null
}

// I.8 (Mes 18) — Runs no tenía forma de borrar registros viejos desde el dashboard.
export function deleteRun(id: string): boolean {
  const result = db.run('DELETE FROM runs WHERE id = ?', [id])
  return result.changes > 0
}

export function listRunsByTaskId(taskId: string): RunRecord[] {
  return db
    .query<RunRecord, string>('SELECT * FROM runs WHERE task_id = ? ORDER BY created_at DESC')
    .all(taskId)
}

export function updateRunCost(id: string, usdCost: number, costBreakdownJson: string | null): void {
  db.run(`UPDATE runs SET usd_cost = ?, cost_breakdown_json = ? WHERE id = ?`, [
    usdCost,
    costBreakdownJson,
    id,
  ])
}
