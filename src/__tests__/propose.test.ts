/**
 * S34.7 — Tests for instinct proposal flow:
 *   - threshold triggers proposal
 *   - dedup prevents duplicates
 *   - approve/reject work correctly
 *   - hook (proposeInstinctsFromPatterns) does not block when no proposals
 */

import { describe, it, expect, afterEach } from 'bun:test'
import { proposeInstinctsFromPatterns, PATTERN_FREQUENCY_THRESHOLD } from '../analyze/propose.ts'
import { approveInstinct, deleteInstinct, getInstinct, listUnverified, insertInstinct } from '../instincts/store.ts'
import { AUTO_DEFAULTS, APPLY_THRESHOLD } from '../instincts/schema.ts'
import type { PatternSuggestion } from '../analyze/patterns.ts'

// ── helpers ──────────────────────────────────────────────────────────────────

function makeSuggestion(overrides: Partial<PatternSuggestion> = {}): PatternSuggestion {
  return {
    pattern:    'missing_error_handling',
    frequency:  PATTERN_FREQUENCY_THRESHOLD,
    fix_hint:   'Add try/catch around all async calls',
    confidence: 'high',
    ...overrides,
  }
}

const createdIds: string[] = []

afterEach(() => {
  for (const id of createdIds.splice(0)) {
    try { deleteInstinct(id) } catch { /* ignore */ }
  }
})

// ── S34.2: threshold triggers proposal ───────────────────────────────────────

describe('proposeInstinctsFromPatterns — threshold', () => {
  it('creates instinct when frequency equals PATTERN_FREQUENCY_THRESHOLD', () => {
    const proposals = proposeInstinctsFromPatterns([makeSuggestion({ frequency: PATTERN_FREQUENCY_THRESHOLD })])
    expect(proposals).toHaveLength(1)
    createdIds.push(proposals[0]!.id)

    const inst = getInstinct(proposals[0]!.id)
    expect(inst).not.toBeNull()
    expect(inst!.trigger).toBe('missing_error_handling')
    expect(inst!.action).toBe('Add try/catch around all async calls')
    expect(inst!.confidence).toBe(AUTO_DEFAULTS.confidence)
    expect(inst!.source).toBe('auto')
    expect(inst!.verified).toBe(false)
  })

  it('creates instinct when frequency exceeds threshold', () => {
    const proposals = proposeInstinctsFromPatterns([makeSuggestion({ frequency: PATTERN_FREQUENCY_THRESHOLD + 5 })])
    expect(proposals).toHaveLength(1)
    createdIds.push(proposals[0]!.id)
  })

  it('does NOT create instinct when frequency is below threshold', () => {
    const proposals = proposeInstinctsFromPatterns([makeSuggestion({ frequency: PATTERN_FREQUENCY_THRESHOLD - 1 })])
    expect(proposals).toHaveLength(0)
  })

  it('returns empty for empty patterns list', () => {
    expect(proposeInstinctsFromPatterns([])).toHaveLength(0)
  })

  it('returns empty when called with non-array', () => {
    expect(proposeInstinctsFromPatterns(null as any)).toHaveLength(0)
  })

  it('proposes only patterns above threshold in a mixed list', () => {
    const proposals = proposeInstinctsFromPatterns([
      makeSuggestion({ pattern: 'high-freq-A', frequency: 5, fix_hint: 'Fix A' }),
      makeSuggestion({ pattern: 'low-freq-B',  frequency: 1, fix_hint: 'Fix B' }),
      makeSuggestion({ pattern: 'high-freq-C', frequency: 3, fix_hint: 'Fix C' }),
    ])
    expect(proposals).toHaveLength(2)
    for (const p of proposals) createdIds.push(p.id)
    const triggers = proposals.map(p => p.trigger)
    expect(triggers).toContain('high-freq-A')
    expect(triggers).toContain('high-freq-C')
    expect(triggers).not.toContain('low-freq-B')
  })
})

// ── S34.2: dedup ─────────────────────────────────────────────────────────────

