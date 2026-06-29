/**
 * S26.2 — Tests for LLM memory conflict judge
 */
import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { judgeConflict } from '../memory/judge.ts'

// chat() de openrouter.ts lee globalThis.fetch en cada llamada — mockear fetch en vez de
// mock.module('../providers/openrouter.ts', ...) evita contaminar el registro de módulos
// para el resto del proceso de `bun test` (mismo problema que rompía openrouter-chat.test.ts;
// ver el comentario en diagnose.test.ts para el detalle completo).
const originalFetch = globalThis.fetch
const prevOpenrouterKey = process.env.OPENROUTER_API_KEY

function mockChatFetch(content: string) {
  globalThis.fetch = (async () => new Response(JSON.stringify({
    choices: [{ message: { content } }],
    usage: { prompt_tokens: 80, completion_tokens: 40 },
    model: 'anthropic/claude-3-haiku',
  }), { status: 200 })) as unknown as typeof fetch
}

beforeAll(() => {
  process.env.OPENROUTER_API_KEY = 'sk-test-or-key'
  mockChatFetch(JSON.stringify({
    relation: 'conflict_with',
    confidence: 'high',
    explanation: 'Entry A says use port 3000, Entry B says use port 4000.',
  }))
})

afterAll(() => {
  globalThis.fetch = originalFetch
  if (prevOpenrouterKey === undefined) delete process.env.OPENROUTER_API_KEY
  else process.env.OPENROUTER_API_KEY = prevOpenrouterKey
})

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
    mockChatFetch('These two entries look fine to me, no conflict at all.')

    const result = await judgeConflict(
      { topicKey: 'a', content: 'X' },
      { topicKey: 'b', content: 'Y' },
    )
    expect(result.relation).toBe('not_conflict')
    expect(result.confidence).toBe('low')
    expect(result.explanation).toContain('unparseable')
  })

  it('returns not_conflict/low when LLM returns garbage', async () => {
    mockChatFetch('!!! NOT JSON !!! {{broken')

    const result = await judgeConflict(
      { topicKey: 'a', content: 'X' },
      { topicKey: 'b', content: 'Y' },
    )
    expect(result.relation).toBe('not_conflict')
    expect(result.confidence).toBe('low')
  })

  it('returns not_conflict/low when LLM returns valid JSON with invalid relation', async () => {
    mockChatFetch(JSON.stringify({
      relation: 'invalid_relation_value',
      confidence: 'high',
      explanation: 'test',
    }))

    const result = await judgeConflict(
      { topicKey: 'a', content: 'X' },
      { topicKey: 'b', content: 'Y' },
    )
    expect(result.relation).toBe('not_conflict')
  })
})
