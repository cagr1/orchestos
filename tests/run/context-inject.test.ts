import { describe, it, expect, afterEach } from 'bun:test'
import { mkdtempSync, writeFileSync, existsSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { createRunContext, createChain } from '../../src/run/middleware.ts'
import { contextInject } from '../../src/run/middlewares/context-inject.ts'
import { RunLogger } from '../../src/run/logger.ts'
import type { Task } from '../../src/tasks/schema.ts'
import type { HarnessOpts } from '../../src/run/harness.ts'

const tmpRoots: string[] = []

afterEach(() => {
  for (const d of tmpRoots.splice(0)) {
    try { rmSync(d, { recursive: true, force: true }) } catch {}
  }
})

function makeOpts(root: string, contextText: string): HarnessOpts {
  const task: Task = {
    id: 'test-task',
    description: 'test description',
    executor: 'openrouter',
    input: [],
    output: ['out.txt'],
    depends_on: [],
    status: 'pending',
    retry_count: 0,
  }
  return {
    projectRoot: root,
    contextText,
    task,
    logger: new RunLogger(root, 'test-task'),
  }
}

function makeTempDir(): string {
  const d = mkdtempSync(join(tmpdir(), 'context-inject-test-'))
  tmpRoots.push(d)
  return d
}

describe('contextInject middleware', () => {
  it('uses AGENTS.md when CONTEXT.md does not exist', async () => {
    const root = makeTempDir()
    const agentsText = '# AGENTS.md content'
    const ctx = createRunContext(makeOpts(root, agentsText))

    const chain = createChain<typeof ctx>()
    chain.use(contextInject)

    let nextCalled = false
    const wrappedMiddleware = async (c: typeof ctx, next: () => Promise<void>) => {
      await contextInject(c, next)
      nextCalled = true
    }

    await wrappedMiddleware(ctx, async () => {})

    expect(ctx.effectiveContext).toBe(agentsText)
    expect(ctx.contextSource).toBe('AGENTS.md')
    expect(ctx.contextTokens).toBe(Math.round(agentsText.length / 4))
    expect(nextCalled).toBe(true)
  })

  it('uses CONTEXT.md when it exists on disk', async () => {
    const root = makeTempDir()
    const agentsText = '# AGENTS.md content'
    const contextMdContent = '# CONTEXT.md override'

    writeFileSync(join(root, 'CONTEXT.md'), contextMdContent, 'utf-8')

    const ctx = createRunContext(makeOpts(root, agentsText))

    let nextCalled = false
    const wrappedMiddleware = async (c: typeof ctx, next: () => Promise<void>) => {
      await contextInject(c, next)
      nextCalled = true
    }

    await wrappedMiddleware(ctx, async () => {})

    expect(ctx.effectiveContext).toBe(contextMdContent)
    expect(ctx.contextSource).toBe('CONTEXT.md')
    expect(ctx.contextTokens).toBe(Math.round(contextMdContent.length / 4))
    expect(nextCalled).toBe(true)
  })

  it('preserves AGENTS.md when CONTEXT.md is empty', async () => {
    const root = makeTempDir()
    const agentsText = '# AGENTS.md content'

    writeFileSync(join(root, 'CONTEXT.md'), '', 'utf-8')

    const ctx = createRunContext(makeOpts(root, agentsText))

    await contextInject(ctx, async () => {})

    expect(ctx.effectiveContext).toBe('')
    expect(ctx.contextSource).toBe('CONTEXT.md')
  })

  it('works within createChain pipeline', async () => {
    const root = makeTempDir()
    const contextMdContent = '# Chain CONTEXT.md'
    writeFileSync(join(root, 'CONTEXT.md'), contextMdContent, 'utf-8')

    const ctx = createRunContext(makeOpts(root, '# AGENTS.md'))
    const chain = createChain<typeof ctx>()

    chain.use(contextInject)

    await chain.run(ctx)

    expect(ctx.effectiveContext).toBe(contextMdContent)
    expect(ctx.contextSource).toBe('CONTEXT.md')
  })

  it('calls next() to continue chain', async () => {
    const root = makeTempDir()
    const ctx = createRunContext(makeOpts(root, '# AGENTS.md'))

    let afterMiddleware = false
    const chain = createChain<typeof ctx>()

    chain.use(contextInject)
    chain.use(async (_ctx, next) => {
      afterMiddleware = true
      await next()
    })

    await chain.run(ctx)

    expect(afterMiddleware).toBe(true)
  })
})
