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
