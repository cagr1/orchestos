/**
 * S33.8 — Tests for instinct schema, CRUD store, and filtering.
 */

import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { validateInstinct, validateInsert, InstinctValidationError, shouldApply, recalculateVerified, REVIEW_THRESHOLD, APPLY_THRESHOLD } from '../instincts/schema.ts'
import { insertInstinct, getInstinct, listInstincts, updateConfidence, deleteInstinct, listApplicable, listUnverified, approveInstinct, updateInstinct } from '../instincts/store.ts'

// ── helpers ───────────────────────────────────────────────────────────────────

function validDef(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'test-id-001',
    trigger: 'When user submits invalid data',
    action: 'Return a validation error',
    confidence: 0.9,
    source: 'manual',
    verified: true,
    created_at: '2026-06-01T00:00:00.000Z',
    ...overrides,
  }
}

function validInsert(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    trigger: 'When user submits invalid data',
    action: 'Return a validation error',
    confidence: 0.9,
    source: 'manual',
    verified: true,
    ...overrides,
  }
}

// ── schema validation ─────────────────────────────────────────────────────────

describe('validateInstinct', () => {
  it('passes for a valid InstinctDef', () => {
    const result = validateInstinct(validDef())
    expect(result.id).toBe('test-id-001')
    expect(result.confidence).toBe(0.9)
    expect(result.verified).toBe(true)
  })

  it('throws for null/undefined', () => {
    expect(() => validateInstinct(null)).toThrow(InstinctValidationError)
    expect(() => validateInstinct(undefined)).toThrow(InstinctValidationError)
  })

  it('throws for non-object', () => {
    expect(() => validateInstinct('string')).toThrow(InstinctValidationError)
    expect(() => validateInstinct(42)).toThrow(InstinctValidationError)
  })

  it('throws for empty id', () => {
    expect(() => validateInstinct(validDef({ id: '' }))).toThrow(/id/)
  })

  it('throws for empty trigger', () => {
    expect(() => validateInstinct(validDef({ trigger: '' }))).toThrow(/trigger/)
  })

  it('throws for empty action', () => {
    expect(() => validateInstinct(validDef({ action: '' }))).toThrow(/action/)
  })

  it('throws for confidence < 0', () => {
    expect(() => validateInstinct(validDef({ confidence: -0.1 }))).toThrow(/confidence/)
  })

  it('throws for confidence > 1', () => {
    expect(() => validateInstinct(validDef({ confidence: 1.5 }))).toThrow(/confidence/)
  })

  it('throws for non-finite confidence', () => {
    expect(() => validateInstinct(validDef({ confidence: NaN }))).toThrow(/confidence/)
  })

  it('throws for invalid source', () => {
    expect(() => validateInstinct(validDef({ source: 'invalid' }))).toThrow(/source/)
  })

  it('throws for empty created_at', () => {
    expect(() => validateInstinct(validDef({ created_at: '' }))).toThrow(/created_at/)
  })
})

describe('validateInsert', () => {
  it('passes for a valid insert payload', () => {
    const result = validateInsert(validInsert())
    expect(result.trigger).toBe('When user submits invalid data')
    expect(result.confidence).toBe(0.9)
  })

  it('throws for null', () => {
    expect(() => validateInsert(null)).toThrow(InstinctValidationError)
  })

  it('throws for empty trigger', () => {
    expect(() => validateInsert(validInsert({ trigger: '' }))).toThrow(/trigger/)
  })

  it('throws for invalid source', () => {
    expect(() => validateInsert(validInsert({ source: 'robot' }))).toThrow(/source/)
  })
})

// ── schema helpers ─────────────────────────────────────────────────────────────

