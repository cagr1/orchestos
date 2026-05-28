/**
 * S23.3 — Tests for S23.1 (function-calling planner) + S23.2 (YAML fallback)
 */
import { describe, it, expect } from 'bun:test'
import {
  planWithFunctionCalling,
  generatePlan,
  createPlan,
  parsePlan,
  CREATE_SUBTASK_TOOL,
  PlanParseError,
} from '../agents/planner.ts'
import { supportsToolCalling } from '../providers/tool-call.ts'
import type { ToolCallResponse } from '../providers/tool-call.ts'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeToolCall(input: Record<string, unknown>): ToolCallResponse {
  return {
    calls: [{ toolName: 'create_subtask', input }],
    inputTokens: 10,
    outputTokens: 20,
  }
}

function makeMultiToolCall(inputs: Record<string, unknown>[]): ToolCallResponse {
  return {
    calls: inputs.map(input => ({ toolName: 'create_subtask', input })),
    inputTokens: 20,
    outputTokens: 40,
  }
}

const VALID_SUBTASK = {
  id:            'write-greeting',
  description:   'Write a greeting file',
  acceptance:    ['greeting.txt exists and contains Hello'],
  depends_on:    [],
  allowed_tools: ['write'],
  output:        ['greeting.txt'],
}

// ---------------------------------------------------------------------------
// CREATE_SUBTASK_TOOL schema
// ---------------------------------------------------------------------------

describe('CREATE_SUBTASK_TOOL', () => {
  it('has name create_subtask', () => {
    expect(CREATE_SUBTASK_TOOL.name).toBe('create_subtask')
  })

  it('requires id, description, acceptance, depends_on, allowed_tools', () => {
    const required = CREATE_SUBTASK_TOOL.input_schema.required ?? []
    expect(required).toContain('id')
    expect(required).toContain('description')
    expect(required).toContain('acceptance')
    expect(required).toContain('depends_on')
    expect(required).toContain('allowed_tools')
  })

  it('id property has kebab-case pattern', () => {
    const idProp = CREATE_SUBTASK_TOOL.input_schema.properties['id'] as Record<string, unknown>
    expect(idProp.pattern).toBeTruthy()
  })

  it('allowed_tools items include all VALID_TOOLS', () => {
    const toolsProp = CREATE_SUBTASK_TOOL.input_schema.properties['allowed_tools'] as Record<string, unknown>
    const items = toolsProp.items as Record<string, unknown>
    const enumValues = items.enum as string[]
    expect(enumValues).toContain('read')
    expect(enumValues).toContain('write')
    expect(enumValues).toContain('edit')
    expect(enumValues).toContain('bash')
    expect(enumValues).toContain('git')
  })
})

// ---------------------------------------------------------------------------
// supportsToolCalling (S23.2 detection)
// ---------------------------------------------------------------------------

