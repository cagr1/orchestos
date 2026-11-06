import { describe, expect, it } from 'bun:test'
import { normalizeRunLimit } from '../db/runs.ts'

describe('SQLite query input limits', () => {
  it('fails closed for invalid, negative, and fractional limits', () => {
    expect(normalizeRunLimit(Number.NaN)).toBe(20)
    expect(normalizeRunLimit(-10)).toBe(20)
    expect(normalizeRunLimit(0.5)).toBe(20)
  })

  it('caps public positive limits and preserves explicit export mode', () => {
    expect(normalizeRunLimit(50, 20, 200)).toBe(50)
    expect(normalizeRunLimit(999_999, 20, 200)).toBe(200)
    expect(normalizeRunLimit(0, 20, 200)).toBe(0)
  })
})
