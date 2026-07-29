import { db } from './sqlite.ts'
import { randomUUID } from 'crypto'
import { redactSensitive } from '../security/secrets.ts'

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
  snapshot_before: string | null
  snapshot_after: string | null
  qa_verdict: string | null
  qa_reason: string | null
  qa_model: string | null
  checks_json: string | null
  constitution_rules: number | null
  context_source: string | null
  context_tokens: number | null
  embed_hits: number | null
  context_warnings_json: string | null
  cost_breakdown_json: string | null
  file_diffs: string | null
  adversarial_verdict: string | null
  adversarial_reason: string | null
  status: 'done' | 'blocked' | 'failed'
  input_tokens: number
  output_tokens: number
  usd_cost: number
  elapsed_ms: number
  result: string | null
  created_at: string
}

type InsertRunRecord = Omit<RunRecord, 'id' | 'created_at' | 'qa_model' | 'checks_json' | 'constitution_rules' | 'context_source' | 'context_tokens' | 'embed_hits' | 'context_warnings_json' | 'cost_breakdown_json' | 'file_diffs' | 'adversarial_verdict' | 'adversarial_reason'> & {
  qa_model?: string | null
  checks_json?: string | null
  constitution_rules?: number | null
  context_source?: string | null
  context_tokens?: number | null
  embed_hits?: number | null
  context_warnings_json?: string | null
  cost_breakdown_json?: string | null
  file_diffs?: string | null
  adversarial_verdict?: string | null
  adversarial_reason?: string | null
}

export function insertRun(r: InsertRunRecord): string {
  const scrub = (value: string | null | undefined): string | null =>
    value == null ? null : redactSensitive(value)
  const id = randomUUID()
  const now = new Date().toISOString()
  db.run(
    `INSERT INTO runs (
      id, project_id, prompt, task_class, model, provider, skill_id, task_id,
      allowed_outputs, files_attempted, files_authorized, files_blocked,
      snapshot_before, snapshot_after, qa_verdict, qa_reason, qa_model, checks_json,
      constitution_rules, context_source, context_tokens, embed_hits, context_warnings_json,
      cost_breakdown_json, file_diffs, adversarial_verdict, adversarial_reason,
      status, input_tokens, output_tokens, usd_cost, elapsed_ms, result, created_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id, scrub(r.project_id), scrub(r.prompt), scrub(r.task_class), scrub(r.model), scrub(r.provider), scrub(r.skill_id), scrub(r.task_id),
      scrub(r.allowed_outputs), scrub(r.files_attempted), scrub(r.files_authorized), scrub(r.files_blocked),
      scrub(r.snapshot_before), scrub(r.snapshot_after), scrub(r.qa_verdict), scrub(r.qa_reason), scrub(r.qa_model) ?? null, scrub(r.checks_json) ?? null,
      r.constitution_rules ?? null,
      scrub(r.context_source), r.context_tokens ?? null, r.embed_hits ?? null,
      scrub(r.context_warnings_json) ?? null,
      scrub(r.cost_breakdown_json) ?? null,
      scrub(r.file_diffs) ?? null,
      scrub(r.adversarial_verdict) ?? null, scrub(r.adversarial_reason) ?? null,
      r.status, r.input_tokens, r.output_tokens, r.usd_cost, r.elapsed_ms, scrub(r.result), now,
    ]
  )
  return id
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
  return db.query<RunRecord, number>(
    'SELECT * FROM runs ORDER BY created_at DESC LIMIT ?'
  ).all(safeLimit)
}

export function getRun(id: string): RunRecord | null {
  return db.query<RunRecord, string>(
    'SELECT * FROM runs WHERE id = ?'
  ).get(id) ?? null
}

// I.8 (Mes 18) — Runs no tenía forma de borrar registros viejos desde el dashboard.
export function deleteRun(id: string): boolean {
  const result = db.run('DELETE FROM runs WHERE id = ?', [id])
  return result.changes > 0
}

export function listRunsByTaskId(taskId: string): RunRecord[] {
  return db.query<RunRecord, string>(
    'SELECT * FROM runs WHERE task_id = ? ORDER BY created_at DESC'
  ).all(taskId)
}

export function updateRunCost(
  id: string,
  usdCost: number,
  costBreakdownJson: string | null,
): void {
  db.run(
    `UPDATE runs SET usd_cost = ?, cost_breakdown_json = ? WHERE id = ?`,
    [usdCost, costBreakdownJson, id],
  )
}
