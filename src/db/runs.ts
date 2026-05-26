import { db } from './sqlite.ts'
import { randomUUID } from 'crypto'

export interface RunRecord {
  id: string
  project_id: string | null
  prompt: string
  task_class: string
  model: string
  provider: string
  skill_id: string | null
  allowed_outputs: string | null
  files_attempted: string | null
  files_authorized: string | null
  files_blocked: string | null
  status: 'done' | 'blocked' | 'failed'
  input_tokens: number
  output_tokens: number
  usd_cost: number
  elapsed_ms: number
  result: string | null
  created_at: string
}

export function insertRun(r: Omit<RunRecord, 'id' | 'created_at'>): string {
  const id = randomUUID()
  const now = new Date().toISOString()
  db.run(
    `INSERT INTO runs (
      id, project_id, prompt, task_class, model, provider, skill_id,
      allowed_outputs, files_attempted, files_authorized, files_blocked,
      status, input_tokens, output_tokens, usd_cost, elapsed_ms, result, created_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id, r.project_id, r.prompt, r.task_class, r.model, r.provider, r.skill_id,
      r.allowed_outputs, r.files_attempted, r.files_authorized, r.files_blocked,
      r.status, r.input_tokens, r.output_tokens, r.usd_cost, r.elapsed_ms, r.result, now,
    ]
  )
  return id
}

export function listRuns(limit = 20): RunRecord[] {
  return db.query<RunRecord, number>(
    'SELECT * FROM runs ORDER BY created_at DESC LIMIT ?'
  ).all(limit)
}
