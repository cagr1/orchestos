import { describe, it, expect, mock, beforeAll, afterAll } from 'bun:test'
import { mkdtempSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import type { SubagentResult, SubTask } from '../agents/sub-agent.ts'
import { git } from '../run/sandbox.ts'

// ── Temp git repo compartido ──
let repoRoot: string

beforeAll(() => {
  repoRoot = mkdtempSync(join(tmpdir(), 'orchestos-execplan-'))
  git(['init', '-b', 'main'], repoRoot)
  git(['config', 'user.email', 'test@test.com'], repoRoot)
  git(['config', 'user.name', 'Test'], repoRoot)
  writeFileSync(join(repoRoot, 'README.md'), 'init')
  git(['add', '-A'], repoRoot)
  git(['commit', '-m', 'init'], repoRoot)
})

afterAll(() => {
  rmSync(repoRoot, { recursive: true, force: true })
})

// ── Set para controlar qué sub-tareas simulan timeout ──
const timedOutTasks = new Set<string>()

// Mock hardening.ts para interceptar withSubTaskTimeout y
// permitir simular timeouts sin esperar 5 min reales.
mock.module('../agents/hardening.ts', () => ({
  DEFAULT_SUB_TASK_TIMEOUT_MS: 300_000,
  MAX_TOOL_CALLS: 20,
  WORKTREE_MAX_RETRIES: 3,
  WORKTREE_INITIAL_BACKOFF_MS: 300,
  RATE_LIMIT_MAX_RETRIES: 3,
  RATE_LIMIT_INITIAL_BACKOFF_MS: 2_000,
  TimeoutError: class extends Error {
    constructor(public readonly taskId: string, public readonly timeoutMs: number) {
      super(`sub-task "${taskId}" timed out after ${timeoutMs}ms`)
      this.name = 'TimeoutError'
    }
  },
  ToolCallLimitError: class extends Error {
    constructor(public readonly count: number, public readonly limit: number) {
      super(`Tool call limit: ${count} > ${limit}`)
      this.name = 'ToolCallLimitError'
    }
  },
  WorktreeCollisionError: class extends Error {
    constructor(m: string) { super(m); this.name = 'WorktreeCollisionError' }
  },
  withSubTaskTimeout: mock(async (promise: Promise<any>, _timeoutMs: number, taskId: string) => {
    if (timedOutTasks.has(taskId)) {
      return { result: null, timedOut: true }
    }
    const result = await promise
    return { result, timedOut: false }
  }),
  createWorktreeWithRetry: mock(async (taskId: string, baseBranch: string, projectRoot: string) => {
    const { createWorktree } = await import('../run/sandbox.ts')
    return createWorktree(taskId, baseBranch, projectRoot)
  }),
  ToolCallCounter: class {
    limit: number; current = 0
    constructor(limit = 20) { this.limit = limit }
    increment() { this.current++; if (this.current > this.limit) throw new Error('exceeded') }
    get exhausted() { return this.current >= this.limit }
  },
  withRateLimitRetry: mock(async (fn: () => Promise<any>) => fn()),
  isRateLimitError: mock(() => false),
}))

const { executePlan } = await import('../run/scheduler.ts')
const { createSubTask } = await import('../agents/sub-agent.ts')

// ── Helpers ──

function sub(id: string, dependsOn: string[] = []): SubTask {
  return createSubTask({
    id,
    description: `Sub-task ${id}`,
    acceptance: [`${id} works`],
    depends_on: dependsOn,
    allowed_tools: ['read', 'write', 'edit'],
    output: [`${id}.txt`],
  })
}

function completedResult(id: string, overrides: Partial<SubagentResult> = {}): SubagentResult {
  return {
    sub_task_id: id,
    status: 'completed',
    result: 'ok',
    usd_cost: 0.05,
    tokens: { input: 100, output: 50 },
    elapsed_ms: 200,
    files_written: [`${id}.txt`],
    qa_verdict: 'pass',
    ...overrides,
  }
}

function failedResult(id: string, error = 'intentional failure'): SubagentResult {
  return {
    sub_task_id: id,
    status: 'failed',
    error,
    usd_cost: 0.01,
    tokens: { input: 50, output: 20 },
    elapsed_ms: 100,
    files_written: [],
    qa_verdict: 'fail',
  }
}

function opts() {
  return {
    parentTaskId: 'test-plan',
    projectRoot: repoRoot,
    baseBranch: 'main',
  }
}

// ────────────────────────────────────────────────
// Orden topológico respetado
// ────────────────────────────────────────────────

describe('executePlan — topological order', () => {
  it('processes sub-tasks in the given linear order A → B → C', async () => {
    const order: string[] = []

    const result = await executePlan(
      [sub('a'), sub('b', ['a']), sub('c', ['b'])],
      opts(),
      async (st) => {
        order.push(st.id)
        return completedResult(st.id)
      },
    )

    expect(order).toEqual(['a', 'b', 'c'])
    expect(result.all_passed).toBe(true)
  })
})

// ────────────────────────────────────────────────
// Cascada: fallo de una sub-tarea → dependientes skipped
// ────────────────────────────────────────────────

describe('executePlan — cascade on failure', () => {
  it('marks dependents as skipped with reason when a predecessor fails', async () => {
    const result = await executePlan(
      [sub('a'), sub('b', ['a']), sub('c', ['b'])],
      opts(),
      async (st) => {
        if (st.id === 'b') return failedResult('b')
        return completedResult(st.id)
      },
    )

    const a = result.sub_tasks.find(l => l.id === 'a')!
    expect(a.status).toBe('completed')

    const b = result.sub_tasks.find(l => l.id === 'b')!
    expect(b.status).toBe('failed')
    expect(b.error).toBe('intentional failure')

    const c = result.sub_tasks.find(l => l.id === 'c')!
    expect(c.status).toBe('skipped')
    expect(c.error).toContain('dependency failed')
    expect(c.error).toContain('b')

    expect(result.all_passed).toBe(false)
  })

  it('cascades only one level (dependents of skipped are not auto-skipped)', async () => {
    const result = await executePlan(
      [sub('a'), sub('b', ['a']), sub('c', ['b'])],
      opts(),
      async (st) => {
        if (st.id === 'b') return failedResult('b')
        return completedResult(st.id)
      },
    )

    expect(result.sub_tasks.find(l => l.id === 'a')!.status).toBe('completed')
    expect(result.sub_tasks.find(l => l.id === 'b')!.status).toBe('failed')
    expect(result.sub_tasks.find(l => l.id === 'c')!.status).toBe('skipped')
  })
})

// ────────────────────────────────────────────────
// Timeout → timed_out
// ────────────────────────────────────────────────

describe('executePlan — timeout handling', () => {
  it('marks sub-task as timed_out when withSubTaskTimeout returns timedOut', async () => {
    timedOutTasks.add('b')

    const result = await executePlan(
      [sub('a'), sub('b', ['a']), sub('c', ['b'])],
      opts(),
      async (st) => {
        return completedResult(st.id)
      },
    )

    expect(result.sub_tasks.find(l => l.id === 'a')!.status).toBe('completed')
    expect(result.sub_tasks.find(l => l.id === 'b')!.status).toBe('timed_out')
    expect(result.sub_tasks.find(l => l.id === 'c')!.status).toBe('skipped')
    expect(result.all_passed).toBe(false)

    timedOutTasks.clear()
  })
})

// ────────────────────────────────────────────────
// Agregación de cost/tokens/ms
// ────────────────────────────────────────────────

describe('executePlan — aggregation', () => {
  it('aggregates cost, tokens, and elapsed_ms correctly across completed sub-tasks', async () => {
    const result = await executePlan(
      [sub('a'), sub('b', ['a'])],
      opts(),
      async (st) => {
        if (st.id === 'a') {
          return completedResult('a', { usd_cost: 0.10, tokens: { input: 200, output: 100 }, elapsed_ms: 500 })
        }
        return completedResult('b', { usd_cost: 0.20, tokens: { input: 300, output: 150 }, elapsed_ms: 700 })
      },
    )

    expect(result.aggregated_cost).toBeCloseTo(0.30)
    expect(result.aggregated_tokens.input).toBe(500)
    expect(result.aggregated_tokens.output).toBe(250)
    expect(result.aggregated_ms).toBe(1200)
  })

  it('aggregates only cost from failed tasks (skipped add zero)', async () => {
    const result = await executePlan(
      [sub('a'), sub('b', ['a'])],
      opts(),
      async (st) => {
        if (st.id === 'a') return failedResult('a')
        return completedResult(st.id)
      },
    )

    expect(result.aggregated_cost).toBeCloseTo(0.01)
    expect(result.aggregated_ms).toBe(100)
  })
})

// ────────────────────────────────────────────────
// all_passed
// ────────────────────────────────────────────────

describe('executePlan — all_passed', () => {
  it('is true when all sub-tasks complete successfully', async () => {
    const result = await executePlan(
      [sub('a'), sub('b', ['a'])],
      opts(),
      async (st) => completedResult(st.id),
    )

    expect(result.all_passed).toBe(true)
  })

  it('is false when any sub-task fails', async () => {
    const result = await executePlan(
      [sub('a'), sub('b', ['a'])],
      opts(),
      async (st) => {
        if (st.id === 'b') return failedResult('b')
        return completedResult(st.id)
      },
    )

    expect(result.all_passed).toBe(false)
  })

  it('is false when any sub-task times out', async () => {
    timedOutTasks.add('a')
    const result = await executePlan(
      [sub('a')],
      opts(),
      async (st) => completedResult(st.id),
    )

    expect(result.all_passed).toBe(false)
    timedOutTasks.clear()
  })
})
