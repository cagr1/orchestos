import { afterEach, describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { SessionStatus } from '../../types/orchestos'
import {
  formatCountdown,
  formatReset,
  mapQuotas,
  quotaTone,
  ShellStatusBar,
} from './ShellStatusBar'

describe('quotaTone', () => {
  test.each([
    [null, 'normal'],
    [100, 'normal'],
    [41, 'normal'],
    [40, 'warning'],
    [20, 'warning'],
    [19, 'error'],
    [0, 'error'],
  ] as const)('maps %s remaining to %s', (remaining, tone) => {
    expect(quotaTone(remaining)).toBe(tone)
  })
})

describe('formatCountdown', () => {
  const originalNow = Date.now

  afterEach(() => {
    Date.now = originalNow
  })

  test('formats days, hours, and minutes as a countdown', () => {
    const now = new Date('2026-09-22T12:00:00Z').getTime()
    Date.now = () => now

    expect(formatCountdown(now / 1000 + 5 * 86_400 + 14 * 3_600)).toBe('5D 14h')
    expect(formatCountdown(now / 1000 + 14 * 3_600 + 20 * 60)).toBe('14h 20m')
    expect(formatCountdown(now / 1000 + 20 * 60)).toBe('20m')
    expect(formatCountdown(null)).toBeUndefined()
    expect(formatCountdown(now / 1000 - 1)).toBeUndefined()
  })
})

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

  test.each([null, '2026-09-22T11:00:00Z', 'invalid'])(
    'an expired window with old or unknown observation never invents 100%%: %s',
    (observedAt) => {
      const now = new Date('2026-09-22T12:00:00Z').getTime()
      Date.now = () => now

      const status: SessionStatus = {
        available: true,
        clis: [
          {
            id: 'claude',
            label: 'Claude Code',
            binary: 'claude',
            icon: 'claude',
            installed: true,
            available: true,
            observedAt,
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
      }
      expect(mapQuotas(status)).toEqual([
        expect.objectContaining({
          quota5h: null,
          reset5h: undefined,
          missingData:
            observedAt && observedAt !== 'invalid' ? 'no data since 1 h' : 'no data, date unknown',
        }),
      ])
      const html = renderToStaticMarkup(createElement(ShellStatusBar, { status }))
      expect(html).toContain(
        observedAt && observedAt !== 'invalid' ? 'no data since 1 h' : 'no data, date unknown',
      )
      expect(html).not.toContain('100%')
      expect(html).not.toMatch(/style="width:[0-9.]+%/)
    },
  )

  test.each([300, 10080])(
    'a stale %s-minute window does not hide the other valid quota',
    (staleMinutes) => {
      const now = new Date('2026-09-22T12:00:00Z').getTime()
      Date.now = () => now
      const status: SessionStatus = {
        available: true,
        clis: [
          {
            id: 'claude',
            label: 'Claude',
            binary: 'claude',
            icon: 'claude',
            installed: true,
            available: true,
            context: null,
            observedAt: new Date(now - 3_600_000).toISOString(),
            rateLimits: {
              windows: [300, 10080].map((windowMinutes) => ({
                id: windowMinutes === 300 ? 'five_hour' : 'seven_day',
                windowMinutes,
                usedPct: 10,
                resetsAt: now / 1000 + (windowMinutes === staleMinutes ? -1800 : 3600),
              })),
            },
          },
        ],
      }
      const quota = mapQuotas(status)[0]
      expect(quota?.quota5h).toBe(staleMinutes === 300 ? null : 90)
      expect(quota?.quotaWeekly).toBe(staleMinutes === 10080 ? null : 90)
      const html = renderToStaticMarkup(createElement(ShellStatusBar, { status }))
      expect(html).toContain('>10%</span>')
      expect(html).toContain('style="width:10%"')
      expect(html).toContain('10% 5-hour quota used · no data since 1 h')
      expect(html).not.toContain('>—</span>')
    },
  )

  test('preserves 100% for a reading after reset and exposes wiring warning', () => {
    const now = new Date('2026-09-22T12:00:00Z').getTime()
    Date.now = () => now
    const status: SessionStatus = {
      available: true,
      clis: [
        {
          id: 'claude',
          label: 'Claude',
          binary: 'claude',
          icon: 'claude',
          installed: true,
          available: true,
          observedAt: new Date(now).toISOString(),
          context: null,
          statuslineWired: false,
          rateLimits: {
            windows: [
              { id: 'five_hour', usedPct: 80, windowMinutes: 300, resetsAt: now / 1000 - 1 },
            ],
          },
        },
      ],
    }
    expect(mapQuotas(status)[0]?.quota5h).toBe(100)
    expect(renderToStaticMarkup(createElement(ShellStatusBar, { status }))).toContain(
      'Claude statusLine is not routed through OrchestOS',
    )
    const window = status.clis[0]?.rateLimits?.windows[0]
    if (!window) throw new Error('missing quota fixture')
    window.observedAt = new Date(now - 3_600_000).toISOString()
    expect(mapQuotas(status)[0]?.quota5h).toBeNull()
  })

  test('a CLI without rate limits retains the existing missing-data style and wiring warning', () => {
    const status: SessionStatus = {
      available: false,
      clis: [
        {
          id: 'claude',
          label: 'Claude',
          binary: 'claude',
          icon: 'claude',
          installed: true,
          available: false,
          observedAt: null,
          context: null,
          rateLimits: null,
          statuslineWired: false,
        },
      ],
    }
    const html = renderToStaticMarkup(createElement(ShellStatusBar, { status }))
    expect(html).toContain('>—</span>')
    expect(html).toContain('Claude statusLine is not routed through OrchestOS')
    expect(html).not.toContain('no data since')
  })

  test('maps consumed quota and weekly reset countdown for the popover', () => {
    const now = new Date('2026-09-22T12:00:00Z').getTime()
    Date.now = () => now
    const status: SessionStatus = {
      available: true,
      clis: [
        {
          id: 'codex',
          label: 'Codex',
          binary: 'codex',
          icon: 'codex',
          installed: true,
          available: true,
          observedAt: null,
          context: null,
          rateLimits: {
            windows: [
              { id: 'five_hour', usedPct: 5, windowMinutes: 300, resetsAt: now / 1000 + 3600 },
              {
                id: 'weekly',
                usedPct: 10,
                windowMinutes: 10080,
                resetsAt: now / 1000 + 5 * 86_400 + 14 * 3_600,
              },
            ],
          },
        },
      ],
    }
    expect(mapQuotas(status)[0]?.resetWeekly).toBe('5D 14h')
    const html = renderToStaticMarkup(createElement(ShellStatusBar, { status }))
    expect(html).toContain('>5%</span>')
    expect(html).toContain('title="Codex: 5% 5-hour quota used"')
    expect(html).not.toContain('CLI Quotas')
  })
})
