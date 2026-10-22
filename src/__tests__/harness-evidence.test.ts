import { afterAll, afterEach, beforeAll, describe, expect, it, spyOn } from 'bun:test'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { DEFAULT_CONFIG } from '../config/schema.ts'
import { db } from '../db/sqlite.ts'
import { calcCost } from '../router/pricing.ts'
import * as roleRunner from '../router/role-runner.ts'
import { buildPrompt, previousFailureForTask } from '../run/prompt.ts'
import { parseCostBreakdownJson } from '../run/transcript-parser.ts'
import { loadTasks, saveTasks, updateTaskStatus } from '../tasks/loader.ts'
import type { Task } from '../tasks/schema.ts'

// F3.3 — every failure path of runTask leaves a row in `runs` AND returns
// a non-empty `runId` that resolves via getRun() to a real record. Two
// things under test, asserted for each of the 6 failure paths:
//   (a) TaskResult.runId is non-empty (not '')
//   (b) getRun(result.runId) returns a row whose .result field contains
//       the expected error message and whose .status === 'failed'
//
// The LLM provider is mocked via globalThis.fetch (same pattern as
// harness-retry.test.ts — every provider.chat() makes exactly one fetch,
// no race window). The DB is the real `~/.orchestos/db.sqlite` singleton
// (runMigrations() in beforeAll to guarantee the schema exists in a fresh
// CI environment). Each test queries the DB with the runId returned by
// runTask, so cross-test interference is impossible — no listRuns, no
// row-count assertions.
//
// IDEAS.md #20 (2026-07-05): this real DB is the SAME one the live dashboard
// reads from — Carlos saw these fixture rows (task_id 'f3-3-evidence') show
// up as fake "Recent Runs" every time someone ran `bun test` locally. afterAll
// below deletes every row this file inserts so the dashboard stays clean.

const originalFetch = globalThis.fetch
const originalKey = process.env.OPENROUTER_API_KEY

beforeAll(async () => {
  const { runMigrations } = await import('../db/migrate.ts')
  runMigrations()
})

afterAll(() => {
  db.run("DELETE FROM runs WHERE task_id = 'f3-3-evidence'")
})

afterEach(() => {
  globalThis.fetch = originalFetch
  if (originalKey === undefined) delete process.env.OPENROUTER_API_KEY
  else process.env.OPENROUTER_API_KEY = originalKey
})

function tmpDir(): string {
  return mkdtempSync(join(tmpdir(), 'orchestos-f3-3-'))
}

function openRouterResponse(
  content: string,
  promptTokens = 1,
  completionTokens = 1,
  model = 'mock/model',
) {
  return new Response(
    JSON.stringify({
      choices: [{ message: { content } }],
      usage: { prompt_tokens: promptTokens, completion_tokens: completionTokens },
      model,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
}

type FetchHandler = (body: {
  model: string
  messages: Array<{ role: string; content: string }>
}) => Response | Error | Promise<Response | Error>

function installMockFetch(handlers: FetchHandler[]) {
  const calls: Array<{ model: string; messages: Array<{ role: string; content: string }> }> = []
  let i = 0
  globalThis.fetch = (async (_url: string | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body))
    calls.push(body)
    const handler = handlers[i++]
    if (!handler) throw new Error(`mock fetch: no handler for call #${i}`)
    const result = await handler(body)
    if (result instanceof Error) throw result
    return result
  }) as unknown as typeof fetch
  return calls
}

const QA_CRITERION = 'out.txt contiene hello'

function qaJson(verdict: 'pass' | 'fail', reason: string): string {
  return JSON.stringify({
    verdict,
    reason,
    criteria: [
      {
        text: QA_CRITERION,
        pass: verdict === 'pass',
        evidence: { file: 'out.txt', excerpt: 'hello' },
      },
    ],
  })
}

function baseTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'f3-3-evidence',
    description: 'F3.3 evidence test',
    executor: 'openrouter',
    input: [],
    output: ['out.txt'],
    depends_on: [],
    status: 'pending',
    retry_count: 0,
    ...overrides,
  }
}

