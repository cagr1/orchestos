import { describe, it, expect, mock, beforeEach, afterEach } from 'bun:test'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { parse as yamlParse, stringify as yamlStringify } from 'yaml'
import { runGraph } from '../run/graph-runner.ts'

// ── Stub runTask/diagnoseTask/loadTasks/updateTaskStatus via runGraph's injection seam
// (GraphRunOpts.*Fn), NOT mock.module() — Bun's mock.module() replaces a module for the
// rest of the `bun test` process (every file that imports run/harness.ts,
// agents/diagnose.ts or tasks/loader.ts after this one runs would get the mock too —
// confirmed: diagnose.test.ts and graph-summary.test.ts both mock tasks/loader.ts and
// broke this file's real-file-based task state when run together in the shared suite).
// loadTasksFn/updateTaskStatusFn below are a small local reimplementation against the
// real tasks.yaml on disk — deliberately NOT importing '../tasks/loader.ts' at all, so
// this file can never be corrupted by another file's mock of that module.
const runTaskMock = mock()
const diagnoseTaskMock = mock()

function fakeLoadTasks(root: string): { version: 1; project: string; tasks: any[] } {
  return yamlParse(readFileSync(join(root, 'tasks.yaml'), 'utf-8'))
}

function fakeUpdateTaskStatus(root: string, taskId: string, patch: Record<string, unknown>): void {
  const file = fakeLoadTasks(root)
  const task = file.tasks.find((t: any) => t.id === taskId)
  if (!task) throw new Error(`Task "${taskId}" not found in tasks.yaml`)
  Object.assign(task, patch)
  writeFileSync(join(root, 'tasks.yaml'), yamlStringify(file, { lineWidth: 120 }), 'utf-8')
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeTask(id: string, deps: string[] = []): Record<string, unknown> {
  return {
    id,
    description: `Task ${id}`,
    executor: 'openrouter',
    input: [],
    output: [`${id}.txt`],
    depends_on: deps,
    status: 'pending',
    retry_count: 0,
  }
}

function writeTasks(root: string, tasks: Record<string, unknown>[]): void {
  writeFileSync(
    join(root, 'tasks.yaml'),
    yamlStringify({ version: 1, project: 'test-project', tasks }, { lineWidth: 120 }),
    'utf-8',
  )
}

function doneResult(taskId: string): ReturnType<typeof runTaskMock> {
  return {
    status: 'done' as const,
    runId: `run-${taskId}`,
    qaVerdict: 'pass' as const,
    qaReason: undefined,
    retryReason: undefined,
    filesWritten: [`${taskId}.txt`],
    filesBlocked: [],
    cost: { inputTokens: 10, outputTokens: 5, usd: 0.05 },
    elapsedMs: 10,
    contextWarnings: [],
  }
}

function highCostResult(taskId: string): ReturnType<typeof runTaskMock> {
  return {
    status: 'done' as const,
    runId: `run-${taskId}`,
    qaVerdict: 'pass' as const,
    qaReason: undefined,
    retryReason: undefined,
    filesWritten: [`${taskId}.txt`],
    filesBlocked: [],
    cost: { inputTokens: 20, outputTokens: 10, usd: 0.10 },
    elapsedMs: 10,
    contextWarnings: [],
  }
}

function failedResult(taskId: string): ReturnType<typeof runTaskMock> {
  return {
    status: 'failed' as const,
    runId: `run-${taskId}`,
    qaVerdict: 'fail' as const,
    qaReason: 'mock failure',
    retryReason: 'mock failure in harness',
    filesWritten: [],
    filesBlocked: [],
    cost: { inputTokens: 5, outputTokens: 2, usd: 0.01 },
    elapsedMs: 5,
    contextWarnings: [],
  }
}

function makeOpts(root: string, overrides: Record<string, unknown> = {}) {
  return {
    projectRoot: root,
    contextText: 'test context for graph runner unit tests',
    sandboxMode: 'cwd' as const,
    runTaskFn: runTaskMock as any,
    diagnoseFn: diagnoseTaskMock as any,
    loadTasksFn: fakeLoadTasks as any,
    updateTaskStatusFn: fakeUpdateTaskStatus as any,
    ...overrides,
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('runGraph (D1)', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'graph-runner-d1-'))
    runTaskMock.mockReset()
    diagnoseTaskMock.mockReset()
  })

  afterEach(() => {
    if (tmpDir) {
      try { rmSync(tmpDir, { recursive: true, force: true }) } catch { /* ok */ }
    }
  })

  // ── Happy path ─────────────────────────────────────────────────────────────

  it('happy path: linear chain A→B→C completes all tasks', async () => {
    writeTasks(tmpDir, [makeTask('a'), makeTask('b', ['a']), makeTask('c', ['b'])])
    runTaskMock.mockImplementation(async (opts: any) => doneResult(opts.task.id))

    const result = await runGraph(makeOpts(tmpDir))

    expect(result.tasks).toHaveLength(3)
    expect(result.tasks.every(t => t.outcome === 'completed')).toBe(true)
    expect(result.autonomy_metric).toBe(1)
    expect(result.circuit_break_reason).toBeUndefined()
    expect(result.aggregated_cost).toBeCloseTo(0.15, 5)
  })

  it('happy path: parallel tasks (no deps) all complete', async () => {
    writeTasks(tmpDir, [makeTask('a'), makeTask('b'), makeTask('c')])
    runTaskMock.mockImplementation(async (opts: any) => doneResult(opts.task.id))

    const result = await runGraph(makeOpts(tmpDir))

    expect(result.tasks).toHaveLength(3)
    expect(result.tasks.every(t => t.outcome === 'completed')).toBe(true)
    expect(result.autonomy_metric).toBe(1)
  })

  it('happy path: single task completes', async () => {
    writeTasks(tmpDir, [makeTask('a')])
    runTaskMock.mockImplementation(async (opts: any) => doneResult(opts.task.id))

    const result = await runGraph(makeOpts(tmpDir))

    expect(result.tasks).toHaveLength(1)
    expect(result.tasks[0]!.outcome).toBe('completed')
    expect(result.autonomy_metric).toBe(1)
  })

  // ── Branch isolation ──────────────────────────────────────────────────────

  it('branch isolation: A fails permanently → B blocked, C→D complete independently', async () => {
    writeTasks(tmpDir, [
      makeTask('a'),
      makeTask('b', ['a']),
      makeTask('c'),
      makeTask('d', ['c']),
    ])

    diagnoseTaskMock.mockResolvedValue({
      taskId: 'a',
      pattern: 'unknown',
      confidence: 'low',
      suggestion: 'review the task manually',
      details: '',
      usdCost: 0.005,
    })

    let aCalls = 0
    runTaskMock.mockImplementation(async (opts: any) => {
      if (opts.task.id === 'a') {
        aCalls++
        return failedResult('a') // A always fails → permanent after MAX_RETRIES attempts
      }
      return doneResult(opts.task.id) // C, D succeed
    })

    const result = await runGraph(makeOpts(tmpDir))

    expect(result.tasks.find(t => t.id === 'a')!.outcome).toBe('failed_permanent')
    expect(result.tasks.find(t => t.id === 'b')!.outcome).toBe('blocked')
    expect(result.tasks.find(t => t.id === 'c')!.outcome).toBe('completed')
    expect(result.tasks.find(t => t.id === 'd')!.outcome).toBe('completed')
    // 2/4 autonomous (C, D)
    expect(result.autonomy_metric).toBeCloseTo(0.5, 2)
    expect(result.circuit_break_reason).toBeUndefined()
  })

  it('branch isolation: first task fails in a 3-task linear chain', async () => {
    writeTasks(tmpDir, [makeTask('a'), makeTask('b', ['a']), makeTask('c', ['b'])])

    diagnoseTaskMock.mockResolvedValue({
      taskId: 'a', pattern: 'unknown', confidence: 'low',
      suggestion: '', details: '', usdCost: 0.005,
    })

    runTaskMock.mockImplementation(async (opts: any) => {
      if (opts.task.id === 'a') return failedResult('a')
      return doneResult(opts.task.id)
    })

    const result = await runGraph(makeOpts(tmpDir))

    expect(result.tasks.find(t => t.id === 'a')!.outcome).toBe('failed_permanent')
    expect(result.tasks.find(t => t.id === 'b')!.outcome).toBe('blocked')
    expect(result.tasks.find(t => t.id === 'c')!.outcome).toBe('blocked')
    expect(result.autonomy_metric).toBe(0)
  })

  // ── Circuit breaker ───────────────────────────────────────────────────────

  it('circuit breaker: cost limit stops graph', async () => {
    writeTasks(tmpDir, [makeTask('a'), makeTask('b'), makeTask('c')])
    runTaskMock.mockImplementation(async (opts: any) => highCostResult(opts.task.id))

    // Each task costs 0.10. A + B = 0.20 ≥ 0.15 → break after B.
    const result = await runGraph(makeOpts(tmpDir, { maxCost: 0.15 }))

    const a = result.tasks.find(t => t.id === 'a')!
    const b = result.tasks.find(t => t.id === 'b')!
    const c = result.tasks.find(t => t.id === 'c')!
    expect(a.outcome).toBe('completed')
    expect(b.outcome).toBe('completed')
    expect(c.outcome).toBe('skipped_circuit_breaker')
    expect(result.circuit_break_reason).toContain('cost limit')
  })

  it('circuit breaker: maxCost=0 stops immediately (no tasks run)', async () => {
    writeTasks(tmpDir, [makeTask('a'), makeTask('b')])
    runTaskMock.mockImplementation(async (opts: any) => doneResult(opts.task.id))

    const result = await runGraph(makeOpts(tmpDir, { maxCost: 0 }))

    expect(result.tasks.every(t => t.outcome === 'skipped_circuit_breaker')).toBe(true)
    expect(result.circuit_break_reason).toContain('cost limit')
    expect(result.aggregated_cost).toBe(0)
  })

  // ── Diagnose-guided retry ─────────────────────────────────────────────────

  it('diagnose rate_limit → task is requeued and completes as rate_limited_then_completed', async () => {
    writeTasks(tmpDir, [makeTask('a')])

    let aCalls = 0
    runTaskMock.mockImplementation(async (opts: any) => {
      if (opts.task.id === 'a') {
        aCalls++
        // First 3 calls: fail (needs MAX_RETRIES=3 attempts to hit permanent)
        if (aCalls <= 3) return failedResult('a')
        // 4th call (after rate_limit requeue): succeed
        return doneResult('a')
      }
      return doneResult(opts.task.id)
    })

    diagnoseTaskMock.mockResolvedValue({
      taskId: 'a',
      pattern: 'rate_limit',
      confidence: 'high',
      suggestion: 'wait 10s and retry',
      details: 'provider rate limited',
      usdCost: 0.005,
    })

    // Speed up the graph-runner's internal sleep (RATE_LIMIT_REQUEUE_DELAY_MS = 10s → 1ms)
    const realSetTimeout = globalThis.setTimeout
    globalThis.setTimeout = ((fn: any, _ms: number, ...args: any[]) =>
      realSetTimeout(fn, 1, ...args)) as typeof globalThis.setTimeout
    try {
      const result = await runGraph(makeOpts(tmpDir))

      const a = result.tasks.find(t => t.id === 'a')!
      expect(a.outcome).toBe('rate_limited_then_completed')
      // Cost should include failed attempts + diagnose + successful attempt
      expect(a.usd_cost).toBeGreaterThan(0)
      expect(result.autonomy_metric).toBe(1)
      expect(result.circuit_break_reason).toBeUndefined()
    } finally {
      globalThis.setTimeout = realSetTimeout
    }
  })

  it('diagnose non-rate_limit (unknown) → task stays failed_permanent, no requeue', async () => {
    writeTasks(tmpDir, [makeTask('a'), makeTask('b', ['a'])])

    diagnoseTaskMock.mockResolvedValue({
      taskId: 'a',
      pattern: 'unknown',
      confidence: 'low',
      suggestion: 'investigate manually',
      details: 'could not determine failure pattern',
      usdCost: 0.005,
    })

    runTaskMock.mockImplementation(async (opts: any) => {
      if (opts.task.id === 'a') return failedResult('a')
      return doneResult(opts.task.id)
    })

    const result = await runGraph(makeOpts(tmpDir))

    // A failed permanently (no rate_limit requeue)
    expect(result.tasks.find(t => t.id === 'a')!.outcome).toBe('failed_permanent')
    expect(result.tasks.find(t => t.id === 'b')!.outcome).toBe('blocked')
    expect(result.circuit_break_reason).toBeUndefined()
  })

  // ── Edge cases ────────────────────────────────────────────────────────────

  it('empty tasks list returns empty result with autonomy=1', async () => {
    writeTasks(tmpDir, [])

    const result = await runGraph(makeOpts(tmpDir))

    expect(result.tasks).toHaveLength(0)
    expect(result.autonomy_metric).toBe(1)
    expect(result.circuit_break_reason).toBeUndefined()
  })

  it('all tasks already done → nothing to run', async () => {
    const task = makeTask('a')
    task.status = 'done'
    writeTasks(tmpDir, [task])

    const result = await runGraph(makeOpts(tmpDir))

    expect(result.tasks).toHaveLength(0)
    expect(result.autonomy_metric).toBe(1)
  })
})
