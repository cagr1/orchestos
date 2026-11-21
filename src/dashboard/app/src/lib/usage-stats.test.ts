import { describe, expect, test } from 'bun:test'
import type { UsageHourRow } from '../api/settings'
import {
  byAgent,
  byDay,
  byModel,
  byVendor,
  dateKey,
  dayChartStats,
  delta,
  filterRows,
  formatDuration,
  formatTokens,
  formatUsd,
  kpis,
  vendorOf,
  weekHourGrid,
  yearActivity,
} from './usage-stats'

const now = new Date('2026-11-21T12:00:00')
function row(overrides: Partial<UsageHourRow> = {}): UsageHourRow {
  return {
    date: '2026-11-21',
    hour: 18,
    agent: 'Codex',
    provider: 'codex',
    model: 'gpt-6',
    source: 'cli',
    runs: 1,
    turns: 2,
    inputTokens: 100,
    cacheReadTokens: 60,
    cacheWriteTokens: 40,
    outputTokens: 50,
    usd: 0.2,
    priced: true,
    activeMs: 60_000,
    ...overrides,
  }
}

describe('usage periods', () => {
  test('date keys use calendar dates', () => {
    expect(dateKey(new Date(2026, 0, 2, 23))).toBe('2026-01-02')
  })
  for (const [range, start, before, oldest] of [
    ['7d', '2026-11-15', '2026-11-14', '2026-11-08'],
    ['30d', '2026-10-23', '2026-10-22', '2026-09-23'],
    ['90d', '2026-08-24', '2026-08-23', '2026-05-26'],
  ] as const) {
    test(`${range} includes today and equal previous calendar period`, () => {
      const today = row()
      const first = row({ date: start })
      const previousLast = row({ date: before })
      const previousFirst = row({ date: oldest })
      const selected = filterRows(
        [
          today,
          first,
          previousLast,
          previousFirst,
          row({ date: '2025-01-01' }),
          row({ date: '2026-11-22' }),
          row({ agent: 'Claude Code' }),
        ],
        { range, agent: 'Codex', now },
      )
      expect(selected.current).toEqual([today, first])
      expect(selected.previous).toEqual([previousLast, previousFirst])
    })
  }
  test('all has no previous period or delta and still filters agent and future dates', () => {
    const selected = filterRows(
      [row({ date: '2020-01-01' }), row({ agent: 'Claude Code' }), row({ date: '2026-11-22' })],
      { range: 'all', agent: 'Codex', now },
    )
    expect(selected.current).toHaveLength(1)
    expect(selected.previous).toBeNull()
    expect(
      delta(
        kpis(selected.current).usd,
        selected.previous === null ? null : kpis(selected.previous).usd,
      ),
    ).toBeNull()
  })
  test('empty period and percentage changes', () => {
    expect(filterRows([], { range: '7d', agent: null, now })).toEqual({ current: [], previous: [] })
    expect(delta(3, 2)).toBe(50)
    expect(delta(1, 2)).toBe(-50)
    expect(delta(0, 2)).toBe(-100)
    expect(delta(2, 0)).toBeNull()
    expect(delta(0, 0)).toBeNull()
    expect(delta(2, 2)).toBe(0)
  })
})

