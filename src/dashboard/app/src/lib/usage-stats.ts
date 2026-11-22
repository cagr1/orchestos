import type { UsageHourRow, UsageRow } from '../api/settings'

export type UsageRange = '7d' | '30d' | '90d' | 'all'
export type UsageDay = ReturnType<typeof byDay>[number]

export function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function shiftDay(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

export function filterRows(
  rows: UsageHourRow[],
  { range, agent, now }: { range: UsageRange; agent: string | null; now: Date },
) {
  const end = dateKey(now)
  const selected = rows.filter((row) => (!agent || row.agent === agent) && row.date <= end)
  if (range === 'all') return { current: selected, previous: null }
  const days = Number.parseInt(range, 10)
  const start = dateKey(shiftDay(now, 1 - days))
  const previousStart = dateKey(shiftDay(now, 1 - days * 2))
  return {
    current: selected.filter((row) => row.date >= start),
    previous: selected.filter((row) => row.date >= previousStart && row.date < start),
  }
}

export function kpis(rows: UsageHourRow[]) {
  let usd = 0
  let unpriced = false
  let runs = 0
  let turns = 0
  let inputTokens = 0
  let outputTokens = 0
  let cacheRead = 0
  let activeMs = 0
  for (const row of rows) {
    usd += row.usd ?? 0
    unpriced ||= row.usd === null || !row.priced
    runs += row.runs
    turns += row.turns
    inputTokens += row.inputTokens + row.cacheReadTokens + row.cacheWriteTokens
    outputTokens += row.outputTokens
    cacheRead += row.cacheReadTokens
    activeMs += row.activeMs
  }
  return {
    usd,
    unpriced,
    runs,
    turns,
    inputTokens,
    cacheReadTokens: cacheRead,
    freshInputTokens: inputTokens - cacheRead,
    outputTokens,
    activeMs,
    cachePct: inputTokens ? (cacheRead / inputTokens) * 100 : 0,
    outputPerTurn: turns ? outputTokens / turns : 0,
    avgUsdPerRun: runs ? usd / runs : 0,
  }
}

export function delta(current: number, previous: number | null): number | null {
  return previous === null || previous === 0 ? null : ((current - previous) / previous) * 100
}

function groups(rows: UsageHourRow[], keyOf: (row: UsageHourRow) => string) {
  const grouped = new Map<string, UsageHourRow[]>()
  for (const row of rows) {
    const key = keyOf(row)
    const group = grouped.get(key)
    if (group) group.push(row)
    else grouped.set(key, [row])
  }
  const total = kpis(rows)
  const tokens = total.inputTokens + total.outputTokens
  return [...grouped]
    .map(([id, entries]) => {
      const totals = kpis(entries)
      return {
        id,
        ...totals,
        share: tokens ? (totals.inputTokens + totals.outputTokens) / tokens : 0,
      }
    })
    .sort(
      (a, b) =>
        b.inputTokens + b.outputTokens - (a.inputTokens + a.outputTokens) ||
        a.id.localeCompare(b.id),
    )
}

export function byModel(rows: UsageHourRow[]) {
  return groups(
    rows.filter((row) => modelIdOf(row.model) !== null),
    (row) => modelIdOf(row.model) as string,
  ).map((row) => ({ ...row, model: row.id }))
}

// USO.33: runs viejos guardan etiquetas en `model`; la tabla solo muestra modelos reales.
export function modelIdOf(model: string): string | null {
  const id = model.replace(/\s+via\s+.*$/i, '').trim()
  if (!id || /\s/.test(id) || /^<.*>$/.test(id) || /^(default|unknown|auto)$/i.test(id)) return null
  return id
}

export function byAgent(rows: UsageHourRow[]) {
  return groups(rows, (row) => row.agent).map((row) => ({ ...row, agent: row.id }))
}

export function vendorOf(model: string): string {
  const name = model
    .toLowerCase()
    .replace(/^(?:openrouter\/)?(?:anthropic|openai|google|deepseek|xai)\//, '')
  if (/^(claude|opus|sonnet|haiku|fable)/.test(name)) return 'Anthropic'
  if (/^(gpt|o\d)/.test(name) || name.includes('codex')) return 'OpenAI'
  if (name.startsWith('gemini')) return 'Google'
  if (name.startsWith('deepseek')) return 'DeepSeek'
  if (name.startsWith('grok')) return 'xAI'
  return 'Other'
}

// Color de marca por agente y por proveedor (USO.29): en este panel cada CLI se distingue por su color.
// Codex/OpenAI usan el color de texto del tema (blanco en oscuro, negro en claro).
const AGENT_COLORS: Record<string, string> = {
  'Claude Code': '#D97757',
  Codex: 'var(--app-text)',
  OpenCode: '#14B8A6',
  OpenRouter: '#6366F1',
  DeepSeek: '#8B5CF6',
  Gemini: '#4285F4',
  Grok: '#F43F5E',
}
const VENDOR_COLORS: Record<string, string> = {
  Anthropic: '#D97757',
  OpenAI: 'var(--app-text)',
  Google: '#4285F4',
  DeepSeek: '#8B5CF6',
  xAI: '#F43F5E',
  Other: '#71717A',
}
const FALLBACK_COLORS = ['#F59E0B', '#EC4899', '#22D3EE', '#84CC16', '#A78BFA']

export function agentColor(agent: string): string {
  const known = AGENT_COLORS[agent]
  if (known) return known
  let hash = 0
  for (const char of agent) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return FALLBACK_COLORS[hash % FALLBACK_COLORS.length] as string
}

export function vendorColor(vendor: string): string {
  return VENDOR_COLORS[vendor] ?? (VENDOR_COLORS.Other as string)
}

export function byVendor(rows: UsageHourRow[]) {
  return groups(rows, (row) => vendorOf(row.model)).map((row) => ({ ...row, vendor: row.id }))
}

export function byDay(rows: UsageHourRow[], range: UsageRange | number, now: Date) {
  const end = dateKey(now)
  const first =
    rows
      .filter((row) => row.date <= end)
      .map((row) => row.date)
      .sort()[0] ?? end
  const start =
    range === 'all'
      ? new Date(`${first}T12:00:00`)
      : shiftDay(now, 1 - (typeof range === 'number' ? range : Number.parseInt(range, 10)))
  const grouped = new Map<string, UsageHourRow[]>()
  for (const row of rows) {
    const entries = grouped.get(row.date)
    if (entries) entries.push(row)
    else grouped.set(row.date, [row])
  }
  const days = []
  for (let day = start; dateKey(day) <= end; day = shiftDay(day, 1)) {
    const date = dateKey(day)
    const entries = grouped.get(date) ?? []
    const pairs = groups(entries, (row) => JSON.stringify([row.model, row.agent]))
    days.push({
      date,
      ...kpis(entries),
      models: pairs.map((row) => {
        const [model, agent] = JSON.parse(row.id) as [string, string]
        return { ...row, model, agent }
      }),
    })
  }
  return days
}

export function weekHourGrid(rows: UsageHourRow[]) {
  const cells = Array.from({ length: 7 }, (_, day) =>
    Array.from({ length: 24 }, (_, hour) => ({
      day,
      hour,
      runs: 0,
      turns: 0,
      tokens: 0,
      usd: 0,
      activeMs: 0,
      unpriced: false,
    })),
  )
  for (const row of rows) {
    const day = (new Date(`${row.date}T12:00:00`).getDay() + 6) % 7
    const cell = cells[day]?.[row.hour]
    if (!cell) continue
    cell.runs += row.runs
    cell.turns += row.turns
    cell.tokens += row.inputTokens + row.cacheReadTokens + row.cacheWriteTokens + row.outputTokens
    cell.usd += row.usd ?? 0
    cell.activeMs += row.activeMs
    cell.unpriced ||= row.usd === null || !row.priced
  }
  const max = cells
    .flat()
    .reduce(
      (best, cell) => (cell.tokens > (best?.tokens ?? 0) ? cell : best),
      null as (typeof cells)[number][number] | null,
    )
  return { cells, max }
}

export function yearActivity(
  rows: UsageHourRow[],
  legacy: UsageRow[],
  agent: string | null,
  now: Date,
) {
  const selected = rows.filter((row) => !agent || row.agent === agent)
  const days = byDay(selected, 371, now)
  const dates = new Set(days.map((day) => day.date))
  const providers = new Set(selected.map((row) => row.provider))
  const total = legacy
    .filter((row) => dates.has(row.date) && (!agent || providers.has(row.provider ?? '')))
    .reduce((sum, row) => sum + row.runs, 0)
  return { days, total }
}

export function dayChartStats(days: UsageDay[]) {
  const activeDays = days.filter(
    (day) => day.runs > 0 || day.turns > 0 || day.inputTokens + day.outputTokens > 0,
  ).length
  return {
    activeDays,
    tokensPerDay: days.length
      ? days.reduce((sum, day) => sum + day.inputTokens + day.outputTokens, 0) / days.length
      : 0,
    maxInput: Math.max(1, ...days.map((day) => day.inputTokens)),
    maxOutput: Math.max(1, ...days.map((day) => day.outputTokens)),
    maxima: {
      usd: Math.max(0, ...days.map((day) => day.usd)) || 1,
      runs: Math.max(1, ...days.map((day) => day.runs)),
      inputTokens: Math.max(1, ...days.map((day) => day.inputTokens)),
      outputTokens: Math.max(1, ...days.map((day) => day.outputTokens)),
      activeMs: Math.max(1, ...days.map((day) => day.activeMs)),
    },
  }
}

export function formatTokens(value: number): string {
  for (const [unit, size] of [
    ['B', 1e9],
    ['M', 1e6],
    ['K', 1e3],
  ] as const) {
    if (Math.abs(value) >= size) return `${(value / size).toFixed(1)}${unit}`
  }
  return String(Math.round(value))
}

export function formatUsd(value: number): string {
  return `$${value.toFixed(Math.abs(value) > 0 && Math.abs(value) < 1 ? 3 : 2)}`
}

export function formatDuration(ms: number): string {
  return ms < 3_600_000 ? `${Math.round(ms / 60_000)} min` : `${(ms / 3_600_000).toFixed(1)} h`
}
