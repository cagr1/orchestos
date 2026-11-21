import { animate, motion } from 'motion/react'
import { type ReactNode, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion'
import { spring } from '@/lib/springs'
import {
  byAgent,
  byDay,
  byModel,
  byVendor,
  dayChartStats,
  delta,
  filterRows,
  formatDuration,
  formatTokens,
  formatUsd,
  kpis,
  type UsageDay,
  type UsageRange,
  weekHourGrid,
  yearActivity,
} from '@/lib/usage-stats'
import type { UsageResponse } from '../../api/settings'
import { SettingsGroup, SettingsSegmented } from './primitives'

const levels = [
  'bg-app-elevated',
  'bg-app-accent/20',
  'bg-app-accent/45',
  'bg-app-accent/70',
  'bg-app-accent',
]
const vendorLevels = [
  'bg-app-accent',
  'bg-app-accent/70',
  'bg-app-accent/45',
  'bg-app-accent/20',
  'bg-app-muted/60',
  'bg-app-muted/30',
]
const focusClass =
  'outline-none focus-visible:ring-2 focus-visible:ring-app-accent focus-visible:ring-offset-1'
const intensity = (value: number, maximum: number) =>
  value === 0 ? 0 : Math.min(4, Math.max(1, Math.ceil((value / Math.max(1, maximum)) * 4)))
const localeOf = (es: boolean) => (es ? 'es-ES' : 'en-US')
const dayDate = (date: string) => new Date(`${date}T12:00:00`)
const longDate = (date: string, es: boolean) =>
  dayDate(date).toLocaleDateString(localeOf(es), {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
const shortDate = (date: string, es: boolean) =>
  dayDate(date).toLocaleDateString(localeOf(es), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

function daySummary(day: UsageDay, es: boolean) {
  return `${longDate(day.date, es)} · ${formatUsd(day.usd)}${day.unpriced ? (es ? ' + sin precio' : ' + unpriced') : ''} · ${day.runs} runs · ${day.turns} ${es ? 'turnos' : 'turns'} · input ${formatTokens(day.inputTokens)} (${Math.round(day.cachePct)} % ${es ? 'de caché' : 'cached'}) · output ${formatTokens(day.outputTokens)} · ~${formatDuration(day.activeMs)}`
}

function DayDetails({ day, es }: { day: UsageDay; es: boolean }) {
  const active =
    day.runs || day.turns || day.inputTokens || day.outputTokens || day.usd || day.activeMs
  return (
    <div className="space-y-2">
      <div className="font-medium">
        <span className="capitalize">
          {dayDate(day.date).toLocaleDateString(localeOf(es), { weekday: 'long' })}
        </span>
        {' · '}
        {shortDate(day.date, es)}
      </div>
      {active ? (
        <>
          <div className="flex justify-between gap-5">
            <span>{es ? 'Gasto' : 'Spend'}</span>
            <span>
              {formatUsd(day.usd)}
              {day.unpriced ? (es ? ' + sin precio' : ' + unpriced') : ''}
            </span>
          </div>
          <div>
            {day.runs} runs · {day.turns} {es ? 'turnos' : 'turns'}
          </div>
          <div>
            Input {formatTokens(day.inputTokens)} · {Math.round(day.cachePct)} %{' '}
            {es ? 'de caché' : 'cached'}
          </div>
          <div>
            Output {formatTokens(day.outputTokens)} · ~{formatDuration(day.activeMs)}
          </div>
          <div className="space-y-1 border-t border-current/20 pt-2">
            {day.models.slice(0, 5).map((model) => (
              <div key={`${model.model}-${model.agent}`} className="text-[10px]">
                <span className="font-mono break-all">{model.model}</span> · {model.agent} —{' '}
                {model.runs} runs · {formatUsd(model.usd)}
                {model.unpriced ? ' +' : ''} ·{' '}
                {formatTokens(model.inputTokens + model.outputTokens)} tokens
              </div>
            ))}
            {day.models.length > 5 && (
              <div>
                +{day.models.length - 5} {es ? 'más' : 'more'}
              </div>
            )}
          </div>
        </>
      ) : (
        <div>{es ? 'Sin actividad' : 'No activity'}</div>
      )}
    </div>
  )
}

type HoverBinding = (
  content: ReactNode,
  label: string,
) => {
  tabIndex: number
  'aria-label': string
  'aria-describedby': string
  onMouseEnter: (event: React.MouseEvent<HTMLElement>) => void
  onMouseLeave: () => void
  onFocus: (event: React.FocusEvent<HTMLElement>) => void
  onBlur: () => void
  onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => void
}

// A single persistent card per chart; measuring the target avoids per-cell tooltip mounts.
function HoverChart({
  children,
  heatmap = false,
}: {
  children: (bind: HoverBinding) => ReactNode
  heatmap?: boolean
}) {
  const id = useId()
  const reduce = usePrefersReducedMotion()
  const card = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<{
    content: ReactNode
    x: number
    y: number
    visible: boolean
  } | null>(null)
  const hide = () => setHover((value) => (value ? { ...value, visible: false } : null))
  useEffect(() => {
    const hideOnScroll = () =>
      setHover((value) => (value?.visible ? { ...value, visible: false } : value))
    window.addEventListener('scroll', hideOnScroll, true)
    window.addEventListener('resize', hideOnScroll)
    return () => {
      window.removeEventListener('scroll', hideOnScroll, true)
      window.removeEventListener('resize', hideOnScroll)
    }
  }, [])
  const bind: HoverBinding = (content, label) => {
    const show = (event: React.MouseEvent<HTMLElement> | React.FocusEvent<HTMLElement>) => {
      const rect = event.currentTarget.getBoundingClientRect()
      const width = card.current?.getBoundingClientRect().width || 320
      const height = card.current?.getBoundingClientRect().height || 300
      setHover({
        content,
        visible: true,
        x: Math.max(8, Math.min(rect.left, window.innerWidth - width - 8)),
        y:
          rect.bottom + height + 8 < window.innerHeight
            ? rect.bottom + 8
            : Math.max(8, rect.top - height - 8),
      })
    }
    return {
      tabIndex: 0,
      'aria-label': label,
      'aria-describedby': id,
      onMouseEnter: show,
      onMouseLeave: hide,
      onFocus: show,
      onBlur: hide,
      onKeyDown: (event) => {
        if (event.key === 'Escape') hide()
      },
    }
  }
  return (
    <>
      {children(bind)}
      {createPortal(
        <motion.div
          ref={card}
          id={id}
          role="tooltip"
          data-heatmap-tooltip={heatmap ? '' : undefined}
          aria-hidden={!hover?.visible}
          initial={false}
          animate={{ opacity: hover?.visible ? 1 : 0, x: hover?.x ?? 0, y: hover?.y ?? 0 }}
          transition={
            reduce
              ? { duration: 0 }
              : {
                  x: spring.moderate,
                  y: spring.moderate,
                  opacity: hover?.visible ? spring.fast : spring.fast.exit,
                }
          }
          className="pointer-events-none fixed left-0 top-0 z-50 w-80 max-w-[calc(100vw-16px)] rounded-card bg-foreground px-3 py-2 text-xs text-background shadow-lg tabular-nums"
        >
          {hover?.content}
        </motion.div>,
        document.body,
      )}
    </>
  )
}

function Legend({ es }: { es: boolean }) {
  return (
    <div className="flex items-center gap-1 text-[10px] text-app-muted">
      <span>{es ? 'menos' : 'less'}</span>
      {levels.map((level) => (
        <span key={level} className={`size-2.5 rounded-xs ${level}`} />
      ))}
      <span>{es ? 'más' : 'more'}</span>
    </div>
  )
}

function AnnualActivity({
  usage,
  agent,
  now,
  es,
}: {
  usage: UsageResponse
  agent: string | null
  now: Date
  es: boolean
}) {
  const reduce = usePrefersReducedMotion()
  const scroll = useRef<HTMLDivElement>(null)
  const totalRef = useRef(0)
  const [animatedTotal, setAnimatedTotal] = useState(0)
  const { days, total } = yearActivity(usage.byHour, usage.byDayModel, agent, now)
  useEffect(() => {
    if (scroll.current) scroll.current.scrollLeft = scroll.current.scrollWidth
  }, [])
  useEffect(() => {
    if (reduce) {
      totalRef.current = total
      setAnimatedTotal(total)
      return
    }
    const animation = animate(totalRef.current, total, {
      ...spring.slow,
      onUpdate: (value) => {
        totalRef.current = value
        setAnimatedTotal(Math.round(value))
      },
    })
    return () => animation.stop()
  }, [reduce, total])
  return (
    <SettingsGroup>
      <div data-settings-anchor="usage-activity" className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <h2 className="font-medium text-app">{es ? 'Actividad del año' : 'Yearly activity'}</h2>
            <span data-heatmap-total className="tabular-nums text-app-muted">
              {reduce ? total : animatedTotal} {es ? 'ejecuciones' : 'runs'}
            </span>
          </div>
          <Legend es={es} />
        </div>
        <HoverChart heatmap>
          {(bind) => (
            <div className="relative">
              <div ref={scroll} className="overflow-x-auto pb-1">
                <div className="mb-1 grid grid-cols-[repeat(53,minmax(8px,1fr))] gap-[3px] text-[10px] text-app-muted">
                  {Array.from({ length: 53 }, (_, week) => {
                    const day = days[week * 7]
                    const previous = days[(week - 1) * 7]
                    return (
                      <span key={day.date}>
                        {!previous || day.date.slice(0, 7) !== previous.date.slice(0, 7)
                          ? dayDate(day.date).toLocaleDateString(localeOf(es), { month: 'short' })
                          : ''}
                      </span>
                    )
                  })}
                </div>
                <div
                  data-heatmap-grid
                  className="grid grid-cols-[repeat(53,minmax(8px,1fr))] gap-[3px]"
                >
                  {Array.from({ length: 53 }, (_, week) => (
                    <div key={days[week * 7].date} className="flex min-w-0 flex-col gap-[3px]">
                      {days.slice(week * 7, week * 7 + 7).map((day) => (
                        <motion.button
                          key={day.date}
                          type="button"
                          data-heatmap-cell
                          data-date={day.date}
                          initial={reduce ? false : { opacity: 0, scale: 0.6 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={
                            reduce
                              ? { duration: 0 }
                              : { ...spring.fast, delay: (week / 52) * spring.slow.duration * 2 }
                          }
                          className={`aspect-square w-full cursor-pointer rounded-[2px] transition-colors hover:ring-1 hover:ring-app-accent ${focusClass} ${levels[day.runs === 0 ? 0 : day.runs < 2 ? 1 : day.runs < 5 ? 2 : day.runs < 10 ? 3 : 4]}`}
                          {...bind(<DayDetails day={day} es={es} />, daySummary(day, es))}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </HoverChart>
      </div>
    </SettingsGroup>
  )
}

export function UsageDashboard({
  usage,
  loading,
  error,
  language,
}: {
  usage: UsageResponse | null
  loading: boolean
  error: string | null
  language: string
}) {
  const es = language === 'es'
  const [range, setRange] = useState<UsageRange>('30d')
  const [agent, setAgent] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const now = new Date()
  if (loading)
    return (
      <div
        role="status"
        aria-label={es ? 'Cargando uso' : 'Loading usage'}
        className="grid grid-cols-2 gap-3 xl:grid-cols-5 motion-safe:animate-pulse"
      >
        {['spend', 'runs', 'input', 'output', 'time'].map((key) => (
          <div key={key} className="h-36 rounded-card bg-app-surface p-4">
            <div className="h-3 w-16 rounded-control bg-app-elevated" />
            <div className="mt-4 h-7 w-24 rounded-control bg-app-elevated" />
            <div className="mt-4 h-5 rounded-control bg-app-elevated" />
          </div>
        ))}
      </div>
    )
  if (error)
    return (
      <p role="alert" className="text-xs text-app-muted">
        {error}
      </p>
    )
  if (!usage)
    return (
      <p className="text-xs text-app-muted">
        {es ? 'Sin actividad en este período' : 'No activity in this period'}
      </p>
    )
  const { current, previous } = filterRows(usage.byHour, { range, agent, now })
  const totals = kpis(current)
  const before = previous === null ? null : kpis(previous)
  const days = byDay(current, range, now)
  const chart = dayChartStats(days)
  const grid = weekHourGrid(current)
  const models = byModel(current)
  // La tabla de agentes ignora el filtro de agente: así se puede pasar de uno a otro.
  const agents = byAgent(filterRows(usage.byHour, { range, agent: null, now }).current)
  const vendors = byVendor(current).filter((vendor) => Math.round(vendor.share * 100) > 0)
  const weekdays = es
    ? ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']
    : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  const metrics = [
    {
      key: 'usd',
      title: es ? 'Gasto' : 'Spend',
      value: formatUsd(totals.usd),
      sub: `${formatUsd(totals.avgUsdPerRun)} ${es ? 'por run' : 'per run'}${totals.unpriced ? (es ? ' + sin precio' : ' + unpriced') : ''}`,
      anchor: 'usage-spend',
    },
    {
      key: 'runs',
      title: 'Runs',
      value: totals.runs.toLocaleString(localeOf(es)),
      sub: `${totals.turns.toLocaleString(localeOf(es))} ${es ? 'turnos' : 'turns'}`,
      anchor: 'usage-runs',
    },
    {
      key: 'inputTokens',
      title: 'Input',
      value: formatTokens(totals.inputTokens),
      sub: `${Math.round(totals.cachePct)} % ${es ? 'de caché' : 'cached'}`,
    },
    {
      key: 'outputTokens',
      title: 'Output',
      value: formatTokens(totals.outputTokens),
      sub: `${formatTokens(totals.outputPerTurn)} ${es ? 'por turno' : 'per turn'}`,
    },
    {
      key: 'activeMs',
      title: es ? 'Tiempo de agente' : 'Agent time',
      value: `~${formatDuration(totals.activeMs)}`,
      sub: es ? 'estimado' : 'estimated',
    },
  ] as const
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 text-xs text-app-muted">
          <span>
            {dayDate(days[0].date).toLocaleDateString(localeOf(es), {
              day: 'numeric',
              month: 'short',
            })}{' '}
            – {es ? 'hoy' : 'today'}
          </span>
          {agent && (
            <button
              type="button"
              onClick={() => setAgent(null)}
              aria-label={es ? 'Quitar filtro de agente' : 'Clear agent filter'}
              className={`rounded-control bg-app-elevated px-2 py-1 text-app ${focusClass}`}
            >
              {es ? 'Agente' : 'Agent'}: {agent} ×
            </button>
          )}
        </div>
        <SettingsSegmented<UsageRange>
          value={range}
          onChange={setRange}
          ariaLabel={es ? 'Período de uso' : 'Usage period'}
          options={[
            { value: '7d', label: '7 d' },
            { value: '30d', label: '30 d' },
            { value: '90d', label: '90 d' },
            { value: 'all', label: es ? 'Todo' : 'All' },
          ]}
        />
      </div>
      {current.length === 0 ? (
        <p className="py-6 text-sm text-app-muted">
          {es ? 'Sin actividad en este período' : 'No activity in this period'}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-5">
            {metrics.map((metric) => {
              const change = delta(totals[metric.key], before?.[metric.key] ?? null)
              const max = chart.maxima[metric.key]
              return (
                <SettingsGroup key={metric.key}>
                  <div
                    data-settings-anchor={'anchor' in metric ? metric.anchor : undefined}
                    className="space-y-2 p-4"
                  >
                    <div className="text-xs text-app-muted">{metric.title}</div>
                    <div className="text-2xl font-semibold tracking-tight tabular-nums text-app">
                      {metric.value}
                    </div>
                    <div
                      data-settings-anchor={metric.key === 'usd' ? 'usage-average' : undefined}
                      className="min-h-8 text-[11px] tabular-nums text-app-muted"
                    >
                      {metric.sub}
                    </div>
                    <HoverChart>
                      {(bind) => (
                        <div className="flex h-9 items-end gap-px">
                          {days.map((day) => (
                            <button
                              key={day.date}
                              type="button"
                              className={`relative h-full min-w-0 flex-1 ${focusClass}`}
                              {...bind(<DayDetails day={day} es={es} />, daySummary(day, es))}
                            >
                              <span
                                className="absolute inset-x-0 bottom-0 rounded-t-xs bg-app-accent/70"
                                style={{
                                  height: `${day[metric.key] > 0 ? Math.max(5, (day[metric.key] / max) * 100) : 0}%`,
                                }}
                              />
                            </button>
                          ))}
                        </div>
                      )}
                    </HoverChart>
                    <div className="min-h-4 text-[10px] tabular-nums text-app-muted">
                      {change === null
                        ? es
                          ? 'Sin comparación'
                          : 'No comparison'
                        : `${change < 0 ? '↓' : '↑'} ${Math.abs(change).toFixed(0)} % ${es ? 'vs. período anterior' : 'vs. previous period'}`}
                    </div>
                  </div>
                </SettingsGroup>
              )
            })}
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <SettingsGroup>
              <div className="space-y-4 p-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-medium text-app">
                    {es ? 'Tokens por día' : 'Tokens per day'}
                  </h2>
                  <div className="flex gap-3 text-[10px] text-app-muted">
                    <span className="flex items-center gap-1">
                      <i className="size-2 rounded-xs bg-app-accent" />
                      input
                    </span>
                    <span className="flex items-center gap-1">
                      <i className="size-2 rounded-xs bg-app-accent/40" />
                      output
                    </span>
                  </div>
                </div>
                <HoverChart>
                  {(bind) => (
                    <div className="relative flex h-44 gap-0.5">
                      <div aria-hidden className="absolute inset-x-0 top-1/2 border-t border-app" />
                      {days.map((day) => (
                        <button
                          type="button"
                          key={day.date}
                          className={`relative flex h-full min-w-0 flex-1 flex-col ${focusClass}`}
                          {...bind(<DayDetails day={day} es={es} />, daySummary(day, es))}
                        >
                          <span className="relative block h-1/2 w-full">
                            <span
                              className="absolute inset-x-0 bottom-0 rounded-t-xs bg-app-accent"
                              style={{ height: `${(day.inputTokens / chart.maxInput) * 100}%` }}
                            />
                          </span>
                          <span className="relative block h-1/2 w-full">
                            <span
                              className="absolute inset-x-0 top-0 rounded-b-xs bg-app-accent/40"
                              style={{ height: `${(day.outputTokens / chart.maxOutput) * 100}%` }}
                            />
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </HoverChart>
                <div className="flex justify-between text-[10px] text-app-muted">
                  <span>{shortDate(days[0].date, es)}</span>
                  <span>{shortDate(days[days.length - 1].date, es)}</span>
                </div>
                <p className="text-xs tabular-nums text-app-muted">
                  {chart.activeDays} {es ? 'de' : 'of'} {days.length}{' '}
                  {es ? 'días con actividad' : 'active days'} · {formatTokens(chart.tokensPerDay)}/
                  {es ? 'día' : 'day'}
                </p>
              </div>
            </SettingsGroup>
            <SettingsGroup>
              <div className="space-y-4 p-4">
                <h2 className="text-sm font-medium text-app">
                  {es ? 'Cuándo trabajan' : 'When they work'}
                </h2>
                <HoverChart>
                  {(bind) => (
                    <div className="overflow-x-auto">
                      <div className="min-w-72 space-y-1">
                        <div className="flex gap-1 text-[10px] text-app-muted">
                          <span className="w-4 shrink-0" />
                          <div className="grid flex-1 grid-cols-24 gap-1">
                            {Array.from({ length: 24 }, (_, hour) => (
                              <span key={String(hour)}>{hour % 6 === 0 ? hour : ''}</span>
                            ))}
                          </div>
                        </div>
                        {grid.cells.map((row, day) => (
                          <div key={weekdays[day]} className="flex items-center gap-1">
                            <span className="w-4 shrink-0 text-[10px] text-app-muted">
                              {
                                (es
                                  ? ['L', 'M', 'X', 'J', 'V', 'S', 'D']
                                  : ['M', 'T', 'W', 'T', 'F', 'S', 'S'])[day]
                              }
                            </span>
                            <div className="grid flex-1 grid-cols-24 gap-1">
                              {row.map((cell) => {
                                const label = `${weekdays[day]} ${cell.hour}–${cell.hour + 1} h · ${cell.runs} runs · ${formatTokens(cell.tokens)} tokens · ${formatUsd(cell.usd)}${cell.unpriced ? (es ? ' + sin precio' : ' + unpriced') : ''} · ~${formatDuration(cell.activeMs)}`
                                return (
                                  <button
                                    key={cell.hour}
                                    type="button"
                                    className={`aspect-square rounded-xs ${focusClass} ${levels[intensity(cell.tokens, grid.max?.tokens ?? 0)]}`}
                                    {...bind(label, label)}
                                  />
                                )
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </HoverChart>
                <div className="flex flex-wrap justify-between gap-2">
                  <Legend es={es} />
                  <span className="text-[10px] text-app-muted">
                    {grid.max
                      ? `${es ? 'Más activo' : 'Most active'}: ${weekdays[grid.max.day].slice(0, 3)} ${grid.max.hour} h`
                      : es
                        ? 'Sin actividad'
                        : 'No activity'}
                  </span>
                </div>
              </div>
            </SettingsGroup>
          </div>
        </>
      )}
      <AnnualActivity usage={usage} agent={agent} now={now} es={es} />
      {current.length > 0 && (
        <div className="grid items-start gap-4 xl:grid-cols-2">
          <SettingsGroup>
            <div data-settings-anchor="usage-models" className="space-y-4 p-4">
              <h2 className="text-sm font-medium text-app">{es ? 'Modelos' : 'Models'}</h2>
              <div className="flex h-2 overflow-hidden rounded-control bg-app-elevated" aria-hidden>
                {vendors.map((vendor, index) => (
                  <div
                    key={vendor.vendor}
                    className={vendorLevels[index % vendorLevels.length]}
                    style={{ width: `${vendor.share * 100}%` }}
                  />
                ))}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] tabular-nums text-app-muted">
                {vendors.map((vendor, index) => (
                  <span key={vendor.vendor} className="flex items-center gap-1">
                    <i
                      className={`size-2 rounded-xs ${vendorLevels[index % vendorLevels.length]}`}
                    />
                    {vendor.vendor} {Math.round(vendor.share * 100)} %
                  </span>
                ))}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs tabular-nums">
                  <thead className="text-[10px] text-app-muted">
                    <tr>
                      {[
                        es ? 'Modelo' : 'Model',
                        'Input',
                        'Output',
                        'Runs',
                        es ? 'Gasto' : 'Spend',
                      ].map((label) => (
                        <th key={label} className="px-1 py-2 font-normal">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(expanded ? models : models.slice(0, 6)).map((model) => (
                      <tr key={model.model} className="text-app-muted">
                        <td className="max-w-44 px-1 py-2">
                          <div className="break-all font-mono text-app">{model.model}</div>
                          <div className="mt-1 h-1 rounded-control bg-app-elevated">
                            <div
                              className="h-full rounded-control bg-app-accent/60"
                              style={{ width: `${model.share * 100}%` }}
                            />
                          </div>
                        </td>
                        <td className="px-1 py-2">{formatTokens(model.inputTokens)}</td>
                        <td className="px-1 py-2">{formatTokens(model.outputTokens)}</td>
                        <td className="px-1 py-2">{model.runs}</td>
                        <td className="whitespace-nowrap px-1 py-2 text-app">
                          {formatUsd(model.usd)}
                          {model.unpriced ? ' +' : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {models.length > 6 && (
                <button
                  type="button"
                  onClick={() => setExpanded(!expanded)}
                  aria-expanded={expanded}
                  className={`w-full rounded-control bg-app-elevated py-2 text-xs text-app-muted ${focusClass}`}
                >
                  {expanded
                    ? es
                      ? 'Ver menos'
                      : 'Show less'
                    : `${models.length - 6} ${es ? 'más' : 'more'}`}
                </button>
              )}
            </div>
          </SettingsGroup>
          <SettingsGroup>
            <div className="space-y-4 p-4">
              <h2 className="text-sm font-medium text-app">{es ? 'Agentes' : 'Agents'}</h2>
              <div className="overflow-x-auto">
                <div className="min-w-80">
                  <div className="grid grid-cols-[minmax(90px,1fr)_48px_48px_60px] gap-2 px-2 py-2 text-[10px] text-app-muted">
                    <span>{es ? 'Agente' : 'Agent'}</span>
                    <span>Input</span>
                    <span>Output</span>
                    <span>{es ? 'Tiempo' : 'Time'}</span>
                  </div>
                  {agents.map((row) => (
                    <button
                      type="button"
                      key={row.agent}
                      aria-pressed={row.agent === agent}
                      onClick={() => setAgent(agent === row.agent ? null : row.agent)}
                      className={`grid w-full grid-cols-[minmax(90px,1fr)_48px_48px_60px] items-center gap-2 rounded-control px-2 py-3 text-left text-xs tabular-nums text-app-muted transition-colors hover:bg-app-elevated ${focusClass} ${agent === row.agent ? 'bg-app-elevated ring-1 ring-app-accent/40' : ''}`}
                    >
                      <span>
                        <span className="text-app">{row.agent}</span>
                        <span className="mt-1 block h-1 rounded-control bg-app-elevated">
                          <span
                            className="block h-full rounded-control bg-app-accent/60"
                            style={{ width: `${row.share * 100}%` }}
                          />
                        </span>
                      </span>
                      <span>{formatTokens(row.inputTokens)}</span>
                      <span>{formatTokens(row.outputTokens)}</span>
                      <span>~{formatDuration(row.activeMs)}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </SettingsGroup>
        </div>
      )}
    </div>
  )
}
