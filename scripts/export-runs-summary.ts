import { writeFileSync } from 'fs'
import { join } from 'path'

const LIMIT = 20

/**
 * Mes 22 (2026-07-20) — cuántos checks fallaron en un run, a partir del
 * `checks_json` almacenado (array de `CheckResult`, ver src/run/checks.ts).
 *
 * BUG CORREGIDO: la versión anterior filtraba por `!c.pass`, pero `CheckResult`
 * NO tiene campo `pass` (sus campos son cmd/exitCode/stdout/stderr/elapsedMs/
 * timedOut). `c.pass` era siempre `undefined` → `!c.pass` siempre `true` → TODO
 * check con resultado se contaba como fallado. Eso producía `checks_failed:1`
 * en el 100% de los runs que SÍ tienen un check (implement/plan), aunque el
 * check hubiera pasado (exitCode 0) — un falso positivo que el análisis nocturno
 * de DREAMING.md tomó por patrón real. Un check falla si expiró o si su exitCode
 * no es 0 (el default de `expect_exit`; `checks_json` no guarda `expect_exit`, así
 * que 0 es la mejor aproximación disponible — los raros checks con expect_exit≠0
 * no quedan cubiertos, limitación aceptada para un resumen).
 */
export function countFailedChecks(checksJson: string | null | undefined): number {
  if (!checksJson) return 0
  let parsed: unknown
  try { parsed = JSON.parse(checksJson) } catch { return 0 }
  if (!Array.isArray(parsed)) return 0
  return parsed.filter((c: { exitCode?: number; timedOut?: boolean }) =>
    c.timedOut === true || (typeof c.exitCode === 'number' && c.exitCode !== 0)
  ).length
}

// Guardado bajo `import.meta.main` — importar este módulo (ej. desde el test de
// countFailedChecks) NO debe correr la query ni reescribir runs-summary.json.
if (import.meta.main) {
  const { db } = await import('../src/db/sqlite.ts')
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
      checks_failed: countFailedChecks(r.checks_json),
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
}