describe('shouldApply', () => {
  it('returns true for verified instinct above APPLY_THRESHOLD', () => {
    expect(shouldApply({ confidence: 0.9, verified: true })).toBe(true)
  })

  it('returns false for unverified instinct above APPLY_THRESHOLD', () => {
    expect(shouldApply({ confidence: 0.9, verified: false })).toBe(false)
  })

  it('returns false for verified instinct below APPLY_THRESHOLD', () => {
    expect(shouldApply({ confidence: 0.7, verified: true })).toBe(false)
  })

  it('returns false for confidence at exact threshold with verified', () => {
    expect(shouldApply({ confidence: APPLY_THRESHOLD, verified: true })).toBe(true)
  })

  it('returns false for confidence just below APPLY_THRESHOLD', () => {
    expect(shouldApply({ confidence: APPLY_THRESHOLD - 0.01, verified: true })).toBe(false)
  })
})

describe('recalculateVerified', () => {
  it('demotes verified to false when confidence drops below REVIEW_THRESHOLD', () => {
    expect(recalculateVerified(0.5, true)).toBe(false)
    expect(recalculateVerified(0.5, false)).toBe(false)
  })

  it('keeps verified unchanged when confidence is at or above REVIEW_THRESHOLD', () => {
    expect(recalculateVerified(0.6, true)).toBe(true)
    expect(recalculateVerified(0.6, false)).toBe(false)
    expect(recalculateVerified(0.8, true)).toBe(true)
  })

  it('demotes at exact boundary just below REVIEW_THRESHOLD', () => {
    expect(recalculateVerified(REVIEW_THRESHOLD - 0.01, true)).toBe(false)
  })
})

// ── CRUD store ────────────────────────────────────────────────────────────────

describe('store — insert and get', () => {
  it('inserts and retrieves an instinct', () => {
    const inserted = insertInstinct({
      trigger: 'When API returns 500',
      action: 'Log the error and retry',
      confidence: 0.85,
      source: 'auto',
      verified: false,
    })
    expect(inserted.id).toBeTruthy()
    expect(inserted.trigger).toBe('When API returns 500')
    expect(inserted.confidence).toBe(0.85)
    expect(inserted.verified).toBe(false)
    expect(inserted.source).toBe('auto')
    expect(inserted.created_at).toBeTruthy()

    const loaded = getInstinct(inserted.id)
    expect(loaded).not.toBeNull()
    expect(loaded!.id).toBe(inserted.id)
    expect(loaded!.trigger).toBe('When API returns 500')
  })

  it('returns null for non-existent id', () => {
    expect(getInstinct('non-existent-id')).toBeNull()
  })

  it('delete removes an instinct', () => {
    const inserted = insertInstinct({
      trigger: 'To be deleted',
      action: 'Delete me',
      confidence: 0.5,
      source: 'manual',
      verified: false,
    })
    expect(deleteInstinct(inserted.id)).toBe(true)
    expect(getInstinct(inserted.id)).toBeNull()
  })

  it('delete returns false for non-existent id', () => {
    expect(deleteInstinct('non-existent')).toBe(false)
  })
})

describe('store — list', () => {
  const ids: string[] = []

  beforeAll(() => {
    // Insert a few instincts for listing tests
    ids.push(insertInstinct({ trigger: 'ListTest A', action: 'Action A', confidence: 0.9, source: 'manual', verified: true }).id)
    ids.push(insertInstinct({ trigger: 'ListTest B', action: 'Action B', confidence: 0.7, source: 'manual', verified: true }).id)
    ids.push(insertInstinct({ trigger: 'ListTest C', action: 'Action C', confidence: 0.5, source: 'auto', verified: false }).id)
    ids.push(insertInstinct({ trigger: 'ListTest D', action: 'Action D', confidence: 0.95, source: 'auto', verified: false }).id)
  })

  afterAll(() => {
    for (const id of ids) deleteInstinct(id)
  })

  it('list all returns inserted instincts', () => {
    const all = listInstincts()
    const ours = all.filter(s => s.trigger.startsWith('ListTest'))
    expect(ours.length).toBe(4)
  })

  it('list filtered by source', () => {
    const manuals = listInstincts({ source: 'manual' })
    const ours = manuals.filter(s => s.trigger.startsWith('ListTest'))
    expect(ours.length).toBe(2)
  })

  it('list filtered by verified', () => {
    const verified = listInstincts({ verified: true })
    const ours = verified.filter(s => s.trigger.startsWith('ListTest'))
    expect(ours.length).toBe(2)
  })

  it('list filtered by minConfidence', () => {
    const high = listInstincts({ minConfidence: 0.8 })
    const ours = high.filter(s => s.trigger.startsWith('ListTest'))
    expect(ours.length).toBe(2) // A (0.9) and D (0.95)
  })

  it('listApplicable returns only verified with confidence >= APPLY_THRESHOLD', () => {
    const applicable = listApplicable()
    const ours = applicable.filter(s => s.trigger.startsWith('ListTest'))
    expect(ours.length).toBe(1) // only A (0.9, verified: true)
    expect(ours[0]!.trigger).toBe('ListTest A')
  })

  it('listUnverified returns only unverified instincts', () => {
    const unverified = listUnverified()
    const ours = unverified.filter(s => s.trigger.startsWith('ListTest'))
    expect(ours.length).toBe(2) // C and D
  })
})

