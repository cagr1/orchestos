import { describe, it, expect, beforeAll, afterAll, afterEach } from 'bun:test'
import { mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { db } from '../db/sqlite.ts'
import { DEFAULT_CONFIG } from '../config/schema.ts'
import type { Task } from '../tasks/schema.ts'

// X.2 (IDEAS #33) — refuter barato, opt-in via orcheConfig.refuterQA. Corre SOLO cuando el
// QA normal (fetch #2) dio fail, antes de consumir un retry. Mirror asimétrico de
// harness-adversarial-qa.test.ts (K.4b): ahí una segunda opinión ataca un `pass`, acá ataca
// un `fail`. Mismo patrón de mock fetch, sin ventana de carrera.

const originalFetch = globalThis.fetch
const originalKey = process.env.OPENROUTER_API_KEY

beforeAll(async () => {
  const { runMigrations } = await import('../db/migrate.ts')
  runMigrations()
})

afterAll(() => {
  db.run("DELETE FROM runs WHERE task_id = 'x2-refuter'")
})

afterEach(() => {
  globalThis.fetch = originalFetch
  if (originalKey === undefined) delete process.env.OPENROUTER_API_KEY
  else process.env.OPENROUTER_API_KEY = originalKey
})

function tmpDir(): string {
  return mkdtempSync(join(tmpdir(), 'orchestos-x2-'))
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
    id: 'x2-refuter',
    description: 'X.2 refuter QA test',
    executor: 'openrouter',
    input: [],
    output: ['out.txt'],
    depends_on: [],
    status: 'pending',
    retry_count: 0,
    ...overrides,
  }
}

async function callRunTask(task: ReturnType<typeof baseTask>, dir: string, refuterQA: boolean) {
  const { runTask } = await import('../run/harness.ts')
  const { RunLogger } = await import('../run/logger.ts')
  const log = new RunLogger(dir, task.id)
  return runTask({
    projectRoot: dir,
    contextText: '',
    task,
    logger: log,
    sandboxMode: 'cwd',
    orcheConfig: { ...DEFAULT_CONFIG, refuterQA },
  })
}

describe('X.2 — refuter second opinion on fail (opt-in)', () => {
  it('disabled by default: only 2 fetch calls happen (executor + QA), no refuter pass', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-test-or-key'
    const calls = installMockFetch([
      () => openRouterResponse('<<<FILE:out.txt>>>\nhello\n<<<ENDFILE>>>'),
      () => openRouterResponse('{"verdict":"fail","reason":"qa fail test reason"}'),
    ])

    const dir = tmpDir()
    try {
      const task = baseTask()
      const result = await callRunTask(task, dir, false)
      expect(result.status).toMatch(/^(failed|retry)$/)
      expect(calls.length).toBe(2)
      const { getRun } = await import('../db/runs.ts')
      const row = getRun(result.runId)!
      expect(row.refuter_verdict).toBeNull()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('REFUTED upgrades the QA fail to pass and reuses the success path (no retry consumed)', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-test-or-key'
    installMockFetch([
      () => openRouterResponse('<<<FILE:out.txt>>>\nhello\n<<<ENDFILE>>>'),
      () => openRouterResponse('{"verdict":"fail","reason":"the judge misread the file"}'),
      () => openRouterResponse('{"verdict":"REFUTED","reason":"the file clearly satisfies the criteria, the judge was wrong"}'),
    ])

    const dir = tmpDir()
    try {
      const task = baseTask()
      const result = await callRunTask(task, dir, true)
      expect(result.status).toBe('done')
      const { getRun } = await import('../db/runs.ts')
      const row = getRun(result.runId)!
      expect(row.qa_verdict).toBe('pass')
      expect(row.qa_reason).toContain('refuter REFUTED the original fail')
      expect(row.qa_reason).toContain('the judge was wrong')
      expect(row.refuter_verdict).toBe('REFUTED')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('CONFIRMED keeps the fail standing and consumes the retry as normal', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-test-or-key'
    installMockFetch([
      () => openRouterResponse('<<<FILE:out.txt>>>\nhello\n<<<ENDFILE>>>'),
      () => openRouterResponse('{"verdict":"fail","reason":"genuinely broken"}'),
      () => openRouterResponse('{"verdict":"CONFIRMED","reason":"the judge was right, this is broken"}'),
    ])

    const dir = tmpDir()
    try {
      const task = baseTask()
      const result = await callRunTask(task, dir, true)
      expect(result.status).toBe('retry')
      const { getRun } = await import('../db/runs.ts')
      const row = getRun(result.runId)!
      expect(row.qa_verdict).toBe('fail')
      expect(row.status).toBe('failed')
      expect(row.refuter_verdict).toBe('CONFIRMED')
      expect(row.refuter_reason).toContain('the judge was right')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('does not run the refuter pass when the normal QA already passed', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-test-or-key'
    const calls = installMockFetch([
      () => openRouterResponse('<<<FILE:out.txt>>>\nhello\n<<<ENDFILE>>>'),
      () => openRouterResponse('{"verdict":"pass","reason":"looks fine"}'),
    ])

    const dir = tmpDir()
    try {
      const task = baseTask()
      const result = await callRunTask(task, dir, true)
      expect(result.status).toBe('done')
      expect(calls.length).toBe(2)
      const { getRun } = await import('../db/runs.ts')
      const row = getRun(result.runId)!
      expect(row.refuter_verdict).toBeNull()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
