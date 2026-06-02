import { describe, it, expect } from 'bun:test'
import {
  checkContextHealth,
  getModelContextWindow,
  shouldCheck,
  type RunState,
} from '../hooks/context-monitor.ts'

function state(overrides: Partial<RunState> = {}): RunState {
  return {
    promptTokens:       10_000,
    modelContextWindow: 128_000,
    cumulativeCostUsd:  0,
    recentToolCalls:    [],
    filesModified:      0,
    ...overrides,
  }
}

describe('getModelContextWindow', () => {
  it('returns 200K for claude models', () => {
    expect(getModelContextWindow('anthropic/claude-sonnet-4-6')).toBe(200_000)
    expect(getModelContextWindow('claude-3-haiku')).toBe(200_000)
  })
  it('returns 128K for gpt-4o', () => {
    expect(getModelContextWindow('openai/gpt-4o')).toBe(128_000)
    expect(getModelContextWindow('gpt-4o-mini')).toBe(128_000)
  })
  it('returns 1M for gemini', () => {
    expect(getModelContextWindow('google/gemini-2.5-flash')).toBe(1_000_000)
  })
  it('returns default 128K for unknown model', () => {
    expect(getModelContextWindow('unknown-model-xyz')).toBe(128_000)
  })
})

describe('checkContextHealth — no warnings', () => {
  it('returns empty array when everything is healthy', () => {
    expect(checkContextHealth(state())).toEqual([])
  })
})

describe('checkContextHealth — context_warning', () => {
  it('fires at < 35% remaining', () => {
    // used = 66%, remaining = 34%
    const w = checkContextHealth(state({ promptTokens: 84_480, modelContextWindow: 128_000 }))
    expect(w.map(x => x.code)).toContain('context_warning')
    expect(w.find(x => x.code === 'context_warning')?.severity).toBe('warning')
  })

  it('does NOT fire at exactly 35% remaining', () => {
    // used = 65%, remaining = 35%
    const w = checkContextHealth(state({ promptTokens: 83_200, modelContextWindow: 128_000 }))
    expect(w.map(x => x.code)).not.toContain('context_warning')
    expect(w.map(x => x.code)).not.toContain('context_critical')
  })
})

describe('checkContextHealth — context_critical', () => {
  it('fires at < 25% remaining (not warning, critical)', () => {
    // used = 80%, remaining = 20%
    const w = checkContextHealth(state({ promptTokens: 102_400, modelContextWindow: 128_000 }))
    const codes = w.map(x => x.code)
    expect(codes).toContain('context_critical')
    expect(codes).not.toContain('context_warning')
  })
})

describe('checkContextHealth — cost_notice', () => {
  it('fires when cost > $5', () => {
    const w = checkContextHealth(state({ cumulativeCostUsd: 5.01 }))
    expect(w.map(x => x.code)).toContain('cost_notice')
    expect(w.find(x => x.code === 'cost_notice')?.severity).toBe('notice')
  })

  it('does NOT fire at exactly $5', () => {
    const w = checkContextHealth(state({ cumulativeCostUsd: 5.00 }))
    expect(w.map(x => x.code)).not.toContain('cost_notice')
  })
})

describe('checkContextHealth — loop_detected', () => {
  it('fires when same tool appears 3 times in a row', () => {
    const w = checkContextHealth(state({ recentToolCalls: ['write', 'read', 'read', 'read'] }))
    expect(w.map(x => x.code)).toContain('loop_detected')
  })

  it('fires on exactly 3 consecutive identical calls', () => {
    const w = checkContextHealth(state({ recentToolCalls: ['read', 'read', 'read'] }))
    expect(w.map(x => x.code)).toContain('loop_detected')
  })

  it('does NOT fire on two consecutive identical calls', () => {
    const w = checkContextHealth(state({ recentToolCalls: ['read', 'read'] }))
    expect(w.map(x => x.code)).not.toContain('loop_detected')
  })

  it('does NOT fire when last 3 calls are different', () => {
    const w = checkContextHealth(state({ recentToolCalls: ['read', 'write', 'read'] }))
    expect(w.map(x => x.code)).not.toContain('loop_detected')
  })
})

describe('checkContextHealth — scope_creep', () => {
  it('fires when filesModified > 20', () => {
    const w = checkContextHealth(state({ filesModified: 21 }))
    expect(w.map(x => x.code)).toContain('scope_creep')
  })

  it('does NOT fire at exactly 20', () => {
    const w = checkContextHealth(state({ filesModified: 20 }))
    expect(w.map(x => x.code)).not.toContain('scope_creep')
  })
})

describe('checkContextHealth — multiple warnings', () => {
  it('can return several warnings at once', () => {
    const w = checkContextHealth(state({
      promptTokens:      110_000,
      modelContextWindow: 128_000,   // 14% remaining → critical
      cumulativeCostUsd:  6.50,       // cost_notice
      filesModified:      25,         // scope_creep
    }))
    const codes = w.map(x => x.code)
    expect(codes).toContain('context_critical')
    expect(codes).toContain('cost_notice')
    expect(codes).toContain('scope_creep')
  })
})

describe('shouldCheck', () => {
  it('returns true for callCount=0 (always check on first call)', () => {
    expect(shouldCheck(0)).toBe(true)
    expect(shouldCheck(0, 5)).toBe(true)
  })

  it('returns false for callCount not a multiple of debounce', () => {
    expect(shouldCheck(1, 5)).toBe(false)
    expect(shouldCheck(3, 5)).toBe(false)
    expect(shouldCheck(4, 5)).toBe(false)
  })

  it('returns true for callCount that is a multiple of debounce', () => {
    expect(shouldCheck(5, 5)).toBe(true)
    expect(shouldCheck(10, 5)).toBe(true)
    expect(shouldCheck(15, 5)).toBe(true)
  })

  it('default debounce is 5', () => {
    expect(shouldCheck(5)).toBe(true)
    expect(shouldCheck(6)).toBe(false)
  })
})
