import { describe, it, expect, afterEach } from 'bun:test'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { createRunContext, createChain } from '../../src/run/middleware.ts'
import { memoryFetch } from '../../src/run/middlewares/memory-fetch.ts'
import { RunLogger } from '../../src/run/logger.ts'
import type { Task } from '../../src/tasks/schema.ts'
import type { HarnessOpts } from '../../src/run/harness.ts'

const tmpRoots: string[] = []

afterEach(() => {
  for (const d of tmpRoots.splice(0)) {
    try { rmSync(d, { recursive: true, force: true }) } catch {}
  }
})

function makeOpts(
  root: string,
  overrides?: { projectId?: string; input?: string[] },
): HarnessOpts {
  const task: Task = {
    id: 'test-task',
    description: 'implement the foo feature',
    executor: 'openrouter',
    input: overrides?.input ?? [],
    output: ['out.txt'],
    depends_on: [],
    status: 'pending',
    retry_count: 0,
  }
  return {
    projectRoot: root,
    contextText: '# context',
    task,
    projectId: overrides?.projectId ?? 'test-project',
    logger: new RunLogger(root, 'test-task'),
  }
}

function makeTempDir(): string {
  const d = mkdtempSync(join(tmpdir(), 'memory-fetch-test-'))
  tmpRoots.push(d)
  return d
}

describe('memoryFetch middleware', () => {
  it('skips when task.input is already populated', async () => {
    const root = makeTempDir()
    const ctx = createRunContext(makeOpts(root, { input: ['src/main.ts'] }))

    await memoryFetch(ctx, async () => {})

    expect(ctx.task.input).toEqual(['src/main.ts'])
    expect(ctx.embedHits).toBe(0)
  })

  it('skips when projectId is not set', async () => {
    const root = makeTempDir()
    const ctx = createRunContext(makeOpts(root, { projectId: undefined }))

    await memoryFetch(ctx, async () => {})

    expect(ctx.task.input).toEqual([])
    expect(ctx.embedHits).toBe(0)
  })

  it('works within createChain pipeline', async () => {
    const root = makeTempDir()
    const ctx = createRunContext(makeOpts(root))

    const chain = createChain<typeof ctx>()
    chain.use(memoryFetch)
    await chain.run(ctx)

    // suggestContext with no DB returns empty — task.input stays empty
    expect(ctx.task.input).toEqual([])
  })

  it('calls next() to continue chain', async () => {
    const root = makeTempDir()
    const ctx = createRunContext(makeOpts(root, { input: ['src/main.ts'] }))

    let afterMiddleware = false
    const chain = createChain<typeof ctx>()

    chain.use(memoryFetch)
    chain.use(async (_ctx, next) => {
      afterMiddleware = true
      await next()
    })

    await chain.run(ctx)

    expect(afterMiddleware).toBe(true)
  })
})
