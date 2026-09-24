import { afterEach, describe, expect, test } from 'bun:test'
import { formatReset, mapQuotas } from './ShellStatusBar'

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

  test('maps an expired window to 100% remaining', () => {
    const now = new Date('2026-09-22T12:00:00Z').getTime()
    Date.now = () => now

    expect(
      mapQuotas({
        available: true,
        clis: [
          {
            id: 'claude',
            label: 'Claude Code',
            binary: 'claude',
            icon: 'claude',
            installed: true,
            available: true,
            observedAt: null,
            context: null,
            rateLimits: {
              windows: [
                {
                  id: 'five_hour',
                  usedPct: 80,
                  remainingPct: 20,
                  windowMinutes: 300,
                  resetsAt: now / 1000 - 1,
                },
              ],
            },
          },
        ],
      }),
    ).toEqual([expect.objectContaining({ quota5h: 100, reset5h: undefined })])
  })
})
