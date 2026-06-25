import { describe, it, expect, mock, afterAll } from 'bun:test'
import type { GraphRunResult } from '../run/graph-runner.ts'

// ── Mock loadTasks so tests don't depend on a real tasks.yaml on disk ──────────
// Captured and restored in afterAll: mock.module() has no automatic per-file scope in
// Bun's test runner — left unrestored, this would leak into later-running suites that
// need the real tasks/loader.ts (graph-runner.test.ts, dashboard run-graph-api.test.ts).
const realLoader = await import('../tasks/loader.ts')
const tasksYamlByRoot = new Map<string, Array<{ id: string; retry_count: number }>>()

mock.module('../tasks/loader.ts', () => ({
  loadTasks: (root: string) => {
    const tasks = tasksYamlByRoot.get(root) ?? []
    return { version: 1 as const, project: 'mock', tasks: tasks.map(t => ({
      id: t.id,
      description: '',
      executor: 'openrouter' as const,
      input: [],
      output: ['out/x.txt'],
      depends_on: [],
      status: 'done' as const,
      retry_count: t.retry_count,
    })) }
  },
  tasksExist: () => true,
  tasksPath: (root: string) => `${root}/tasks.yaml`,
  updateTaskStatus: () => {},
}))

const { printGraphSummary } = await import('../run/graph-summary.ts')

afterAll(() => {
  mock.module('../tasks/loader.ts', () => realLoader)
})

const MOCK_ROOT = '/mock/project'

const setRetry = (entries: Array<{ id: string; retry_count: number }>) => {
  tasksYamlByRoot.set(MOCK_ROOT, entries)
}

const makeResult = (): GraphRunResult => ({
  tasks: [
    { id: 't1-alone', outcome: 'completed', usd_cost: 0.00012, tokens: { input: 100, output: 200 }, elapsed_ms: 1234 },
    { id: 't2-retried', outcome: 'completed', usd_cost: 0.00023, tokens: { input: 150, output: 300 }, elapsed_ms: 2345 },
    { id: 't3-rate-limit', outcome: 'rate_limited_then_completed', usd_cost: 0.00045, tokens: { input: 200, output: 400 }, elapsed_ms: 3456 },
    { id: 't4-failed', outcome: 'failed_permanent', error: 'deterministic check failed', usd_cost: 0.00056, tokens: { input: 250, output: 450 }, elapsed_ms: 5678 },
    { id: 't5-blocked', outcome: 'blocked', error: 'blocked by failed_permanent ancestor: t4-failed', usd_cost: 0, tokens: { input: 0, output: 0 }, elapsed_ms: 0 },
    { id: 't6-skipped', outcome: 'skipped_circuit_breaker', usd_cost: 0, tokens: { input: 0, output: 0 }, elapsed_ms: 0 },
  ],
  aggregated_cost: 0.00136,
  aggregated_tokens: { input: 700, output: 1350 },
  aggregated_ms: 12713,
  autonomy_metric: 0.5,
})

