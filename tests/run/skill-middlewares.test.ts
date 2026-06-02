import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { createRunContext, createChain } from '../../src/run/middleware.ts'
import { RunLogger } from '../../src/run/logger.ts'
import type { Task } from '../../src/tasks/schema.ts'
import type { HarnessOpts } from '../../src/run/harness.ts'

let testDir: string
let originalCwd: string

beforeAll(() => {
  testDir = mkdtempSync(join(tmpdir(), 'skill-middlewares-test-'))
  mkdirSync(join(testDir, 'skills'), { recursive: true })
  originalCwd = process.cwd()
  process.chdir(testDir)
})

afterAll(() => {
  process.chdir(originalCwd)
  try { rmSync(testDir, { recursive: true, force: true }) } catch {}
})

function makeOpts(root: string, skill?: string): HarnessOpts {
  const task: Task = {
    id: 'test-task',
    description: 'test description',
    executor: 'openrouter',
    skill,
    input: [],
    output: ['out.txt'],
    depends_on: [],
    status: 'pending',
    retry_count: 0,
  }
  return {
    projectRoot: root,
    contextText: '',
    task,
    logger: new RunLogger(root, 'test-task'),
  }
}

function makeSkillFile(id: string, name: string, instructions: string, allowedTools?: string[]): void {
  const toolsYaml = allowedTools
    ? `\nallowed_tools:\n${allowedTools.map(t => `  - ${t}`).join('\n')}`
    : ''
  writeFileSync(
    join(testDir, 'skills', `${id}.yaml`),
    `id: ${id}
version: 1.0.0
name: ${name}
description: A test skill
instructions: ${instructions}
targets:
  - claude${toolsYaml}
`,
    'utf-8',
  )
}

import type { MiddlewareFn, RunContext } from '../../src/run/middleware.ts'

// Dynamically import middlewares AFTER cwd is set (registry.ts SKILLS_DIR depends on cwd)
let skillRoute: MiddlewareFn<RunContext>
let toolPolicy: MiddlewareFn<RunContext>

beforeAll(async () => {
  skillRoute = (await import('../../src/run/middlewares/skill-route.ts')).skillRoute
  toolPolicy = (await import('../../src/run/middlewares/tool-policy.ts')).toolPolicy
})

// ---------------------------------------------------------------------------
// skillRoute tests (S31.3)
// ---------------------------------------------------------------------------

describe('skillRoute middleware', () => {
  it('loads skill instructions when task has a skill', async () => {
    makeSkillFile('sr-skill', 'My Skill', 'Do the thing')
    const ctx = createRunContext(makeOpts(testDir, 'sr-skill'))

    await skillRoute(ctx, async () => {})

    expect(ctx.skillInstructions).toBe('\n## SKILL GUIDELINES: My Skill\nDo the thing\n')
  })

  it('leaves skillInstructions empty when task has no skill', async () => {
    const ctx = createRunContext(makeOpts(testDir))

    await skillRoute(ctx, async () => {})

    expect(ctx.skillInstructions).toBe('')
  })

  it('leaves skillInstructions empty when skill file does not exist', async () => {
    const ctx = createRunContext(makeOpts(testDir, 'nonexistent-skill'))

    await skillRoute(ctx, async () => {})

    expect(ctx.skillInstructions).toBe('')
  })

  it('works within createChain pipeline', async () => {
    makeSkillFile('sr-chain', 'Chain Skill', 'Chain instructions')
    const ctx = createRunContext(makeOpts(testDir, 'sr-chain'))
    const chain = createChain<typeof ctx>()

    chain.use(skillRoute)
    await chain.run(ctx)

    expect(ctx.skillInstructions).toContain('Chain Skill')
    expect(ctx.skillInstructions).toContain('Chain instructions')
  })

  it('calls next() to continue chain', async () => {
    const ctx = createRunContext(makeOpts(testDir))

    let afterMiddleware = false
    const chain = createChain<typeof ctx>()

    chain.use(skillRoute)
    chain.use(async (_ctx, next) => {
      afterMiddleware = true
      await next()
    })

    await chain.run(ctx)

    expect(afterMiddleware).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// toolPolicy tests (S31.5)
// ---------------------------------------------------------------------------

describe('toolPolicy middleware', () => {
  it('extracts allowed_tools from skill', async () => {
    makeSkillFile('tp-with-tools', 'WithTools', 'instr', ['read', 'write', 'bash'])
    const ctx = createRunContext(makeOpts(testDir, 'tp-with-tools'))

    await toolPolicy(ctx, async () => {})

    expect(ctx.allowedTools).toEqual(['read', 'write', 'bash'])
  })

  it('sets empty array when skill has no allowed_tools', async () => {
    makeSkillFile('tp-no-tools', 'NoTools', 'instr')
    const ctx = createRunContext(makeOpts(testDir, 'tp-no-tools'))

    await toolPolicy(ctx, async () => {})

    expect(ctx.allowedTools).toEqual([])
  })

  it('sets empty array when task has no skill', async () => {
    const ctx = createRunContext(makeOpts(testDir))

    await toolPolicy(ctx, async () => {})

    expect(ctx.allowedTools).toEqual([])
  })

  it('sets empty array when skill file does not exist', async () => {
    const ctx = createRunContext(makeOpts(testDir, 'nonexistent'))

    await toolPolicy(ctx, async () => {})

    expect(ctx.allowedTools).toEqual([])
  })

  it('works within createChain pipeline', async () => {
    makeSkillFile('tp-chain', 'ChainTool', 'instr', ['read'])
    const ctx = createRunContext(makeOpts(testDir, 'tp-chain'))
    const chain = createChain<typeof ctx>()

    chain.use(toolPolicy)
    await chain.run(ctx)

    expect(ctx.allowedTools).toEqual(['read'])
  })

  it('calls next() to continue chain', async () => {
    const ctx = createRunContext(makeOpts(testDir))

    let afterMiddleware = false
    const chain = createChain<typeof ctx>()

    chain.use(toolPolicy)
    chain.use(async (_ctx, next) => {
      afterMiddleware = true
      await next()
    })

    await chain.run(ctx)

    expect(afterMiddleware).toBe(true)
  })
})
