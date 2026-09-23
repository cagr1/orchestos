import { afterEach, describe, expect, test } from 'bun:test'
import { formatReset } from './ShellStatusBar'

describe('formatReset', () => {
  const originalNow = Date.now

  afterEach(() => {
    Date.now = originalNow
  })

  test('formats reset times both within and beyond 24 hours', () => {
    const now = new Date('2026-09-22T12:00:00Z').getTime()
    Date.now = () => now

    expect(formatReset(now / 1000 + 3 * 60 * 60)).toMatch(/^resets /)
    expect(formatReset(now / 1000 + 25 * 60 * 60)).toMatch(/^resets /)
  })
})
