import { describe, expect, it } from 'bun:test'
import { parseLcovSummary } from '../../scripts/check-coverage.ts'

describe('parseLcovSummary', () => {
  it('aggregates function and line totals across LCOV records', () => {
    const summary = parseLcovSummary(`
SF:src/one.ts
FNF:4
FNH:3
LF:10
LH:8
end_of_record
SF:src/two.ts
FNF:2
FNH:2
LF:5
LH:5
end_of_record
`)

    expect(summary.functionsFound).toBe(6)
    expect(summary.functionsHit).toBe(5)
    expect(summary.linesFound).toBe(15)
    expect(summary.linesHit).toBe(13)
    expect(summary.functionsPercent).toBeCloseTo(83.33, 1)
    expect(summary.linesPercent).toBeCloseTo(86.67, 1)
  })

  it('treats an empty metric as fully covered', () => {
    expect(parseLcovSummary('').functionsPercent).toBe(100)
    expect(parseLcovSummary('').linesPercent).toBe(100)
  })
})

describe('evaluateCoverage', () => {
  it('AUD.26 rejects LCOV with either metric empty', async () => {
    const coverage = await import('../../scripts/check-coverage.ts')
    for (const lcov of ['', 'FNF:1\nFNH:1', 'LF:1\nLH:1']) {
      expect(coverage.evaluateCoverage(coverage.parseLcovSummary(lcov))).toEqual({
        ok: false,
        reasons: ['coverage gate failed: LCOV vacío — no se midió nada'],
      })
    }
  })
  it('AUD.26 applies the unchanged ratchet to measured coverage', async () => {
    const coverage = await import('../../scripts/check-coverage.ts')
    expect(
      coverage.evaluateCoverage(coverage.parseLcovSummary('FNF:100\nFNH:69\nLF:100\nLH:57')).ok,
    ).toBe(true)
    expect(
      coverage.evaluateCoverage(coverage.parseLcovSummary('FNF:100\nFNH:68\nLF:100\nLH:57')).ok,
    ).toBe(false)
    expect(
      coverage.evaluateCoverage(coverage.parseLcovSummary('FNF:100\nFNH:69\nLF:100\nLH:56')).ok,
    ).toBe(false)
  })
})
