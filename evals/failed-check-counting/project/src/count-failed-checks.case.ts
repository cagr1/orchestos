import { describe, expect, test } from 'bun:test'
import { countFailedChecks } from './count-failed-checks.ts'

describe('countFailedChecks', () => {
  test('does not count successful checks as failed', () => {
    expect(countFailedChecks([{ exitCode: 0, timedOut: false }])).toBe(0)
  })

  test('counts non-zero exits and timeouts', () => {
    expect(
      countFailedChecks([
        { exitCode: 1, timedOut: false },
        { exitCode: 0, timedOut: true },
        { exitCode: 0, timedOut: false },
      ]),
    ).toBe(2)
  })
})
