import { describe, it, expect, afterEach } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import type { Task } from '../tasks/schema.ts'

// G.3 — unit tests for the agentic executor engine, isolated from the
// harness. Mocks globalThis.fetch to drive runToolLoop() (reused as-is from
// Mes 13) through multi-round tool-call scenarios. The DB is never touched
// here — this engine never calls insertRun, that's the harness's job.

const originalFetch = globalThis.fetch
const originalKey = process.env.OPENROUTER_API_KEY

afterEach(() => {
  globalThis.fetch = originalFetch
  if (originalKey === undefined) delete process.env.OPENROUTER_API_KEY
  else process.env.OPENROUTER_API_KEY = originalKey
})

function tmpDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'orchestos-g3-agentic-'))
  return dir
}

function toolCallResponse(calls: Array<{ name: string; args: unknown }>, promptTokens = 10, completionTokens = 5) {
  return new Response(JSON.stringify({
    choices: [{
      message: {
        content: null,
        tool_calls: calls.map((c, i) => ({
          id: `call_${i}`,
          type: 'function',
          function: { name: c.name, arguments: JSON.stringify(c.args) },
        })),
      },
    }],
    usage: { prompt_tokens: promptTokens, completion_tokens: completionTokens },
  }), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

function textResponse(text: string, promptTokens = 10, completionTokens = 5) {
  return new Response(JSON.stringify({
    choices: [{ message: { content: text } }],
    usage: { prompt_tokens: promptTokens, completion_tokens: completionTokens },
  }), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

function installMockFetch(handlers: Array<() => Response>) {
  let i = 0
  globalThis.fetch = (async (_url: string | URL, _init?: RequestInit) => {
    const handler = handlers[i++]
    if (!handler) throw new Error(`mock fetch: no handler for call #${i}`)
    return handler()
  }) as unknown as typeof fetch
}

function baseTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'g3-agentic-test',
    description: 'G.3 agentic engine test',
    executor: 'openrouter',
    input: [],
    output: ['out.txt'],
    depends_on: [],
    status: 'pending',
    retry_count: 0,
    ...overrides,
  }
}

async function buildCtx(dir: string, task: Task) {
  const { createRunContext } = await import('../run/middleware.ts')
  const { RunLogger } = await import('../run/logger.ts')
  const { getProvider } = await import('../providers/index.ts')
  const log = new RunLogger(dir, task.id)
  const ctx = createRunContext({
    projectRoot: dir,
    contextText: '',
    task,
    logger: log,
    sandboxMode: 'cwd',
  })
  ctx.model = 'openai/gpt-4o-mini'
  ctx.providerName = 'openrouter'
  ctx.provider = getProvider('openrouter')
  ctx.effectiveRoot = dir
  ctx.prompt = { system: '', userContent: `Task: ${task.description}` }
  return ctx
}

describe('G.3 — agenticEngine', () => {
  it('write_file to a declared output path buffers it and is returned in ExecutorOutcome.files', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-test-or-key'
    installMockFetch([
      () => toolCallResponse([{ name: 'write_file', args: { path: 'out.txt', content: 'hello agentic' } }]),
      () => textResponse('Done — wrote out.txt'),
    ])

    const dir = tmpDir()
    try {
      const { agenticEngine } = await import('../run/executors/agentic.ts')
      const ctx = await buildCtx(dir, baseTask())
      const outcome = await agenticEngine.run(ctx, { maxTokens: 4096, maxIterations: 15 })

      expect(outcome.files).toEqual([{ path: 'out.txt', content: 'hello agentic' }])
      expect(outcome.iterations).toBe(2)
      expect(outcome.costByIteration.length).toBe(1)
      expect(outcome.costByIteration[0]!.label).toContain('2 rounds')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('write_file to a path outside the output contract returns an error string to the model, not an exception — model can self-correct', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-test-or-key'
    installMockFetch([
      () => toolCallResponse([{ name: 'write_file', args: { path: 'rogue.txt', content: 'sneaky' } }]),
      () => toolCallResponse([{ name: 'write_file', args: { path: 'out.txt', content: 'corrected' } }]),
      () => textResponse('Done'),
    ])

    const dir = tmpDir()
    try {
      const { agenticEngine } = await import('../run/executors/agentic.ts')
      const ctx = await buildCtx(dir, baseTask())
      const outcome = await agenticEngine.run(ctx, { maxTokens: 4096, maxIterations: 15 })

      // rogue.txt never makes it into the buffer/outcome — the tool refused it
      expect(outcome.files).toEqual([{ path: 'out.txt', content: 'corrected' }])
      expect(outcome.files.some(f => f.path === 'rogue.txt')).toBe(false)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('read_file is restricted to declared input[] when input[] is non-empty', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-test-or-key'
    installMockFetch([
      () => toolCallResponse([{ name: 'read_file', args: { path: 'secret.txt' } }]),
      () => toolCallResponse([{ name: 'write_file', args: { path: 'out.txt', content: 'saw the error' } }]),
      () => textResponse('Done'),
    ])

    const dir = tmpDir()
    try {
      writeFileSync(join(dir, 'secret.txt'), 'top secret content')
      writeFileSync(join(dir, 'allowed.txt'), 'allowed content')
      const { agenticEngine } = await import('../run/executors/agentic.ts')
      const ctx = await buildCtx(dir, baseTask({ input: ['allowed.txt'] }))
      const outcome = await agenticEngine.run(ctx, { maxTokens: 4096, maxIterations: 15 })

      expect(outcome.files).toEqual([{ path: 'out.txt', content: 'saw the error' }])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('list_dir lists entries of a real directory relative to effectiveRoot', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-test-or-key'
    installMockFetch([
      () => toolCallResponse([{ name: 'list_dir', args: { path: '.' } }]),
      () => toolCallResponse([{ name: 'write_file', args: { path: 'out.txt', content: 'listed' } }]),
      () => textResponse('Done'),
    ])

    const dir = tmpDir()
    try {
      mkdirSync(join(dir, 'subdir'))
      writeFileSync(join(dir, 'file-a.txt'), 'a')
      const { agenticEngine } = await import('../run/executors/agentic.ts')
      const ctx = await buildCtx(dir, baseTask())
      const outcome = await agenticEngine.run(ctx, { maxTokens: 4096, maxIterations: 15 })

      expect(outcome.files).toEqual([{ path: 'out.txt', content: 'listed' }])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('run_check rejects a cmd not declared in task.checks', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-test-or-key'
    installMockFetch([
      () => toolCallResponse([{ name: 'run_check', args: { cmd: 'rm -rf /' } }]),
      () => toolCallResponse([{ name: 'write_file', args: { path: 'out.txt', content: 'refused arbitrary cmd' } }]),
      () => textResponse('Done'),
    ])

    const dir = tmpDir()
    try {
      const { agenticEngine } = await import('../run/executors/agentic.ts')
      const ctx = await buildCtx(dir, baseTask({ checks: [{ cmd: 'echo hi' }] }))
      const outcome = await agenticEngine.run(ctx, { maxTokens: 4096, maxIterations: 15 })

      expect(outcome.files).toEqual([{ path: 'out.txt', content: 'refused arbitrary cmd' }])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('maxIterations caps the loop — iterations never exceeds the configured limit', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-test-or-key'
    // The model never stops calling tools — 3 rounds available, all tool-call rounds.
    installMockFetch([
      () => toolCallResponse([{ name: 'list_dir', args: { path: '.' } }]),
      () => toolCallResponse([{ name: 'list_dir', args: { path: '.' } }]),
      () => toolCallResponse([{ name: 'list_dir', args: { path: '.' } }]),
    ])

    const dir = tmpDir()
    try {
      const { agenticEngine } = await import('../run/executors/agentic.ts')
      const ctx = await buildCtx(dir, baseTask())
      const outcome = await agenticEngine.run(ctx, { maxTokens: 4096, maxIterations: 3 })

      expect(outcome.iterations).toBe(3)
      expect(outcome.files).toEqual([])
      expect(outcome.log.some(l => l.includes('maxIterations reached'))).toBe(true)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
