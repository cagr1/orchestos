import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { DEFAULT_CONFIG } from '../config/schema.ts'
import { db } from '../db/sqlite.ts'
import type { Task } from '../tasks/schema.ts'

// K.4b — segundo juez adversarial, opt-in via orcheConfig.adversarialQA. Corre
// SOLO cuando el QA normal (fetch #2) ya dio pass, antes del merge. Mismo
// patrón de mock que harness-evidence.test.ts: cada provider.chat() = un fetch,
// sin ventana de carrera.

const originalFetch = globalThis.fetch
const originalKey = process.env.OPENROUTER_API_KEY

beforeAll(async () => {
  const { runMigrations } = await import('../db/migrate.ts')
  runMigrations()
})

afterAll(() => {
  db.run("DELETE FROM runs WHERE task_id = 'k4b-adversarial'")
})

afterEach(() => {
  globalThis.fetch = originalFetch
  if (originalKey === undefined) delete process.env.OPENROUTER_API_KEY
  else process.env.OPENROUTER_API_KEY = originalKey
})

function tmpDir(): string {
  return mkdtempSync(join(tmpdir(), 'orchestos-k4b-'))
}

function openRouterResponse(content: string, promptTokens = 1, completionTokens = 1) {
  return new Response(
    JSON.stringify({
      choices: [{ message: { content } }],
      usage: { prompt_tokens: promptTokens, completion_tokens: completionTokens },
      model: 'mock/model',
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

function baseTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'k4b-adversarial',
    description: 'K.4b adversarial QA test',
    executor: 'openrouter',
    input: [],
    output: ['out.txt'],
    depends_on: [],
    status: 'pending',
    retry_count: 0,
    ...overrides,
  }
}

async function callRunTask(task: ReturnType<typeof baseTask>, dir: string, adversarialQA: boolean) {
  const { runTask } = await import('../run/harness.ts')
  const { RunLogger } = await import('../run/logger.ts')
  const log = new RunLogger(dir, task.id)
  return runTask({
    projectRoot: dir,
    contextText: '',
    task,
    logger: log,
    sandboxMode: 'cwd',
    orcheConfig: { ...DEFAULT_CONFIG, adversarialQA },
  })
}

describe('K.4b — adversarial second opinion (opt-in)', () => {
  it('disabled by default: only 2 fetch calls happen (executor + QA), no adversarial pass', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-test-or-key'
    const calls = installMockFetch([
      () => openRouterResponse('<<<FILE:out.txt>>>\nhello\n<<<ENDFILE>>>'),
      () => openRouterResponse('{"verdict":"pass","reason":"looks fine"}'),
    ])

    const dir = tmpDir()
    try {
      const task = baseTask()
      const result = await callRunTask(task, dir, false)
      expect(result.status).toBe('done')
      expect(calls.length).toBe(2)
      const { getRun } = await import('../db/runs.ts')
      const row = getRun(result.runId)!
      expect(row.adversarial_verdict).toBeNull()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('REFUTED downgrades the QA pass to fail and reuses the same retry path (no separate retry budget)', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-test-or-key'
    installMockFetch([
      () => openRouterResponse('<<<FILE:out.txt>>>\nhello\n<<<ENDFILE>>>'),
      () => openRouterResponse('{"verdict":"pass","reason":"looks fine"}'),
      () =>
        openRouterResponse(
          '{"verdict":"REFUTED","reason":"the excerpt is dead code, never executed"}',
        ),
    ])

    const dir = tmpDir()
    try {
      const task = baseTask()
      const result = await callRunTask(task, dir, true)
      expect(result.status).toBe('retry')
      const { getRun } = await import('../db/runs.ts')
      const row = getRun(result.runId)!
      expect(row.qa_verdict).toBe('fail')
      expect(row.qa_reason).toContain('adversarial re-review REFUTED')
      expect(row.qa_reason).toContain('dead code')
      expect(row.adversarial_verdict).toBe('REFUTED')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('CAVEATS does not block — task still succeeds, verdict persisted for a human to see', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-test-or-key'
    installMockFetch([
      () => openRouterResponse('<<<FILE:out.txt>>>\nhello\n<<<ENDFILE>>>'),
      () => openRouterResponse('{"verdict":"pass","reason":"looks fine"}'),
      () => openRouterResponse('{"verdict":"CAVEATS","reason":"plausible but evidence is thin"}'),
    ])

    const dir = tmpDir()
    try {
      const task = baseTask()
      const result = await callRunTask(task, dir, true)
      expect(result.status).toBe('done')
      const { getRun } = await import('../db/runs.ts')
      const row = getRun(result.runId)!
      expect(row.qa_verdict).toBe('pass')
      expect(row.status).toBe('done')
      expect(row.adversarial_verdict).toBe('CAVEATS')
      expect(row.adversarial_reason).toContain('plausible but evidence is thin')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('VERIFIED succeeds normally and persists the verdict', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-test-or-key'
    installMockFetch([
      () => openRouterResponse('<<<FILE:out.txt>>>\nhello\n<<<ENDFILE>>>'),
      () => openRouterResponse('{"verdict":"pass","reason":"looks fine"}'),
      () => openRouterResponse('{"verdict":"VERIFIED","reason":"independently confirmed"}'),
    ])

    const dir = tmpDir()
    try {
      const task = baseTask()
      const result = await callRunTask(task, dir, true)
      expect(result.status).toBe('done')
      const { getRun } = await import('../db/runs.ts')
      const row = getRun(result.runId)!
      expect(row.adversarial_verdict).toBe('VERIFIED')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('does not run the adversarial pass when the normal QA already failed', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-test-or-key'
    const calls = installMockFetch([
      () => openRouterResponse('<<<FILE:out.txt>>>\nhello\n<<<ENDFILE>>>'),
      () => openRouterResponse('{"verdict":"fail","reason":"qa fail test reason"}'),
    ])

    const dir = tmpDir()
    try {
      const task = baseTask()
      const result = await callRunTask(task, dir, true)
      expect(result.status).toMatch(/^(failed|retry)$/)
      expect(calls.length).toBe(2)
      const { getRun } = await import('../db/runs.ts')
      const row = getRun(result.runId)!
      expect(row.adversarial_verdict).toBeNull()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