async function callRunTask(task: ReturnType<typeof baseTask>, dir: string, modelOverride?: string) {
  const { runTask } = await import('../run/harness.ts')
  const { RunLogger } = await import('../run/logger.ts')
  const log = new RunLogger(dir, task.id)
  return runTask({
    projectRoot: dir,
    contextText: '',
    task,
    modelOverride,
    logger: log,
    sandboxMode: 'cwd',
    orcheConfig: {
      ...DEFAULT_CONFIG,
      roles: {
        executor: { agent: 'api', provider: 'openrouter', model: 'mock/model' },
        reviewer: { agent: 'api', provider: 'openrouter', model: 'mock/reviewer' },
      },
    },
  })
}

async function assertRowForFailure(
  task: ReturnType<typeof baseTask>,
  result: Awaited<ReturnType<typeof callRunTask>>,
  expectedSubstring: string,
) {
  expect(result.runId).not.toBe('')
  expect(result.runId.length).toBeGreaterThan(0)
  const { getRun } = await import('../db/runs.ts')
  const row = getRun(result.runId)
  expect(row).not.toBeNull()
  expect(row!.task_id).toBe(task.id)
  const haystack = `${row!.result ?? ''} ${row!.qa_reason ?? ''}`
  expect(haystack).toContain(expectedSubstring)
}