describe('usage aggregation', () => {
  test('KPIs count cache in input, cache ratio, output per turn and known costs', () => {
    expect(kpis([row(), row({ usd: null, priced: false })])).toEqual({
      usd: 0.2,
      unpriced: true,
      runs: 2,
      turns: 4,
      inputTokens: 400,
      outputTokens: 100,
      cachePct: 30,
      outputPerTurn: 25,
      activeMs: 120_000,
      avgUsdPerRun: 0.1,
    })
    expect(kpis([row({ priced: false })]).unpriced).toBe(true)
    expect(kpis([row({ usd: null })]).unpriced).toBe(true)
  })
  test('empty KPIs are finite zeroes', () => {
    expect(kpis([])).toEqual({
      usd: 0,
      unpriced: false,
      runs: 0,
      turns: 0,
      inputTokens: 0,
      cachePct: 0,
      outputTokens: 0,
      outputPerTurn: 0,
      activeMs: 0,
      avgUsdPerRun: 0,
    })
  })
  test('days fill gaps and keep model/agent pairs ordered by total tokens', () => {
    const days = byDay(
      [
        row(),
        row({ agent: 'Claude Code', model: 'claude-sonnet', outputTokens: 500 }),
        row({ date: '2026-11-19' }),
      ],
      '7d',
      now,
    )
    expect(days).toHaveLength(7)
    expect(days[0].date).toBe('2026-11-15')
    expect(days[0].runs).toBe(0)
    expect(days[0].models).toEqual([])
    expect(days[4].runs).toBe(1)
    expect(days[6].inputTokens).toBe(400)
    expect(
      days[6].models.map((model) => [
        model.model,
        model.agent,
        model.inputTokens + model.outputTokens,
      ]),
    ).toEqual([
      ['claude-sonnet', 'Claude Code', 700],
      ['gpt-6', 'Codex', 250],
    ])
    const combined = byDay([row(), row()], '7d', now)[6]
    expect(combined.models).toHaveLength(1)
    expect(combined.models[0].runs).toBe(2)
  })
  test('all starts at earliest date and empty all includes today', () => {
    expect(
      byDay([row({ date: '2026-11-19' }), row({ date: '2026-11-23' })], 'all', now).map(
        (day) => day.date,
      ),
    ).toEqual(['2026-11-19', '2026-11-20', '2026-11-21'])
    expect(byDay([], 'all', now).map((day) => day.date)).toEqual(['2026-11-21'])
    expect(byDay([], '30d', now)).toHaveLength(30)
    expect(byDay([], '90d', now)).toHaveLength(90)
  })
  test('week grid is Monday first, has 168 cells and aggregates per hour', () => {
    const grid = weekHourGrid([
      row({ date: '2026-11-16', hour: 0 }),
      row(),
      row({ date: '2026-11-15', hour: 23 }),
      row({ date: '2026-11-14' }),
    ])
    expect(grid.cells).toHaveLength(7)
    expect(grid.cells.every((day) => day.length === 24)).toBe(true)
    expect(grid.cells[0][0].runs).toBe(1)
    expect(grid.cells[6][23].runs).toBe(1)
    expect(grid.max).toMatchObject({
      day: 5,
      hour: 18,
      runs: 2,
      turns: 4,
      tokens: 500,
      usd: 0.4,
      activeMs: 120_000,
    })
    expect(weekHourGrid([]).max).toBeNull()
    expect(weekHourGrid([row({ usd: null })]).cells[5][18]).toMatchObject({
      usd: 0,
      unpriced: true,
    })
  })
  test('models and agents merge groups, retain unknown costs and normalize token shares', () => {
    const rows = [
      row(),
      row({ usd: null }),
      row({ model: 'claude-sonnet', agent: 'Claude Code', outputTokens: 800 }),
    ]
    const models = byModel(rows)
    expect(models.map((model) => model.model)).toEqual(['claude-sonnet', 'gpt-6'])
    expect(models[1]).toMatchObject({
      runs: 2,
      inputTokens: 400,
      outputTokens: 100,
      usd: 0.2,
      unpriced: true,
      activeMs: 120_000,
      share: 1 / 3,
    })
    expect(models[0].share + models[1].share).toBe(1)
    expect(byAgent(rows).map((agent) => agent.agent)).toEqual(['Claude Code', 'Codex'])
    expect(byModel([])).toEqual([])
    expect(byAgent([])).toEqual([])
    expect(
      byAgent([
        row({ inputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, outputTokens: 0 }),
      ])[0].share,
    ).toBe(0)
  })
  test('yearly activity retains 371 days and legacy run total independently of chosen range', () => {
    const rows = [row(), row({ agent: 'Claude Code', provider: 'claude', date: '2026-10-01' })]
    const legacy = rows.map(({ date, model, provider, usd, runs, inputTokens, outputTokens }) => ({
      date,
      model,
      provider,
      usd,
      runs,
      inputTokens,
      outputTokens,
    }))
    expect(yearActivity(rows, legacy, null, now).days).toHaveLength(371)
    expect(yearActivity(rows, legacy, null, now).total).toBe(2)
    const selected = yearActivity(rows, legacy, 'Codex', now)
    expect(selected.total).toBe(1)
    expect(selected.days.at(-1)?.runs).toBe(1)
    expect(selected.days.find((day) => day.date === '2026-10-01')?.runs).toBe(0)
    expect(yearActivity([], [], null, now).total).toBe(0)
  })
  test('chart summary includes gaps in its per-day average and activity without a new run', () => {
    const days = byDay([row({ runs: 0 })], '7d', now)
    expect(dayChartStats(days)).toEqual({
      activeDays: 1,
      tokensPerDay: 250 / 7,
      maxInput: 200,
      maxOutput: 50,
      maxima: { usd: 0.2, runs: 1, inputTokens: 200, outputTokens: 50, activeMs: 60_000 },
    })
    expect(dayChartStats([])).toEqual({
      activeDays: 0,
      tokensPerDay: 0,
      maxInput: 1,
      maxOutput: 1,
      maxima: { usd: 1, runs: 1, inputTokens: 1, outputTokens: 1, activeMs: 1 },
    })
  })
})

describe('vendors and formatting', () => {
  test('vendor families and provider-qualified model identifiers', () => {
    for (const model of [
      'claude-opus',
      'opus',
      'sonnet-4',
      'haiku',
      'fable-5',
      'anthropic/claude-sonnet',
    ])
      expect(vendorOf(model)).toBe('Anthropic')
    for (const model of ['gpt-6', 'o3', 'o4-mini', 'custom-codex', 'openrouter/openai/gpt-6'])
      expect(vendorOf(model)).toBe('OpenAI')
    expect(vendorOf('gemini-3')).toBe('Google')
    expect(vendorOf('deepseek-v3')).toBe('DeepSeek')
    expect(vendorOf('grok-4')).toBe('xAI')
    expect(vendorOf('unknown')).toBe('Other')
    expect(vendorOf('other-model')).toBe('Other')
    expect(
      byVendor([row(), row({ model: 'o3' }), row({ model: 'claude-opus' })]).map((vendor) => [
        vendor.vendor,
        vendor.share,
      ]),
    ).toEqual([
      ['OpenAI', 2 / 3],
      ['Anthropic', 1 / 3],
    ])
    expect(byVendor([])).toEqual([])
  })
  test('token magnitudes, money precision and estimated durations', () => {
    expect([0, 12, 1200, 61_300_000, 11_600_000_000].map(formatTokens)).toEqual([
      '0',
      '12',
      '1.2K',
      '61.3M',
      '11.6B',
    ])
    expect([0, 0.012, 12.5].map(formatUsd)).toEqual(['$0.00', '$0.012', '$12.50'])
    expect([0, 23 * 60_000, 9.2 * 3_600_000].map(formatDuration)).toEqual([
      '0 min',
      '23 min',
      '9.2 h',
    ])
  })
})
