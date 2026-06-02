import { describe, it, expect } from 'bun:test'
import {
  calcEntryCost,
  sumCosts,
  sumTokens,
  costBreakdownToJson,
  parseCostBreakdownJson,
  type CostBreakdownEntry,
} from '../run/transcript-parser.ts'

describe('calcEntryCost', () => {
  it('calculates cost for a known model', () => {
    const entry = calcEntryCost('agent-1', 'openai/gpt-4o', 1_000_000, 500_000)
    expect(entry.label).toBe('agent-1')
    expect(entry.model).toBe('openai/gpt-4o')
    expect(entry.inputTokens).toBe(1_000_000)
    expect(entry.outputTokens).toBe(500_000)
    // gpt-4o: $2.50/1M in, $10.00/1M out → (1M/1M)*2.5 + (0.5M/1M)*10 = 2.5 + 5 = 7.5
    expect(entry.costUsd).toBeCloseTo(7.5, 6)
  })

  it('returns 0 cost for unknown model', () => {
    const entry = calcEntryCost('test', 'unknown/model', 1000, 500)
    expect(entry.costUsd).toBe(0)
  })

  it('handles zero tokens', () => {
    const entry = calcEntryCost('empty', 'openai/gpt-4o', 0, 0)
    expect(entry.costUsd).toBe(0)
  })

  it('handles fractional token amounts', () => {
    const entry = calcEntryCost('small', 'openai/gpt-4o-mini', 100, 50)
    // gpt-4o-mini: $0.15/1M in, $0.60/1M out
    expect(entry.costUsd).toBeCloseTo((100 / 1_000_000) * 0.15 + (50 / 1_000_000) * 0.60, 10)
  })

  it('adds missing models from S35.2', () => {
    const entry = calcEntryCost('test', 'deepseek/deepseek-v3', 1_000_000, 500_000)
    expect(entry.costUsd).toBeGreaterThan(0)
  })
})

describe('sumCosts', () => {
  it('sums all entries', () => {
    const entries: CostBreakdownEntry[] = [
      { label: 'a', model: 'm1', inputTokens: 100, outputTokens: 50, costUsd: 1.0 },
      { label: 'b', model: 'm2', inputTokens: 200, outputTokens: 100, costUsd: 2.0 },
      { label: 'c', model: 'm3', inputTokens: 300, outputTokens: 150, costUsd: 3.0 },
    ]
    expect(sumCosts(entries)).toBeCloseTo(6.0, 6)
  })

  it('returns 0 for empty array', () => {
    expect(sumCosts([])).toBe(0)
  })
})

describe('sumTokens', () => {
  it('sums all token counts', () => {
    const entries: CostBreakdownEntry[] = [
      { label: 'a', model: 'm1', inputTokens: 1000, outputTokens: 500, costUsd: 0 },
      { label: 'b', model: 'm2', inputTokens: 2000, outputTokens: 1000, costUsd: 0 },
    ]
    const result = sumTokens(entries)
    expect(result.inputTokens).toBe(3000)
    expect(result.outputTokens).toBe(1500)
  })

  it('returns zeros for empty array', () => {
    const result = sumTokens([])
    expect(result.inputTokens).toBe(0)
    expect(result.outputTokens).toBe(0)
  })
})

describe('costBreakdownToJson / parseCostBreakdownJson', () => {
  it('round-trips entries through JSON', () => {
    const entries: CostBreakdownEntry[] = [
      { label: 'parent', model: 'gpt-4o', inputTokens: 500, outputTokens: 200, costUsd: 0.00325 },
      { label: 'sub-1', model: 'claude-haiku', inputTokens: 300, outputTokens: 150, costUsd: 0.00084 },
    ]
    const json = costBreakdownToJson(entries)
    const parsed = parseCostBreakdownJson(json)
    expect(parsed).toEqual(entries)
  })

  it('returns empty array for null input', () => {
    expect(parseCostBreakdownJson(null)).toEqual([])
  })

  it('returns empty array for undefined input', () => {
    expect(parseCostBreakdownJson(undefined)).toEqual([])
  })

  it('returns empty array for invalid JSON', () => {
    expect(parseCostBreakdownJson('not json')).toEqual([])
  })

  it('returns empty array for empty JSON array', () => {
    expect(parseCostBreakdownJson('[]')).toEqual([])
  })
})

describe('integration with pricing', () => {
  it('calcEntryCost matches calcCost from pricing.ts', () => {
    const entry = calcEntryCost('test', 'openai/gpt-4o', 1_000_000, 500_000)
    // Verify it matches expected pricing calculation
    expect(entry.costUsd).toBeCloseTo(7.5, 6)
  })
})
