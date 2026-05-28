/**
 * S26.2 — Tests for LLM memory conflict judge
 */
import { describe, it, expect, mock } from 'bun:test'

mock.module('../providers/openrouter.ts', () => ({
  chat: mock(async () => ({
    text: JSON.stringify({
      relation: 'conflict_with',
      confidence: 'high',
      explanation: 'Entry A says use port 3000, Entry B says use port 4000.',
    }),
    inputTokens: 80,
    outputTokens: 40,
    model: 'anthropic/claude-3-haiku',
  })),
}))

const { judgeConflict } = await import('../memory/judge.ts')

describe('judgeConflict', () => {
  it('returns ConflictJudgment with relation and confidence', async () => {
    const result = await judgeConflict(
      { topicKey: 'server-config', content: 'The server runs on port 3000.' },
      { topicKey: 'server-config', content: 'The server runs on port 4000.' },
    )
    expect(result).toBeDefined()
    expect(result.relation).toBe('conflict_with')
    expect(result.confidence).toBe('high')
    expect(result.explanation).toBeTruthy()
  })

  it('accepts optional model override', async () => {
    const result = await judgeConflict(
      { topicKey: 'a', content: 'X' },
      { topicKey: 'b', content: 'Y' },
      'anthropic/claude-sonnet-4-20250514',
    )
    expect(result.relation).toBe('conflict_with')
  })

  it('all 6 relation values are valid', async () => {
    const relations = [
      'conflict_with', 'supersedes', 'compatible',
      'scoped', 'related', 'not_conflict',
    ] as const
    for (const r of relations) {
      expect(r).toMatch(/^(conflict_with|supersedes|compatible|scoped|related|not_conflict)$/)
    }
  })
})

describe('judgeConflict — fallback on bad JSON', () => {
  it('returns not_conflict/low when LLM returns prose', async () => {
    mock.module('../providers/openrouter.ts', () => ({
      chat: mock(async () => ({
        text: 'These two entries look fine to me, no conflict at all.',
        inputTokens: 50,
        outputTokens: 10,
        model: 'anthropic/claude-3-haiku',
      })),
    }))

    const { judgeConflict: jc2 } = await import('../memory/judge.ts')
    const result = await jc2(
      { topicKey: 'a', content: 'X' },
      { topicKey: 'b', content: 'Y' },
    )
    expect(result.relation).toBe('not_conflict')
    expect(result.confidence).toBe('low')
    expect(result.explanation).toContain('unparseable')
  })

  it('returns not_conflict/low when LLM returns garbage', async () => {
    mock.module('../providers/openrouter.ts', () => ({
      chat: mock(async () => ({
        text: '!!! NOT JSON !!! {{broken',
        inputTokens: 50,
        outputTokens: 10,
        model: 'anthropic/claude-3-haiku',
      })),
    }))

    const { judgeConflict: jc3 } = await import('../memory/judge.ts')
    const result = await jc3(
      { topicKey: 'a', content: 'X' },
      { topicKey: 'b', content: 'Y' },
    )
    expect(result.relation).toBe('not_conflict')
    expect(result.confidence).toBe('low')
  })

  it('returns not_conflict/low when LLM returns valid JSON with invalid relation', async () => {
    mock.module('../providers/openrouter.ts', () => ({
      chat: mock(async () => ({
        text: JSON.stringify({
          relation: 'invalid_relation_value',
          confidence: 'high',
          explanation: 'test',
        }),
        inputTokens: 50,
        outputTokens: 10,
        model: 'anthropic/claude-3-haiku',
      })),
    }))

    const { judgeConflict: jc4 } = await import('../memory/judge.ts')
    const result = await jc4(
      { topicKey: 'a', content: 'X' },
      { topicKey: 'b', content: 'Y' },
    )
    expect(result.relation).toBe('not_conflict')
  })
})