describe('supportsToolCalling', () => {
  it('returns true for anthropic', () => {
    expect(supportsToolCalling('anthropic', 'claude-3-haiku')).toBe(true)
  })

  it('returns true for openai', () => {
    expect(supportsToolCalling('openai', 'gpt-4o')).toBe(true)
  })

  it('returns true for openrouter with anthropic/ model', () => {
    expect(supportsToolCalling('openrouter', 'anthropic/claude-3-haiku')).toBe(true)
  })

  it('returns true for openrouter with openai/ model', () => {
    expect(supportsToolCalling('openrouter', 'openai/gpt-4o-mini')).toBe(true)
  })

  it('returns true for openrouter with google/gemini model', () => {
    expect(supportsToolCalling('openrouter', 'google/gemini-2.5-flash')).toBe(true)
  })

  it('returns false for openrouter with deepseek model', () => {
    expect(supportsToolCalling('openrouter', 'deepseek/deepseek-v4-flash')).toBe(false)
  })

  it('returns false for codex', () => {
    expect(supportsToolCalling('codex', 'codex')).toBe(false)
  })

  it('returns false for unknown provider', () => {
    expect(supportsToolCalling('unknown', 'some-model')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// S23.1 — planWithFunctionCalling
// ---------------------------------------------------------------------------

describe('planWithFunctionCalling — happy path', () => {
  it('3-subtask linear plan produces SubTask[] in topo order', async () => {
    const callWithToolsMock = async () => makeMultiToolCall([
      {
        id: 'task-a', description: 'First', acceptance: ['a done'],
        depends_on: [], allowed_tools: ['write'], output: ['a.txt'],
      },
      {
        id: 'task-b', description: 'Second', acceptance: ['b done'],
        depends_on: ['task-a'], allowed_tools: ['write'], output: ['b.txt'],
      },
      {
        id: 'task-c', description: 'Third', acceptance: ['c done'],
        depends_on: ['task-b'], allowed_tools: ['read', 'write'], output: ['c.txt'],
      },
    ])

    const plan = await planWithFunctionCalling(
      'Do A then B then C',
      'parent-task',
      { provider: 'anthropic', model: 'claude-3-haiku' },
      { callWithTools: callWithToolsMock },
    )

    expect(plan.map(t => t.id)).toEqual(['task-a', 'task-b', 'task-c'])
    expect(plan[0]?.status).toBe('pending')
  })

  it('single sub-task with topic_key (no output) is valid', async () => {
    const callWithToolsMock = async () => makeToolCall({
      id: 'write-mem', description: 'Write memory', acceptance: ['memory written'],
      depends_on: [], allowed_tools: ['write'], topic_key: 'my-key',
    })

    const plan = await planWithFunctionCalling(
      'Remember something',
      'p',
      { provider: 'anthropic', model: 'claude-3-haiku' },
      { callWithTools: callWithToolsMock },
    )

    expect(plan).toHaveLength(1)
    expect(plan[0]?.topic_key).toBe('my-key')
  })

  it('non-linear DAG (A→B, A→C) sorts A first', async () => {
    const callWithToolsMock = async () => makeMultiToolCall([
      {
        id: 'task-b', description: 'B', acceptance: ['b'],
        depends_on: ['task-a'], allowed_tools: ['write'], output: ['b.txt'],
      },
      {
        id: 'task-a', description: 'A', acceptance: ['a'],
        depends_on: [], allowed_tools: ['write'], output: ['a.txt'],
      },
      {
        id: 'task-c', description: 'C', acceptance: ['c'],
        depends_on: ['task-a'], allowed_tools: ['write'], output: ['c.txt'],
      },
    ])

    const plan = await planWithFunctionCalling('A then B and C', 'p', { provider: 'anthropic', model: 'claude-3-haiku' }, { callWithTools: callWithToolsMock })
    expect(plan[0]?.id).toBe('task-a')
    expect(plan.map(t => t.id)).toContain('task-b')
    expect(plan.map(t => t.id)).toContain('task-c')
  })
})

describe('planWithFunctionCalling — error cases', () => {
  it('throws PlanParseError when planner returns no create_subtask calls', async () => {
    const callWithToolsMock = async (): Promise<ToolCallResponse> => ({
      calls: [], inputTokens: 0, outputTokens: 0,
    })
    await expect(
      planWithFunctionCalling('task', 'p', { provider: 'anthropic', model: 'x' }, { callWithTools: callWithToolsMock })
    ).rejects.toBeInstanceOf(PlanParseError)
  })

  it('throws PlanParseError with field info when schema validation fails', async () => {
    const callWithToolsMock = async () => makeToolCall({
      id: 'INVALID ID',          // uppercase — fails kebab validation
      description: 'test',
      acceptance: ['x'],
      depends_on: [],
      allowed_tools: ['write'],
      output: ['a.txt'],
    })
    let err: Error | null = null
    try {
      await planWithFunctionCalling('task', 'p', { provider: 'anthropic', model: 'x' }, { callWithTools: callWithToolsMock })
    } catch (e) { err = e as Error }

    expect(err).toBeInstanceOf(PlanParseError)
    expect(err!.message).toMatch(/id/)
  })

  it('throws PlanParseError when depends_on references unknown id', async () => {
    const callWithToolsMock = async () => makeToolCall({
      id: 'task-a', description: 'test', acceptance: ['x'],
      depends_on: ['non-existent'], allowed_tools: ['write'], output: ['a.txt'],
    })
    await expect(
      planWithFunctionCalling('task', 'p', { provider: 'anthropic', model: 'x' }, { callWithTools: callWithToolsMock })
    ).rejects.toBeInstanceOf(PlanParseError)
  })

  it('throws PlanParseError on duplicate ids', async () => {
    const callWithToolsMock = async () => makeMultiToolCall([
      { id: 'dup', description: 'A', acceptance: ['a'], depends_on: [], allowed_tools: ['write'], output: ['a.txt'] },
      { id: 'dup', description: 'B', acceptance: ['b'], depends_on: [], allowed_tools: ['write'], output: ['b.txt'] },
    ])
    await expect(
      planWithFunctionCalling('task', 'p', { provider: 'anthropic', model: 'x' }, { callWithTools: callWithToolsMock })
    ).rejects.toBeInstanceOf(PlanParseError)
  })

  it('wraps callWithTools network error in PlanParseError', async () => {
    const callWithToolsMock = async (): Promise<ToolCallResponse> => {
      throw new Error('network timeout')
    }
    await expect(
      planWithFunctionCalling('task', 'p', { provider: 'anthropic', model: 'x' }, { callWithTools: callWithToolsMock })
    ).rejects.toBeInstanceOf(PlanParseError)
  })
})

// ---------------------------------------------------------------------------
// S23.2 — generatePlan (auto-detect)
// ---------------------------------------------------------------------------

describe('generatePlan — function calling path', () => {
  it('uses function calling for anthropic provider', async () => {
    let wasCalled = false
    const callWithToolsMock = async () => {
      wasCalled = true
      return makeToolCall({ ...VALID_SUBTASK })
    }
    await generatePlan('Write a greeting', 'p', { provider: 'anthropic', model: 'claude-3-haiku' }, { callWithTools: callWithToolsMock })
    expect(wasCalled).toBe(true)
  })
})

describe('generatePlan — YAML fallback path', () => {
  it('YAML fallback still works via createPlan', () => {
    const yaml = `
version: 1
parent_task_id: test
sub_tasks:
  - id: write-greeting
    description: Write greeting
    acceptance: ['file exists']
    depends_on: []
    allowed_tools: [write]
    output: [greeting.txt]
`
    const plan = createPlan(yaml)
    expect(plan).toHaveLength(1)
    expect(plan[0]?.id).toBe('write-greeting')
  })

  it('parsePlan throws PlanParseError on invalid YAML', () => {
    expect(() => parsePlan('{{{')).toThrow(PlanParseError)
  })

  it('parsePlan throws PlanParseError when acceptance is empty', () => {
    const yaml = `
version: 1
parent_task_id: p
sub_tasks:
  - id: task-a
    description: test
    acceptance: []
    depends_on: []
    allowed_tools: [write]
    output: [a.txt]
`
    expect(() => parsePlan(yaml)).toThrow(PlanParseError)
  })
})
