/**
 * S30.5 — Tests for patterns.ts (groupRunsByOutcome + parsePatternSuggestions).
 * No LLM calls — all pure functions.
 */

import { describe, it, expect } from 'bun:test'
import { groupRunsByOutcome, parsePatternSuggestions, type RunSummary } from '../analyze/patterns.ts'

function run(overrides: Partial<RunSummary> = {}): RunSummary {
  return {
    status:     'done',
    qa_verdict: 'pass',
    qa_reason:  null,
    model:      'test-model',
    usd_cost:   0.001,
    elapsed_ms: 500,
    result:     'ok',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// groupRunsByOutcome
// ---------------------------------------------------------------------------

describe('groupRunsByOutcome — empty', () => {
  it('returns zeros for empty input', () => {
    const g = groupRunsByOutcome([])
    expect(g.total).toBe(0)
    expect(g.qaPass).toBe(0)
    expect(g.qaFail).toBe(0)
    expect(g.blocked).toBe(0)
    expect(g.parseError).toBe(0)
  })
})

describe('groupRunsByOutcome — pass / fail split', () => {
  it('counts QA passes', () => {
    const g = groupRunsByOutcome([
      run({ qa_verdict: 'pass' }),
      run({ qa_verdict: 'pass' }),
    ])
    expect(g.qaPass).toBe(2)
    expect(g.qaFail).toBe(0)
  })

  it('counts QA failures', () => {
    const g = groupRunsByOutcome([
      run({ status: 'failed', qa_verdict: 'fail', qa_reason: 'criterion 2 not met' }),
      run({ status: 'failed', qa_verdict: 'fail', qa_reason: 'missing error handling' }),
    ])
    expect(g.qaFail).toBe(2)
    expect(g.failReasons).toContain('criterion 2 not met')
    expect(g.failReasons).toContain('missing error handling')
  })

  it('counts blocked runs', () => {
    const g = groupRunsByOutcome([
      run({ status: 'blocked', qa_verdict: null }),
    ])
    expect(g.blocked).toBe(1)
    expect(g.qaPass).toBe(0)
  })

  it('counts parse errors from result field', () => {
    const g = groupRunsByOutcome([
      run({ status: 'failed', result: 'parse error: invalid JSON at position 42' }),
    ])
    expect(g.parseError).toBe(1)
  })
})

describe('groupRunsByOutcome — model tracking', () => {
  it('aggregates model usage counts', () => {
    const g = groupRunsByOutcome([
      run({ model: 'deepseek/v3' }),
      run({ model: 'deepseek/v3' }),
      run({ model: 'gpt-4o' }),
    ])
    expect(g.topModels['deepseek/v3']).toBe(2)
    expect(g.topModels['gpt-4o']).toBe(1)
  })
})

describe('groupRunsByOutcome — cost and elapsed averages', () => {
  it('computes average cost', () => {
    const g = groupRunsByOutcome([
      run({ usd_cost: 0.01 }),
      run({ usd_cost: 0.03 }),
    ])
    expect(g.avgCostUsd).toBeCloseTo(0.02)
  })

  it('computes average elapsed ms', () => {
    const g = groupRunsByOutcome([
      run({ elapsed_ms: 1000 }),
      run({ elapsed_ms: 3000 }),
    ])
    expect(g.avgElapsedMs).toBeCloseTo(2000)
  })
})

describe('groupRunsByOutcome — mixed', () => {
  it('handles a realistic mix', () => {
    const g = groupRunsByOutcome([
      run({ qa_verdict: 'pass' }),
      run({ qa_verdict: 'pass' }),
      run({ status: 'failed', qa_verdict: 'fail', qa_reason: 'missing tests' }),
      run({ status: 'blocked', qa_verdict: null }),
      run({ status: 'failed', result: 'parse error: unexpected token' }),
    ])
    expect(g.total).toBe(5)
    expect(g.qaPass).toBe(2)
    expect(g.qaFail).toBe(1)
    expect(g.blocked).toBe(1)
    expect(g.parseError).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// parsePatternSuggestions
// ---------------------------------------------------------------------------

describe('parsePatternSuggestions — valid JSON', () => {
  it('parses well-formed JSON array', () => {
    const raw = JSON.stringify([
      { pattern: 'missing_error_handling', frequency: 3, fix_hint: 'Add try/catch blocks', confidence: 'high' },
      { pattern: 'vague_acceptance_criteria', frequency: 2, fix_hint: 'Use WHEN/THEN format', confidence: 'medium' },
    ])
    const suggestions = parsePatternSuggestions(raw)
    expect(suggestions).toHaveLength(2)
    expect(suggestions[0]!.pattern).toBe('missing_error_handling')
    expect(suggestions[0]!.frequency).toBe(3)
    expect(suggestions[0]!.confidence).toBe('high')
    expect(suggestions[1]!.fix_hint).toBe('Use WHEN/THEN format')
  })

  it('parses JSON wrapped in markdown code fences', () => {
    const raw = '```json\n[{"pattern":"foo","frequency":1,"fix_hint":"bar","confidence":"low"}]\n```'
    const suggestions = parsePatternSuggestions(raw)
    expect(suggestions).toHaveLength(1)
    expect(suggestions[0]!.pattern).toBe('foo')
  })

  it('returns empty array for non-JSON text', () => {
    expect(parsePatternSuggestions('no patterns detected')).toHaveLength(0)
    expect(parsePatternSuggestions('')).toHaveLength(0)
  })

  it('returns empty array for empty JSON array', () => {
    expect(parsePatternSuggestions('[]')).toHaveLength(0)
  })

  it('skips items missing required fields', () => {
    const raw = JSON.stringify([
      { pattern: 'foo', frequency: 1, fix_hint: 'do something', confidence: 'high' },
      { frequency: 2, fix_hint: 'missing pattern field' },           // no pattern
      { pattern: 'bar', frequency: 3 },                               // no fix_hint
    ])
    const suggestions = parsePatternSuggestions(raw)
    expect(suggestions).toHaveLength(1)
    expect(suggestions[0]!.pattern).toBe('foo')
  })

  it('defaults confidence to "low" for unknown values', () => {
    const raw = JSON.stringify([
      { pattern: 'x', frequency: 1, fix_hint: 'y', confidence: 'very_high' },
    ])
    const suggestions = parsePatternSuggestions(raw)
    expect(suggestions[0]!.confidence).toBe('low')
  })

  it('returns non-array JSON as empty array', () => {
    const raw = JSON.stringify({ pattern: 'not_an_array' })
    expect(parsePatternSuggestions(raw)).toHaveLength(0)
  })
})
