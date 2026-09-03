import { useEffect, useState } from 'react'
import { useT } from '../../lib/i18n.ts'

interface RateLimitWindow {
  id: string
  usedPct: number
  windowMinutes: number | null
  resetsAt: number | null
}

interface SessionStatus {
  available: boolean
  observedAt: string | null
  context: {
    pct: number
    level: 'ok' | 'warn' | 'critical'
    source: string
  } | null
  rateLimits: { source: string; windows: RateLimitWindow[] } | null
}

const EMPTY_STATUS: SessionStatus = {
  available: false,
  observedAt: null,
  context: null,
  rateLimits: null,
}

export function SessionStatusBar() {
  const t = useT()
  const [status, setStatus] = useState<SessionStatus>(EMPTY_STATUS)
  const [reachable, setReachable] = useState(true)

  useEffect(() => {
    let disposed = false
    let activeRequest: AbortController | null = null

    const refresh = async () => {
      activeRequest?.abort()
      activeRequest = new AbortController()
      try {
        const response = await fetch('/api/session/status', { signal: activeRequest.signal })
        if (!response.ok) throw new Error(String(response.status))
        const next = (await response.json()) as SessionStatus
        if (!disposed) {
          setStatus(next)
          setReachable(true)
        }
      } catch (error) {
        if (!disposed && !(error instanceof DOMException && error.name === 'AbortError')) {
          setReachable(false)
        }
      }
    }

    void refresh()
    const timer = window.setInterval(refresh, 5_000)
    return () => {
      disposed = true
      activeRequest?.abort()
      window.clearInterval(timer)
    }
  }, [])

  const source = status.context?.source ?? status.rateLimits?.source
  const contextTone = status.context?.level ?? 'idle'

  return (
    <section className="session-statusbar-inner" aria-label={t('session.status.label')}>
      <Metric
        label={t('session.status.context')}
        value={status.context ? status.context.pct : null}
        tone={contextTone}
        unavailableLabel={t('session.status.unavailable')}
      />

      <span className="session-statusbar-divider" aria-hidden="true" />

      {status.rateLimits?.windows.length ? (
        status.rateLimits.windows.map((window) => (
          <Metric
            key={window.id}
            label={`${t('session.status.quota')} ${formatWindow(window.windowMinutes)}`}
            value={window.usedPct}
            title={resetTitle(window.resetsAt, t('session.status.resets'))}
            tone="quota"
            unavailableLabel={t('session.status.unavailable')}
          />
        ))
      ) : (
        <Metric
          label={t('session.status.quota')}
          value={null}
          tone="idle"
          unavailableLabel={t('session.status.unavailable')}
        />
      )}

      <span className="session-statusbar-spacer" />
      <span className="session-statusbar-source">
        <span
          className={`session-statusbar-live${reachable ? '' : ' offline'}`}
          aria-hidden="true"
        />
        {source ?? t(reachable ? 'session.status.none' : 'session.status.offline')}
      </span>
      {status.observedAt && (
        <time className="session-statusbar-time" dateTime={status.observedAt}>
          {new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(
            new Date(status.observedAt),
          )}
        </time>
      )}
    </section>
  )
}

function Metric({
  label,
  value,
  tone,
  title,
  unavailableLabel,
}: {
  label: string
  value: number | null
  tone: 'ok' | 'warn' | 'critical' | 'quota' | 'idle'
  title?: string
  unavailableLabel: string
}) {
  const safeValue = value === null ? 0 : Math.max(0, Math.min(100, value))
  return (
    <div
      className="session-statusbar-metric"
      data-tone={tone}
      title={title}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value === null ? undefined : Math.round(safeValue)}
      aria-valuetext={value === null ? unavailableLabel : `${formatPercent(value)}%`}
    >
      <span className="session-statusbar-label">{label}</span>
      <span className="session-statusbar-track" aria-hidden="true">
        <span className="session-statusbar-fill" style={{ width: `${safeValue}%` }} />
      </span>
      <span className="session-statusbar-value">
        {value === null ? '—' : `${formatPercent(value)}%`}
      </span>
    </div>
  )
}

function formatPercent(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 1 })
}

function formatWindow(minutes: number | null): string {
  if (minutes === null) return ''
  if (minutes % 1_440 === 0) return `${minutes / 1_440}d`
  if (minutes % 60 === 0) return `${minutes / 60}h`
  return `${minutes}m`
}

function resetTitle(epochSeconds: number | null, label: string): string | undefined {
  if (epochSeconds === null) return undefined
  return `${label} ${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(epochSeconds * 1_000))}`
}