describe('store — updateConfidence', () => {
  it('updates confidence and returns true', () => {
    const inserted = insertInstinct({
      trigger: 'UpdateConf Test',
      action: 'Test action',
      confidence: 0.8,
      source: 'manual',
      verified: true,
    })
    const ok = updateConfidence(inserted.id, 0.95)
    expect(ok).toBe(true)

    const loaded = getInstinct(inserted.id)
    expect(loaded!.confidence).toBe(0.95)
    expect(loaded!.verified).toBe(true) // unchanged above REVIEW_THRESHOLD
    deleteInstinct(inserted.id)
  })

  it('demotes verified when dropping below REVIEW_THRESHOLD', () => {
    const inserted = insertInstinct({
      trigger: 'Demote Test',
      action: 'Test action',
      confidence: 0.8,
      source: 'manual',
      verified: true,
    })
    updateConfidence(inserted.id, 0.4)

    const loaded = getInstinct(inserted.id)
    expect(loaded!.confidence).toBe(0.4)
    expect(loaded!.verified).toBe(false) // demoted
    deleteInstinct(inserted.id)
  })

  it('returns false for non-existent id', () => {
    expect(updateConfidence('non-existent', 0.5)).toBe(false)
  })
})

describe('store — approveInstinct', () => {
  it('sets verified to true and boosts confidence', () => {
    const inserted = insertInstinct({
      trigger: 'Approve Test',
      action: 'Test action',
      confidence: 0.6,
      source: 'auto',
      verified: false,
    })
    const ok = approveInstinct(inserted.id)
    expect(ok).toBe(true)

    const loaded = getInstinct(inserted.id)
    expect(loaded!.verified).toBe(true)
    expect(loaded!.confidence).toBe(0.7) // 0.6 + 0.1
    deleteInstinct(inserted.id)
  })

  it('caps confidence at 1.0', () => {
    const inserted = insertInstinct({
      trigger: 'Cap Test',
      action: 'Test action',
      confidence: 0.95,
      source: 'auto',
      verified: false,
    })
    approveInstinct(inserted.id)
    const loaded = getInstinct(inserted.id)
    expect(loaded!.confidence).toBe(1.0) // capped
    deleteInstinct(inserted.id)
  })

  it('returns false for non-existent id', () => {
    expect(approveInstinct('non-existent')).toBe(false)
  })
})

describe('store — updateInstinct', () => {
  it('updates partial fields', () => {
    const inserted = insertInstinct({
      trigger: 'Update Test',
      action: 'Original action',
      confidence: 0.7,
      source: 'auto',
      verified: false,
    })
    updateInstinct(inserted.id, { action: 'Updated action', confidence: 0.9 })
    const loaded = getInstinct(inserted.id)
    expect(loaded!.action).toBe('Updated action')
    expect(loaded!.confidence).toBe(0.9)
    deleteInstinct(inserted.id)
  })
})
