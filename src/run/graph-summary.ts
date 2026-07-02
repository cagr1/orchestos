/**
 * src/run/graph-summary.ts
 *
 * B2 — Closing report for `run --graph`.
 * Categorizes the runner's GraphTaskEntry[] into the 3 plan buckets:
 *   ✓ Completed alone       (outcome='completed', retry_count=0)
 *   ↻ Retried and resolved  (had retries or rate-limit requeue, still succeeded)
 *   ⊘ Branch blocked        (failed_permanent + transitively blocked descendants)
 * Plus a 4th bucket "— Unfinished" for circuit-breaker skips.
 *
 * Autonomy metric = completed-without-intervention / total — surfaced in the
 * headline and at the recap.
 *
 * Why retry_count comes from tasks.yaml post-run:
 *   The runner doesn't carry retry_count through to GraphTaskEntry; tasks.yaml
 *   is the canonical record of post-run state. For 'rate_limited_then_completed'
 *   the requeue resets retry_count to 0 in tasks.yaml, so the outcome itself is
 *   the distinguishing signal — surfaced as "requeue" in the RETRIES column.
 */
import { loadTasks as realLoadTasks } from '../tasks/loader.ts'
import type { GraphRunResult } from './graph-runner.ts'

type LoadTasksFn = (root: string) => { tasks: Array<{ id: string; retry_count: number }> }

export function printGraphSummary(
  result: GraphRunResult,
  root: string,
  loadTasksFn?: LoadTasksFn,
): void {
  const loadTasks_ = loadTasksFn ?? realLoadTasks
  // Re-read tasks.yaml to recover retry_count per task (the runner doesn't carry
  // it through to GraphTaskEntry; tasks.yaml is the canonical post-run source).
  let retryById = new Map<string, number>()
  try {
    const file = loadTasks_(root)
    for (const t of file.tasks) retryById.set(t.id, t.retry_count)
  } catch { /* tasks.yaml gone — keep retry column as "?" */ }

  // ── Categorize ─────────────────────────────────────────────────────────────
  const completedAlone: typeof result.tasks = []
  const retriedAndResolved: typeof result.tasks = []
  const branchBlocked: typeof result.tasks = []
  const unfinished: typeof result.tasks = []

  for (const e of result.tasks) {
    const rc = retryById.get(e.id)
    if (e.outcome === 'completed' && (rc ?? 0) === 0) completedAlone.push(e)
    else if (e.outcome === 'completed' || e.outcome === 'rate_limited_then_completed') retriedAndResolved.push(e)
    else if (e.outcome === 'failed_permanent' || e.outcome === 'blocked') branchBlocked.push(e)
    else unfinished.push(e)
  }

  // ── Headline: autonomy metric ──────────────────────────────────────────────
  const autonomousCount = completedAlone.length + retriedAndResolved.length
  const total = result.tasks.length
  const autonomyPct = total > 0 ? (autonomousCount / total) * 100 : 100
  console.log('')
  console.log(`[run --graph] ── Summary ──`)
  console.log('')
  console.log(`  ★ autonomy: ${autonomousCount}/${total} (${autonomyPct.toFixed(1)}%) — task(s) completed without human intervention`)

  // ── Per-bucket tables ──────────────────────────────────────────────────────
  const COL_ID = 30
  const COL_OUT = 18
  const COL_COST = 9
  const COL_RET = 8
  const COL_TOK = 11
  const COL_MS = 7
  const header = `  ${'TASK'.padEnd(COL_ID)} ${'OUTCOME'.padEnd(COL_OUT)} ${'$COST'.padStart(COL_COST)} ${'RETRIES'.padStart(COL_RET)} ${'in/out'.padStart(COL_TOK)} ${'ms'.padStart(COL_MS)}`
  const sep    = `  ${'─'.repeat(COL_ID)} ${'─'.repeat(COL_OUT)} ${'─'.repeat(COL_COST)} ${'─'.repeat(COL_RET)} ${'─'.repeat(COL_TOK)} ${'─'.repeat(COL_MS)}`

  const row = (e: typeof result.tasks[number], indent = '') => {
    const rcRaw = retryById.get(e.id)
    const rcStr =
      rcRaw === undefined ? '?' :
      e.outcome === 'rate_limited_then_completed' ? 'requeue' :
      String(rcRaw)
    const tokStr = `${e.tokens.input}/${e.tokens.output}`
    const outLabel: Record<typeof e.outcome, string> = {
      completed: 'completed',
      rate_limited_then_completed: 'rate-limit→done',
      failed_permanent: 'failed',
      blocked: 'blocked',
      skipped_circuit_breaker: 'skipped',
    }
    console.log(`  ${indent}${e.id.padEnd(COL_ID - indent.length)} ${outLabel[e.outcome].padEnd(COL_OUT)} ${('$' + e.usd_cost.toFixed(5)).padStart(COL_COST)} ${rcStr.padStart(COL_RET)} ${tokStr.padStart(COL_TOK)} ${String(e.elapsed_ms).padStart(COL_MS)}`)
    if (e.error) console.log(`  ${indent}${' '.repeat(COL_ID - indent.length)}   └─ ${e.error}`)
  }

  if (completedAlone.length > 0) {
    console.log('')
    console.log(`  ✓ Completed alone (${completedAlone.length}) — no retries, no intervention`)
    console.log(sep)
    console.log(header)
    console.log(sep)
    for (const e of completedAlone) row(e)
  }

  if (retriedAndResolved.length > 0) {
    console.log('')
    console.log(`  ↻ Retried and resolved (${retriedAndResolved.length}) — diagnose recovered the task`)
    console.log(sep)
    console.log(header)
    console.log(sep)
    for (const e of retriedAndResolved) row(e)
  }

  if (branchBlocked.length > 0) {
    console.log('')
    const blockedCount = branchBlocked.filter(e => e.outcome === 'blocked').length
    const failedCount = branchBlocked.filter(e => e.outcome === 'failed_permanent').length
    console.log(`  ⊘ Branch blocked (${branchBlocked.length}) — ${failedCount} failed, ${blockedCount} descendant(s) skipped`)
    console.log(sep)
    console.log(header)
    console.log(sep)
    for (const e of branchBlocked) row(e)
  }

  if (unfinished.length > 0) {
    console.log('')
    console.log(`  — Unfinished (${unfinished.length}) — circuit breaker tripped; tasks remain 'pending' for next run`)
    console.log(sep)
    console.log(header)
    console.log(sep)
    for (const e of unfinished) row(e)
  }

  // ── Totals + recap ─────────────────────────────────────────────────────────
  console.log('')
  console.log(sep)
  console.log(`  total: ${result.tasks.length} task(s) · $${result.aggregated_cost.toFixed(5)} · ${result.aggregated_ms}ms`)
  console.log(`  ★ autonomy: ${autonomousCount}/${total} (${autonomyPct.toFixed(1)}%)`)
  if (result.circuit_break_reason) {
    console.log(`  ⏹ circuit break: ${result.circuit_break_reason}`)
  }
}