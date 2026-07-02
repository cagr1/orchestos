import { describe, it, expect, afterEach } from 'bun:test'
import { mkdtempSync, rmSync, readFileSync, readdirSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import type { Task } from '../tasks/schema.ts'
import type { OrcheConfig } from '../config/schema.ts'

// G.3 — engine resolution end-to-end through runTask(): task.engine wins over
// orcheConfig.executorEngine, default is 'single-shot' (zero behavior change
// for every existing task that doesn't opt in), and requesting 'agentic' with
// a model that doesn't support tool-calling falls back to single-shot with a
// logged warning instead of failing the task.

const originalFetch = globalThis.fetch
const originalKey = process.env.OPENROUTER_API_KEY

afterEach(() => {
  globalThis.fetch = originalFetch
  if (originalKey === undefined) delete process.env.OPENROUTER_API_KEY
  else process.env.OPENROUTER_API_KEY = originalKey
})

function tmpDir(): string {
  return mkdtempSync(join(tmpdir(), 'orchestos-g3-selection-'))
}

function toolCallResponse(calls: Array<{ name: string; args: unknown }>) {
  return new Response(JSON.stringify({
    choices: [{
      message: {
        content: null,
        tool_calls: calls.map((c, i) => ({
          id: `call_${i}`, type: 'function',
          function: { name: c.name, arguments: JSON.stringify(c.args) },
        })),
      },
    }],
    usage: { prompt_tokens: 10, completion_tokens: 5 },
  }), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

function plainResponse(content: string) {
  return new Response(JSON.stringify({
    choices: [{ message: { content } }],
    usage: { prompt_tokens: 5, completion_tokens: 3 },
  }), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

function installMockFetch(handlers: Array<() => Response>) {
  let i = 0
  globalThis.fetch = (async () => {
    const handler = handlers[i++]
    if (!handler) throw new Error(`mock fetch: no handler for call #${i}`)
    return handler()
  }) as unknown as typeof fetch
}

function baseTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'g3-selection-test',
    description: 'G.3 engine selection test',
    executor: 'openrouter',
    input: [],
    output: ['out.txt'],
    depends_on: [],
    status: 'pending',
    retry_count: 0,
    ...overrides,
  }
}

function latestLogContent(dir: string): string {
  const logsDir = join(dir, 'runs')
  const files = readdirSync(logsDir).filter(f => f.endsWith('.log'))
  const latest = files.sort().at(-1)!
  return readFileSync(join(logsDir, latest), 'utf-8')
}

async function callRunTask(task: Task, dir: string, opts: { orcheConfig?: OrcheConfig; modelOverride?: string } = {}) {
  const { runTask } = await import('../run/harness.ts')
  const { RunLogger } = await import('../run/logger.ts')
  const log = new RunLogger(dir, task.id)
  return runTask({
    projectRoot: dir,
    contextText: '',
    task,
    logger: log,
    sandboxMode: 'cwd',
    orcheConfig: opts.orcheConfig,
    modelOverride: opts.modelOverride,
  })
}

describe('G.3 — executor engine selection', () => {
  it('task.engine=agentic with a tool-calling-capable model runs the agentic engine and writes files via the contract', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-test-or-key'
    installMockFetch([
      () => toolCallResponse([{ name: 'write_file', args: { path: 'out.txt', content: 'agentic wrote this' } }]),
      () => plainResponse('Done — wrote out.txt'),
      () => plainResponse('{"verdict":"pass","reason":"looks good"}'),
    ])

    const dir = tmpDir()
    try {
      const task = baseTask({ engine: 'agentic' })
      const result = await callRunTask(task, dir, { modelOverride: 'anthropic/claude-haiku-4-5' })
      expect(result.status).toBe('done')
      expect(result.filesWritten).toEqual(['out.txt'])
      expect(readFileSync(join(dir, 'out.txt'), 'utf-8')).toBe('agentic wrote this')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('task.engine=agentic with a model that does not support tool-calling falls back to single-shot with a logged warning', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-test-or-key'
    installMockFetch([
      () => plainResponse('<<<FILE:out.txt>>>\nsingle-shot fallback content\n<<<ENDFILE>>>'),
      () => plainResponse('{"verdict":"pass","reason":"looks good"}'),
    ])

    const dir = tmpDir()
    try {
      const task = baseTask({ engine: 'agentic' })
      const result = await callRunTask(task, dir, { modelOverride: 'deepseek/deepseek-v4-flash' })
      expect(result.status).toBe('done')
      expect(readFileSync(join(dir, 'out.txt'), 'utf-8')).toBe('single-shot fallback content\n')
      expect(latestLogContent(dir)).toContain('falling back to single-shot')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('no task.engine and no orcheConfig.executorEngine defaults to single-shot (zero behavior change)', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-test-or-key'
    installMockFetch([
      () => plainResponse('<<<FILE:out.txt>>>\ndefault single-shot content\n<<<ENDFILE>>>'),
      () => plainResponse('{"verdict":"pass","reason":"looks good"}'),
    ])

    const dir = tmpDir()
    try {
      const task = baseTask()
      const result = await callRunTask(task, dir, { modelOverride: 'anthropic/claude-haiku-4-5' })
      expect(result.status).toBe('done')
      expect(readFileSync(join(dir, 'out.txt'), 'utf-8')).toBe('default single-shot content\n')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('orcheConfig.executorEngine=agentic applies as project-level default when the task does not declare its own engine', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-test-or-key'
    installMockFetch([
      () => toolCallResponse([{ name: 'write_file', args: { path: 'out.txt', content: 'project default agentic' } }]),
      () => plainResponse('Done'),
      () => plainResponse('{"verdict":"pass","reason":"looks good"}'),
    ])

    const dir = tmpDir()
    try {
      const task = baseTask({ executor_model: 'anthropic/claude-haiku-4-5' })
      const { DEFAULT_CONFIG } = await import('../config/schema.ts')
      const orcheConfig: OrcheConfig = { ...DEFAULT_CONFIG, executorEngine: 'agentic' }
      const result = await callRunTask(task, dir, { orcheConfig })
      expect(result.status).toBe('done')
      expect(readFileSync(join(dir, 'out.txt'), 'utf-8')).toBe('project default agentic')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