describe('proposeInstinctsFromPatterns — dedup', () => {
  it('does not create duplicate when same trigger already exists', () => {
    const first = proposeInstinctsFromPatterns([makeSuggestion({ pattern: 'dedup-test-trigger' })])
    expect(first).toHaveLength(1)
    createdIds.push(first[0]!.id)

    const second = proposeInstinctsFromPatterns([makeSuggestion({ pattern: 'dedup-test-trigger' })])
    expect(second).toHaveLength(0)
  })

  it('dedup is case-insensitive', () => {
    const first = proposeInstinctsFromPatterns([makeSuggestion({ pattern: 'CaseSensitiveCheck' })])
    expect(first).toHaveLength(1)
    createdIds.push(first[0]!.id)

    const second = proposeInstinctsFromPatterns([makeSuggestion({ pattern: 'casesensitivecheck' })])
    expect(second).toHaveLength(0)
  })
})

// ── S34.5: approve ────────────────────────────────────────────────────────────

describe('approveInstinct', () => {
  it('sets verified=true and boosts confidence by 0.1', () => {
    const inst = insertInstinct({ trigger: 'approve-test', action: 'do it', ...AUTO_DEFAULTS })
    createdIds.push(inst.id)
    expect(inst.verified).toBe(false)
    expect(inst.confidence).toBe(0.6)

    const ok = approveInstinct(inst.id)
    expect(ok).toBe(true)

    const loaded = getInstinct(inst.id)!
    expect(loaded.verified).toBe(true)
    expect(loaded.confidence).toBeCloseTo(0.7)
  })

  it('approved instinct with confidence >= APPLY_THRESHOLD is auto-applicable', () => {
    const inst = insertInstinct({ trigger: 'high-conf-approve', action: 'do it', confidence: 0.95, source: 'auto', verified: false })
    createdIds.push(inst.id)
    approveInstinct(inst.id)

    const loaded = getInstinct(inst.id)!
    expect(loaded.verified).toBe(true)
    expect(loaded.confidence).toBeGreaterThanOrEqual(APPLY_THRESHOLD)
  })

  it('caps confidence at 1.0 on approve', () => {
    const inst = insertInstinct({ trigger: 'cap-approve', action: 'do it', confidence: 0.95, source: 'auto', verified: false })
    createdIds.push(inst.id)
    approveInstinct(inst.id)

    const loaded = getInstinct(inst.id)!
    expect(loaded.confidence).toBeLessThanOrEqual(1.0)
  })

  it('returns false for non-existent id', () => {
    expect(approveInstinct('does-not-exist')).toBe(false)
  })
})

// ── S34.5: reject ─────────────────────────────────────────────────────────────

describe('deleteInstinct (reject)', () => {
  it('removes the instinct from the table', () => {
    const inst = insertInstinct({ trigger: 'reject-test', action: 'do it', ...AUTO_DEFAULTS })
    expect(getInstinct(inst.id)).not.toBeNull()

    const ok = deleteInstinct(inst.id)
    expect(ok).toBe(true)
    expect(getInstinct(inst.id)).toBeNull()
  })

  it('returns false for non-existent id', () => {
    expect(deleteInstinct('does-not-exist')).toBe(false)
  })
})

// ── S34.6: hook does not block without proposals ───────────────────────────

describe('proposeInstinctsFromPatterns — hook safety (no blocking)', () => {
  it('returns [] synchronously when no patterns qualify', () => {
    const start = Date.now()
    const result = proposeInstinctsFromPatterns([
      makeSuggestion({ frequency: 1 }),
      makeSuggestion({ frequency: 0 }),
    ])
    const elapsed = Date.now() - start
    expect(result).toHaveLength(0)
    expect(elapsed).toBeLessThan(500) // must not block
  })

  it('listUnverified returns pending proposals visible for review', () => {
    const inst = insertInstinct({ trigger: 'review-visible', action: 'check it', ...AUTO_DEFAULTS })
    createdIds.push(inst.id)

    const unverified = listUnverified()
    expect(unverified.some(i => i.id === inst.id)).toBe(true)
  })
})