// ── B2: printGraphSummary — categorizes outcomes into the 3 plan buckets ───────
describe('printGraphSummary (B2)', () => {
  it('prints the autonomy metric in the headline', () => {
    setRetry([
      { id: 't1-alone', retry_count: 0 },
      { id: 't2-retried', retry_count: 2 },
      { id: 't3-rate-limit', retry_count: 0 },
      { id: 't4-failed', retry_count: 3 },
      { id: 't5-blocked', retry_count: 0 },
      { id: 't6-skipped', retry_count: 0 },
    ])
    const out = capture(() => printGraphSummary(makeResult(), MOCK_ROOT))
    expect(out).toContain('[run --graph] ── Summary ──')
    expect(out).toContain('★ autonomy: 3/6 (50.0%)')
  })

  it('groups tasks into 3 plan buckets + Unfinished', () => {
    setRetry([
      { id: 't1-alone', retry_count: 0 },
      { id: 't2-retried', retry_count: 2 },
      { id: 't3-rate-limit', retry_count: 0 },
      { id: 't4-failed', retry_count: 3 },
      { id: 't5-blocked', retry_count: 0 },
      { id: 't6-skipped', retry_count: 0 },
    ])
    const out = capture(() => printGraphSummary(makeResult(), MOCK_ROOT))
    expect(out).toContain('✓ Completed alone (1) — no retries, no intervention')
    expect(out).toContain('↻ Retried and resolved (2) — diagnose recovered the task')
    expect(out).toContain('⊘ Branch blocked (2) — 1 failed, 1 descendant(s) skipped')
    expect(out).toContain('— Unfinished (1) — circuit breaker tripped')
  })

  it('puts completed-with-no-retry in the Completed alone bucket', () => {
    setRetry([
      { id: 't1-alone', retry_count: 0 },
      { id: 't2-retried', retry_count: 2 },
      { id: 't3-rate-limit', retry_count: 0 },
      { id: 't4-failed', retry_count: 3 },
      { id: 't5-blocked', retry_count: 0 },
      { id: 't6-skipped', retry_count: 0 },
    ])
    const out = capture(() => printGraphSummary(makeResult(), MOCK_ROOT))
    expect(out).toMatch(/Completed alone[\s\S]*t1-alone/)
  })

  it('puts retried-completed and rate-limited-completed in the Retried bucket', () => {
    setRetry([
      { id: 't1-alone', retry_count: 0 },
      { id: 't2-retried', retry_count: 2 },
      { id: 't3-rate-limit', retry_count: 0 },
      { id: 't4-failed', retry_count: 3 },
      { id: 't5-blocked', retry_count: 0 },
      { id: 't6-skipped', retry_count: 0 },
    ])
    const out = capture(() => printGraphSummary(makeResult(), MOCK_ROOT))
    expect(out).toMatch(/Retried and resolved[\s\S]*t2-retried/)
    expect(out).toMatch(/Retried and resolved[\s\S]*t3-rate-limit/)
  })

  it('puts failed_permanent and blocked in the Branch blocked bucket', () => {
    setRetry([
      { id: 't1-alone', retry_count: 0 },
      { id: 't2-retried', retry_count: 2 },
      { id: 't3-rate-limit', retry_count: 0 },
      { id: 't4-failed', retry_count: 3 },
      { id: 't5-blocked', retry_count: 0 },
      { id: 't6-skipped', retry_count: 0 },
    ])
    const out = capture(() => printGraphSummary(makeResult(), MOCK_ROOT))
    expect(out).toMatch(/Branch blocked[\s\S]*t4-failed/)
    expect(out).toMatch(/Branch blocked[\s\S]*t5-blocked/)
  })

  it('shows retry count per task and "requeue" for rate-limit outcomes', () => {
    setRetry([
      { id: 't1-alone', retry_count: 0 },
      { id: 't2-retried', retry_count: 2 },
      { id: 't3-rate-limit', retry_count: 0 },
      { id: 't4-failed', retry_count: 3 },
      { id: 't5-blocked', retry_count: 0 },
      { id: 't6-skipped', retry_count: 0 },
    ])
    const out = capture(() => printGraphSummary(makeResult(), MOCK_ROOT))
    expect(out).toContain('t1-alone')
    expect(out).toContain('t2-retried')
    expect(out).toMatch(/t3-rate-limit[\s\S]*requeue/)
  })

  it('surfaces circuit break reason when set', () => {
    setRetry([
      { id: 't1-alone', retry_count: 0 },
      { id: 't2-retried', retry_count: 2 },
      { id: 't3-rate-limit', retry_count: 0 },
      { id: 't4-failed', retry_count: 3 },
      { id: 't5-blocked', retry_count: 0 },
      { id: 't6-skipped', retry_count: 0 },
    ])
    const r = makeResult()
    r.circuit_break_reason = 'cost limit reached ($0.50)'
    const out = capture(() => printGraphSummary(r, MOCK_ROOT))
    expect(out).toContain('⏹ circuit break: cost limit reached ($0.50)')
  })

  it('prints totals + autonomy recap at the bottom', () => {
    setRetry([
      { id: 't1-alone', retry_count: 0 },
      { id: 't2-retried', retry_count: 2 },
      { id: 't3-rate-limit', retry_count: 0 },
      { id: 't4-failed', retry_count: 3 },
      { id: 't5-blocked', retry_count: 0 },
      { id: 't6-skipped', retry_count: 0 },
    ])
    const out = capture(() => printGraphSummary(makeResult(), MOCK_ROOT))
    expect(out).toContain('total: 6 task(s) · $0.00136 · 12713ms')
    expect(out).toMatch(/★ autonomy: 3\/6/)
  })

  it('shows error sub-line for failed/blocked tasks', () => {
    setRetry([
      { id: 't1-alone', retry_count: 0 },
      { id: 't2-retried', retry_count: 2 },
      { id: 't3-rate-limit', retry_count: 0 },
      { id: 't4-failed', retry_count: 3 },
      { id: 't5-blocked', retry_count: 0 },
      { id: 't6-skipped', retry_count: 0 },
    ])
    const out = capture(() => printGraphSummary(makeResult(), MOCK_ROOT))
    expect(out).toContain('└─ deterministic check failed')
    expect(out).toContain('└─ blocked by failed_permanent ancestor: t4-failed')
  })

  it('degrades gracefully when tasks.yaml is missing (retry column shows "?")', () => {
    setRetry([])
    const out = capture(() => printGraphSummary(makeResult(), '/nonexistent/root'))
    expect(out).toContain('★ autonomy: 3/6 (50.0%)')
    expect(out).toMatch(/t1-alone[\s\S]*?/)
  })
})

// ── helpers ───────────────────────────────────────────────────────────────────
function capture(fn: () => void): string {
  const chunks: string[] = []
  const orig = console.log
  console.log = (...args: unknown[]) => chunks.push(args.map(String).join(' '))
  try { fn() } finally { console.log = orig }
  return chunks.join('\n')
}