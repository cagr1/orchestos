import { describe, it, expect, beforeAll, afterEach } from 'bun:test'
import { mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
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

const originalFetch = globalThis.fetch
const originalKey = process.env.OPENROUTER_API_KEY

beforeAll(async () => {
  const { runMigrations } = await import('../db/migrate.ts')
  runMigrations()
})

afterEach(() => {
  globalThis.fetch = originalFetch
  if (originalKey === undefined) delete process.env.OPENROUTER_API_KEY
  else process.env.OPENROUTER_API_KEY = originalKey
})

function tmpDir(): string {
  return mkdtempSync(join(tmpdir(), 'orchestos-f3-3-'))
}

function openRouterResponse(content: string, promptTokens = 1, completionTokens = 1) {
  return new Response(JSON.stringify({
    choices: [{ message: { content } }],
    usage: { prompt_tokens: promptTokens, completion_tokens: completionTokens },
    model: 'mock/model',
  }), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

type FetchHandler = (body: { model: string; messages: Array<{ role: string; content: string }> }) => Response | Error | Promise<Response | Error>

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

async function callRunTask(task: ReturnType<typeof baseTask>, dir: string) {
  const { runTask } = await import('../run/harness.ts')
  const { RunLogger } = await import('../run/logger.ts')
  const log = new RunLogger(dir, task.id)
  return runTask({
    projectRoot: dir,
    contextText: '',
    task,
    logger: log,
    sandboxMode: 'cwd',
  })
}

async function assertRowForFailure(task: ReturnType<typeof baseTask>, result: Awaited<ReturnType<typeof callRunTask>>, expectedSubstring: string) {
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

  it('QA fail: QA judge returns verdict=fail inserts a row with the QA reason', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-test-or-key'
    installMockFetch([
      () => openRouterResponse('<<<FILE:out.txt>>>\nhello\n<<<ENDFILE>>>'),
      () => openRouterResponse('{"verdict":"fail","reason":"qa fail test reason"}'),
    ])

    const dir = tmpDir()
    try {
      const task = baseTask({ output: ['out.txt'] })
      const result = await callRunTask(task, dir)
      expect(result.status).toMatch(/^(failed|retry)$/)
      await assertRowForFailure(task, result, 'QA fail')
      const { getRun } = await import('../db/runs.ts')
      const row = getRun(result.runId)!
      expect(row.qa_verdict).toBe('fail')
      expect(row.qa_reason).toContain('qa fail test reason')
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
