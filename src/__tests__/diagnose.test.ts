/**
 * S25.4 — Tests for S25.1/S25.2: agente de diagnóstico de fallos
 */
import { describe, it, expect, mock } from 'bun:test'

const mockRuns: any[] = [
  {
    id: 'run-1', task_id: 't1-fail', status: 'failed', created_at: '2026-05-28T10:00:00Z',
    prompt: 'Do something', task_class: 'implement', model: 'gpt-4o', provider: 'openai',
    input_tokens: 500, output_tokens: 200, usd_cost: 0.005, elapsed_ms: 15000,
    qa_verdict: 'fail', qa_reason: 'Missing error handling for edge case null input',
    result: 'QA fail - reverted 2 file(s)', checks_json: null,
    allowed_outputs: null, files_attempted: null, files_authorized: null, files_blocked: null,
    snapshot_before: null, snapshot_after: null, skill_id: null, embed_hits: null,
    constitution_rules: null, context_source: null, context_tokens: null,
  },
  {
    id: 'run-2', task_id: 't1-fail', status: 'failed', created_at: '2026-05-28T09:55:00Z',
    prompt: 'Do something', task_class: 'implement', model: 'gpt-4o', provider: 'openai',
    input_tokens: 480, output_tokens: 210, usd_cost: 0.005, elapsed_ms: 14000,
    qa_verdict: 'fail', qa_reason: 'Same issue - null input not handled',
    result: 'QA fail - reverted 2 file(s)', checks_json: null,
    allowed_outputs: null, files_attempted: null, files_authorized: null, files_blocked: null,
    snapshot_before: null, snapshot_after: null, skill_id: null, embed_hits: null,
    constitution_rules: null, context_source: null, context_tokens: null,
  },
  {
    id: 'run-3', task_id: 't1-fail', status: 'failed', created_at: '2026-05-28T09:50:00Z',
    prompt: 'Do something', task_class: 'implement', model: 'gpt-4o', provider: 'openai',
    input_tokens: 510, output_tokens: 190, usd_cost: 0.005, elapsed_ms: 16000,
    qa_verdict: 'fail', qa_reason: 'Null input edge case',
    result: 'QA fail - reverted 2 file(s)', checks_json: null,
    allowed_outputs: null, files_attempted: null, files_authorized: null, files_blocked: null,
    snapshot_before: null, snapshot_after: null, skill_id: null, embed_hits: null,
    constitution_rules: null, context_source: null, context_tokens: null,
  },
]

mock.module('../providers/openrouter.ts', () => ({
  chat: mock(async () => ({
    text: JSON.stringify({
      pattern: 'qa_specific_criterion',
      confidence: 'high',
      suggestion: 'Add a check or acceptance criterion for null input handling.',
      details: 'All 3 runs failed QA with the same reason about null input.',
    }),
    inputTokens: 100,
    outputTokens: 50,
    model: 'anthropic/claude-3-haiku',
  })),
}))

mock.module('../tasks/loader.ts', () => ({
  loadTasks: mock(() => ({
    version: 1,
    project: 'test-project',
    tasks: [
      {
        id: 't1-fail', description: 'Implement feature with edge cases',
        executor: 'openrouter', input: [], output: ['src/feature.ts'],
        depends_on: [], status: 'failed_permanent', retry_count: 3,
        skill: 'implement',
      },
      {
        id: 't2-ok', description: 'Simple task',
        executor: 'openrouter', input: [], output: ['src/simple.ts'],
        depends_on: [], status: 'done', retry_count: 0,
      },
    ],
  })),
  tasksExist: mock(() => true),
  tasksPath: mock(() => '/fake/path/tasks.yaml'),
}))

mock.module('../db/runs.ts', () => ({
  listRunsByTaskId: mock((taskId: string) => {
    if (taskId === 't1-fail') return mockRuns
    return []
  }),
}))

const { diagnoseTask } = await import('../agents/diagnose.ts')

describe('diagnoseTask', () => {
  it('returns DiagnoseResult with pattern and suggestion', async () => {
    const result = await diagnoseTask('t1-fail', '/fake/root')
    expect(result).toBeDefined()
    expect(result.taskId).toBe('t1-fail')
    expect(result.pattern).toBe('qa_specific_criterion')
    expect(result.confidence).toBe('high')
    expect(result.suggestion).toContain('null input')
    expect(result.details).toBeTruthy()
  })

  it('throws when task is not found', async () => {
    expect(diagnoseTask('nonexistent', '/fake/root')).rejects.toThrow(/not found/)
  })

  it('throws when no runs exist for the task', async () => {
    expect(diagnoseTask('t2-ok', '/fake/root')).rejects.toThrow(/No runs found/)
  })
})

describe('FailurePattern type', () => {
  it('has all expected patterns', () => {
    const patterns = [
      'deterministic_check', 'qa_specific_criterion', 'parse_error',
      'rate_limit', 'scope_creep', 'unknown',
    ]
    for (const p of patterns) {
      expect(p).toMatch(/^(deterministic_check|qa_specific_criterion|parse_error|rate_limit|scope_creep|unknown)$/)
    }
  })
})

describe('diagnoseTask - fallback on bad JSON', () => {
  it('returns unknown pattern when LLM returns bad JSON', async () => {
    mock.module('../providers/openrouter.ts', () => ({
      chat: mock(async () => ({
        text: 'This is not valid JSON at all',
        inputTokens: 50,
        outputTokens: 10,
        model: 'anthropic/claude-3-haiku',
      })),
    }))

    const { diagnoseTask: dt2 } = await import('../agents/diagnose.ts')
    const result = await dt2('t1-fail', '/fake/root')
    expect(result.pattern).toBe('unknown')
    expect(result.confidence).toBe('low')
    expect(result.suggestion).toContain('manually')
  })
})