describe('F3.3 — every failure path leaves a row in runs and a non-empty runId', () => {
  it('F3.1 LLM call catch: provider that throws inserts a row with the error message', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-test-or-key'
    installMockFetch([() => new Error('test provider boom 401')])

    const dir = tmpDir()
    try {
      const task = baseTask()
      const result = await callRunTask(task, dir)
      expect(result.status).toBe('failed')
      await assertRowForFailure(task, result, 'test provider boom 401')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('parse error: LLM returns text without <<<FILE:...>>> blocks inserts a row with the parse error', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-test-or-key'
    installMockFetch([() => openRouterResponse('this response has no file blocks at all')])

    const dir = tmpDir()
    try {
      const task = baseTask()
      const result = await callRunTask(task, dir)
      expect(result.status).toBe('failed')
      await assertRowForFailure(task, result, 'No <<<FILE:...>>>')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('contract violation: LLM emits a path outside declared output[] inserts a row with the violation', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-test-or-key'
    installMockFetch([() => openRouterResponse('<<<FILE:rogue.txt>>>\nhello\n<<<ENDFILE>>>')])

    const dir = tmpDir()
    try {
      const task = baseTask({ output: ['out.txt'] })
      const result = await callRunTask(task, dir)
      expect(result.status).toBe('failed')
      await assertRowForFailure(task, result, 'CONTRACT VIOLATION')
      const { getRun } = await import('../db/runs.ts')
      expect(getRun(result.runId)!.status).toBe('blocked')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('missing declared outputs: LLM writes one of two declared outputs inserts a row with the missing list', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-test-or-key'
    installMockFetch([() => openRouterResponse('<<<FILE:out-a.txt>>>\nhello\n<<<ENDFILE>>>')])

    const dir = tmpDir()
    try {
      const task = baseTask({ output: ['out-a.txt', 'out-b.txt'] })
      const result = await callRunTask(task, dir)
      expect(result.status).toMatch(/^(failed|retry)$/)
      await assertRowForFailure(task, result, 'missing declared output(s): out-b.txt')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('check fail: deterministic check exits non-zero inserts a row with the check failure', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-test-or-key'
    installMockFetch([() => openRouterResponse('<<<FILE:out.txt>>>\nhello\n<<<ENDFILE>>>')])

    const dir = tmpDir()
    try {
      const task = baseTask({ output: ['out.txt'], checks: [{ cmd: 'false' }] })
      const result = await callRunTask(task, dir)
      expect(result.status).toMatch(/^(failed|retry)$/)
      await assertRowForFailure(task, result, 'check failed: false exit 1')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('TRUST.1: the stderr tail survives persistence and reaches attempt 2 prompt', async () => {
    process.env.OPENROUTER_API_KEY = ['test', 'trust', 'key'].join('-')
    installMockFetch([() => openRouterResponse('<<<FILE:out.txt>>>\nhello\n<<<ENDFILE>>>')])
    const dir = tmpDir()
    try {
      const task = baseTask({
        checks: [
          { cmd: `bun -e 'console.error("noise".repeat(1000)+"TRUST1-MARKER"),process.exit(1)'` },
        ],
      })
      saveTasks(dir, { version: 1, project: 'trust-test', tasks: [task] })
      const result = await callRunTask(task, dir)
      expect(result.status).toBe('retry')
      expect(result.retryReason).toEndWith('TRUST1-MARKER\n')
      const { getRun } = await import('../db/runs.ts')
      expect(getRun(result.runId)!.qa_reason).toBe(result.retryReason!)
      updateTaskStatus(dir, task.id, {
        status: 'pending',
        retry_count: 1,
        retry_reason: result.retryReason,
      })
      const persisted = loadTasks(dir).tasks[0]!
      const prompt = buildPrompt(
        persisted,
        '',
        dir,
        undefined,
        undefined,
        previousFailureForTask(persisted),
      )
      expect(prompt.userContent).toContain('TRUST1-MARKER')
      expect(prompt.userContent).toContain('--- stderr (tail) ---')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('QA fail: QA judge returns verdict=fail inserts a row with the QA reason', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-test-or-key'
    installMockFetch([
      () => openRouterResponse('<<<FILE:out.txt>>>\nhello\n<<<ENDFILE>>>'),
      () => openRouterResponse(qaJson('fail', 'qa fail test reason')),
    ])

    const dir = tmpDir()
    try {
      const task = baseTask({
        output: ['out.txt'],
        acceptance_criteria: [QA_CRITERION],
      })
      const result = await callRunTask(task, dir)
      expect(result.status).toMatch(/^(failed|retry)$/)
      await assertRowForFailure(task, result, 'QA fail')
      const { getRun } = await import('../db/runs.ts')
      const row = getRun(result.runId)!
      expect(row.qa_verdict).toBe('fail')
      expect(row.qa_reason).toBe('qa fail test reason')
      expect(result.retryReason).toBe(`Opinión del juez QA (${row.qa_model}): qa fail test reason`)
      const fileDiffs = JSON.parse(row.file_diffs ?? '[]') as Array<{ path: string; diff: string }>
      expect(fileDiffs).toHaveLength(1)
      expect(fileDiffs[0]).toMatchObject({ path: 'out.txt' })
      expect(fileDiffs[0]?.diff).toContain('+hello')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('F4.3 — missing outputs does not false-positive when LLM emitted ./out-a.txt (normalized before compare)', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-test-or-key'
    installMockFetch([() => openRouterResponse('<<<FILE:./out-a.txt>>>\nhello\n<<<ENDFILE>>>')])

    const dir = tmpDir()
    try {
      const task = baseTask({ output: ['out-a.txt', 'out-b.txt'] })
      const result = await callRunTask(task, dir)
      expect(result.status).toMatch(/^(failed|retry)$/)
      await assertRowForFailure(task, result, 'missing declared output(s): out-b.txt')
      const { getRun } = await import('../db/runs.ts')
      const row = getRun(result.runId)!
      const resultText = `${row.result ?? ''} ${row.qa_reason ?? ''}`
      expect(resultText).not.toContain('out-a.txt,')
      expect(resultText).not.toContain('./out-a.txt')
      const blocked = JSON.parse(row.files_blocked ?? '[]') as string[]
      const authorized = JSON.parse(row.files_authorized ?? '[]') as string[]
      expect(authorized).toContain('out-a.txt')
      expect(authorized).not.toContain('./out-a.txt')
      expect(blocked).not.toContain('out-a.txt')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('ERP.5.1 — el revisor LLM corre solo con criterios o un gate de revisión', () => {
  const EXEC = () => openRouterResponse('<<<FILE:out.txt>>>\nhello\n<<<ENDFILE>>>')

  it('sin criterios ni gates reales: runQA no se llama, skipped, qa_model null y motivo', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-test-or-key'
    const calls = installMockFetch([EXEC])
    const dir = tmpDir()
    try {
      const result = await callRunTask(baseTask({ output: ['out.txt'] }), dir)
      expect(result.status).toBe('done')
      expect(calls.length).toBe(1)
      const { getRun } = await import('../db/runs.ts')
      const row = getRun(result.runId)!
      expect(result.qaVerdict).toBe('skipped')
      expect(row.qa_verdict).toBe('skipped')
      expect(row.qa_model).toBeNull()
      expect(row.qa_reason).toBe('Sin revisión LLM y sin checks: nada verificó esta tarea')
      const breakdown = parseCostBreakdownJson(row.cost_breakdown_json)
      expect(breakdown).toHaveLength(1)
      expect(breakdown.some((entry) => entry.label === 'reviewer')).toBe(false)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('sin criterios con checks verdes: conserva el conteo, comandos y evidencia sin declarar QA pass', async () => {
    process.env.OPENROUTER_API_KEY = ['test', 'trust', 'key'].join('-')
    const calls = installMockFetch([EXEC])
    const dir = tmpDir()
    try {
      const result = await callRunTask(
        baseTask({ checks: [{ cmd: 'test -f out.txt' }, { cmd: 'true' }] }),
        dir,
      )
      expect(result.status).toBe('done')
      expect(result.qaVerdict).toBe('skipped')
      expect(result.qaReason).toBe(
        'Sin revisión LLM (la tarea no declara criterios). Checks: 2 en verde: test -f out.txt, true',
      )
      expect(calls).toHaveLength(1)
      const { getRun } = await import('../db/runs.ts')
      const row = getRun(result.runId)!
      expect(row.qa_verdict).toBe('skipped')
      expect(row.qa_reason).toBe(result.qaReason!)
      expect(JSON.parse(row.checks_json!)).toEqual([
        expect.objectContaining({ cmd: 'test -f out.txt', exitCode: 0 }),
        expect.objectContaining({ cmd: 'true', exitCode: 0 }),
      ])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('con criterios de aceptación: runQA se llama', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-test-or-key'
    const calls = installMockFetch([EXEC, () => openRouterResponse(qaJson('pass', 'ok'))])
    const dir = tmpDir()
    try {
      const task = baseTask({ output: ['out.txt'], acceptance_criteria: [QA_CRITERION] })
      const result = await callRunTask(task, dir)
      expect(result.status).toBe('done')
      expect(calls.length).toBe(2)
      const { getRun } = await import('../db/runs.ts')
      expect(getRun(result.runId)!.qa_model).not.toBeNull()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('con un gate real aplicado (security-review por la descripción): runQA se llama', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-test-or-key'
    const calls = installMockFetch([EXEC, () => openRouterResponse(qaJson('pass', 'ok'))])
    const dir = tmpDir()
    try {
      const task = baseTask({
        output: ['out.txt'],
        description: 'add a new authentication endpoint',
      })
      const result = await callRunTask(task, dir)
      expect(result.status).toBe('done')
      expect(calls.length).toBe(2)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('ERP.6.2 — el desglose incluye el costo del revisor después del ejecutor', () => {
  for (const usd of [0.0123, null]) {
    it(`revisor con usd=${usd}: conserva el costo del adaptador o lo declara desconocido`, async () => {
      const model = 'gpt-4o-mini'
      process.env.OPENROUTER_API_KEY = 'sk-test-or-key'
      installMockFetch([
        () => openRouterResponse('<<<FILE:out.txt>>>\nhello\n<<<ENDFILE>>>', 1000, 200),
      ])
      const originalRoleClient = roleRunner.roleClient
      // Exercise the real role adapter without invoking a CLI.
      const roleSpy = spyOn(roleRunner, 'roleClient').mockImplementation((cfg, role, opts) =>
        role === 'reviewer'
          ? roleRunner.clientFromAssignment(
              role,
              { agent: 'codex', model },
              {
                ...opts,
                deps: {
                  codex: async () => ({
                    text: qaJson('pass', 'reviewed'),
                    model,
                    inputTokens: 300,
                    outputTokens: 50,
                    cacheReadTokens: 0,
                    cacheWriteTokens: 0,
                    usd,
                    contextUsed: 350,
                    contextWindow: null,
                  }),
                },
              },
            )
          : originalRoleClient(cfg, role, opts),
      )
      const dir = tmpDir()
      try {
        const result = await callRunTask(
          baseTask({ acceptance_criteria: [QA_CRITERION] }),
          dir,
          'openai/gpt-4o',
        )
        expect(result.status).toBe('done')
        const { getRun } = await import('../db/runs.ts')
        const row = getRun(result.runId)!
        const breakdown = parseCostBreakdownJson(row.cost_breakdown_json)
        expect(breakdown).toHaveLength(2)
        const reviewer = breakdown[1]!
        expect(reviewer.model).toBe(model)
        expect(reviewer.label).toBe('reviewer')
        expect(reviewer.inputTokens).toBe(300)
        expect(reviewer.outputTokens).toBe(50)
        if (usd !== null) {
          expect(reviewer.costUsd).toBe(usd)
          expect(reviewer.source).not.toBe('unknown')
        } else {
          expect(reviewer.source).toBe('unknown')
          expect(reviewer.costUsd).toBe(0)
        }
        expect(
          Math.abs(breakdown.reduce((sum, entry) => sum + entry.costUsd, 0) - row.usd_cost),
        ).toBeLessThan(1e-9)
      } finally {
        roleSpy.mockRestore()
        rmSync(dir, { recursive: true, force: true })
      }
    })
  }

  for (const verdict of ['pass', 'fail'] as const) {
    it(`QA ${verdict}: persiste los tokens y costo del revisor y la suma coincide con el total`, async () => {
      process.env.OPENROUTER_API_KEY = 'sk-test-or-key'
      installMockFetch([
        () =>
          openRouterResponse(
            '<<<FILE:out.txt>>>\nhello\n<<<ENDFILE>>>',
            1000,
            200,
            'openai/gpt-4o',
          ),
        () => openRouterResponse(qaJson(verdict, 'reviewed'), 300, 50, 'openai/gpt-4o-mini'),
      ])
      const dir = tmpDir()
      try {
        const task = baseTask({ acceptance_criteria: [QA_CRITERION] })
        const result = await callRunTask(task, dir, 'openai/gpt-4o')
        expect(result.status).toBe(verdict === 'pass' ? 'done' : 'retry')
        const { getRun } = await import('../db/runs.ts')
        const row = getRun(result.runId)!
        expect(row.qa_verdict).toBe(verdict)
        const breakdown = parseCostBreakdownJson(row.cost_breakdown_json)
        expect(breakdown).toHaveLength(2)
        expect(breakdown[0]?.label).not.toBe('reviewer')
        expect(breakdown[0]?.model).toBe('openai/gpt-4o')
        const reviewerCost = calcCost('openai/gpt-4o-mini', 300, 50)
        expect(reviewerCost).toBeGreaterThan(0)
        expect(breakdown[1]).toEqual({
          label: 'reviewer',
          model: 'openai/gpt-4o-mini',
          inputTokens: 300,
          outputTokens: 50,
          costUsd: reviewerCost,
        })
        expect(row.usd_cost).toBeGreaterThan(reviewerCost)
        expect(
          Math.abs(breakdown.reduce((sum, entry) => sum + entry.costUsd, 0) - row.usd_cost),
        ).toBeLessThan(1e-9)
      } finally {
        rmSync(dir, { recursive: true, force: true })
      }
    })
  }
})
