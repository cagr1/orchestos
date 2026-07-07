import { db } from '../src/db/sqlite.ts'
import { writeFileSync } from 'fs'
import { join } from 'path'

const LIMIT = 20

const runs = db.query<{
  id: string
  task_class: string
  model: string
  provider: string
  status: string
  qa_verdict: string | null
  qa_reason: string | null
  files_blocked: string | null
  checks_json: string | null
  usd_cost: number
  elapsed_ms: number
  input_tokens: number
  output_tokens: number
  created_at: string
}, []>(`
  SELECT
    id, task_class, model, provider, status,
    qa_verdict, qa_reason, files_blocked, checks_json,
    usd_cost, elapsed_ms, input_tokens, output_tokens, created_at
  FROM runs
  ORDER BY created_at DESC
  LIMIT ${LIMIT}
`).all()

const summary = {
  exported_at: new Date().toISOString(),
  total_runs: runs.length,
  runs: runs.map(r => ({
    id: r.id,
    task_class: r.task_class,
    model: r.model,
    provider: r.provider,
    status: r.status,
    qa_verdict: r.qa_verdict,
    qa_reason: r.qa_reason,
    files_blocked: r.files_blocked ? JSON.parse(r.files_blocked) : [],
    checks_failed: r.checks_json
      ? JSON.parse(r.checks_json).filter((c: { pass: boolean }) => !c.pass).length
      : 0,
    usd_cost: r.usd_cost,
    elapsed_ms: r.elapsed_ms,
    tokens: r.input_tokens + r.output_tokens,
    created_at: r.created_at,
  })),
  stats: {
    failed: runs.filter(r => r.status === 'failed').length,
    blocked: runs.filter(r => r.status === 'blocked').length,
    done: runs.filter(r => r.status === 'done').length,
    qa_failed: runs.filter(r => r.qa_verdict === 'fail').length,
    total_cost_usd: runs.reduce((s, r) => s + r.usd_cost, 0).toFixed(4),
  }
}

const outPath = join(import.meta.dir, '..', 'runs-summary.json')
writeFileSync(outPath, JSON.stringify(summary, null, 2))
console.log(`✓ ${runs.length} runs exportados → runs-summary.json`)
console.log(`  failed: ${summary.stats.failed} | blocked: ${summary.stats.blocked} | qa_failed: ${summary.stats.qa_failed}`)
