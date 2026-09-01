import { afterEach, describe, expect, test } from 'bun:test'
import { existsSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { RunContext } from '../run/middleware.ts'
import { skillRoute } from '../run/middlewares/skill-route.ts'
import { buildPrompt } from '../run/prompt.ts'
import type { Task } from '../tasks/schema.ts'

// N.4.5 (Mes 25, 2026-07-31) — el runner propio de OrchestOS (skill-route.ts
// middleware + prompt.ts fallback) inyectaba skill.instructions crudo,
// duplicado en 2 sitios, y nunca pasaba por buildSections() — el iron_law de
// N.1-N.3 llegaba a Claude Code/Cursor/OpenAI (vía compile targets) pero
// jamás al ejecutor propio. Estos tests fijan un skill YAML real en disco
// (getSkillPath() lee de skills/) con iron_law y confirman que llega
// compilado a ambos sitios.

const TEST_SKILL_ID = 'n45-wiring-test-skill'
const TEST_SKILL_PATH = join(process.cwd(), 'skills', `${TEST_SKILL_ID}.yaml`)

function writeTestSkill() {
  writeFileSync(
    TEST_SKILL_PATH,
    `
id: ${TEST_SKILL_ID}
version: 1.0.0
name: N45 Wiring Test Skill
description: Test skill for N.4.5 runner wiring
instructions: Do the thing carefully.
targets: [claude]
iron_law: Never skip the test.
`.trimStart(),
    'utf-8',
  )
}

afterEach(() => {
  if (existsSync(TEST_SKILL_PATH)) rmSync(TEST_SKILL_PATH)
})

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    description: 'do the thing',
    executor: 'openrouter',
    input: [],
    output: ['out.txt'],
    depends_on: [],
    status: 'pending',
    retry_count: 0,
    ...overrides,
  }
}

describe('skillRoute middleware — compiles through buildSections (N.4.5)', () => {
  test('iron_law reaches ctx.skillInstructions', async () => {
    writeTestSkill()
    const ctx = { task: makeTask({ skill: TEST_SKILL_ID }), skillInstructions: '' } as RunContext
    await skillRoute(ctx, async () => {})
    expect(ctx.skillInstructions).toContain('## Iron law')
    expect(ctx.skillInstructions).toContain('Never skip the test.')
    expect(ctx.skillInstructions).toContain('Do the thing carefully.')
  })

  test('no skill leaves skillInstructions untouched', async () => {
    const ctx = { task: makeTask(), skillInstructions: '' } as RunContext
    await skillRoute(ctx, async () => {})
    expect(ctx.skillInstructions).toBe('')
  })
})

describe('buildPrompt fallback (loadSkillGuidelines) — compiles through buildSections (N.4.5)', () => {
  test('iron_law reaches the compiled system prompt when skillGuidelines is not passed', () => {
    writeTestSkill()
    const { system } = buildPrompt(makeTask({ skill: TEST_SKILL_ID }), '# context', '/tmp')
    expect(system).toContain('## Iron law')
    expect(system).toContain('Never skip the test.')
  })
})
