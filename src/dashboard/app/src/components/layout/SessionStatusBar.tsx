import type React from 'react'
import { useEffect, useRef, useState } from 'react'
import type { SessionCliStatus, SessionStatus } from '../../types/orchestos'
import { ProviderLogo } from '../common/ProviderLogos'

interface SessionStatusBarProps {
  status?: SessionStatus | null
}

function formatPercent(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 1 })
}

function formatWindow(minutes: number | null): string {
  if (minutes === null) return '—'
  if (minutes === 300) return '5h'
  if (minutes === 10080) return '7d'
  return `${minutes}m`
}

function resetTitle(epochSeconds: number | null): string | undefined {
  if (epochSeconds === null) return undefined
  return `Resets ${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(epochSeconds * 1000))}`
}

function isExpired(epochSeconds: number | null): boolean {
  return epochSeconds !== null && epochSeconds * 1000 <= Date.now()
}

function quotaRemaining(
  quota: SessionCliStatus['rateLimits'] extends { windows: (infer Window)[] } | null
    ? Window
    : never,
): number | null {
  if (quota.resetsAt !== null && quota.resetsAt * 1000 <= Date.now()) return null
  return Math.max(0, quota.remainingPct ?? 100 - quota.usedPct)
}

function windowFor(cli: SessionCliStatus, minutes: number) {
  return cli.rateLimits?.windows.find((window) => window.windowMinutes === minutes) ?? null
}

function CliStatusItem({ cli }: { cli: SessionCliStatus }) {
  const [open, setOpen] = useState(false)
  const itemRef = useRef<HTMLDivElement>(null)
  const windows = (cli.rateLimits?.windows ?? []).filter(
    (window) => window.windowMinutes === 300 || window.windowMinutes === 10080,
  )
  const fiveHour = windowFor(cli, 300)
  const fiveHourRemaining = fiveHour ? quotaRemaining(fiveHour) : null

  useEffect(() => {
    if (!open) return
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!itemRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  return (
    <div ref={itemRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex h-[26px] cursor-pointer items-center gap-1.5 rounded-control border border-transparent px-1.5 text-app-muted hover:border-app hover:bg-app-elevated"
        aria-expanded={open}
        aria-label={`${cli.label}: ${fiveHourRemaining === null ? 'unavailable' : `${formatPercent(fiveHourRemaining)}%`}`}
      >
        <span className="flex h-[17px] w-[17px] items-center justify-center text-app-accent">
          <ProviderLogo id={cli.icon || cli.id} className="h-[15px] w-[15px]" />
        </span>
        <span
          className="h-[3px] w-11 overflow-hidden rounded-pill bg-app-elevated"
          aria-hidden="true"
        >
          <span
            className="block h-full rounded-pill bg-app-accent"
            style={{ width: `${fiveHourRemaining ?? 0}%` }}
          />
        </span>
        <span className="font-mono text-[11px] text-app">
          {fiveHourRemaining === null ? '—' : `${formatPercent(fiveHourRemaining)}%`}
        </span>
      </button>
      {open && (
        <div className="absolute bottom-full left-0 z-50 mb-2 grid w-[260px] gap-2 rounded-card border border-app bg-app-elevated p-3 text-app shadow-2xl">
          <div className="flex items-center gap-2 border-b border-app pb-2">
            <span className="flex h-[17px] w-[17px] items-center justify-center text-app-accent">
              <ProviderLogo id={cli.icon || cli.id} className="h-[15px] w-[15px]" />
            </span>
            <div className="min-w-0 flex-1">
              <strong className="block text-xs">{cli.label}</strong>
              <small className="block truncate text-[11px] text-app-muted">
                {cli.installed ? cli.binary : 'Unavailable'}
              </small>
            </div>
            <span
              className={`h-1.5 w-1.5 rounded-pill ${cli.available ? 'bg-app-success' : 'bg-app-muted'}`}
              aria-hidden="true"
            />
          </div>
          {windows.length === 0 ? (
            <span className="text-xs text-app-muted">No quota data</span>
          ) : (
            windows.map((window) => {
              const expired = isExpired(window.resetsAt)
              const value = expired ? null : quotaRemaining(window)
              return (
                <div key={`${window.id}-${window.windowMinutes}`} className="grid gap-1 text-xs">
                  <div className="flex justify-between gap-3 text-app-muted">
                    <span>{formatWindow(window.windowMinutes)}</span>
                    <span>{value === null ? '—' : `${formatPercent(value)}% remaining`}</span>
                  </div>
                  {value !== null && (
                    <div className="h-1.5 overflow-hidden rounded-pill bg-app-bg">
                      <div
                        className="h-full rounded-pill bg-app-accent"
                        style={{ width: `${value}%` }}
                      />
                    </div>
                  )}
                  <span className="text-[10px] text-app-muted">
                    {expired
                      ? `No data since ${formatDate(window.resetsAt)}`
                      : resetTitle(window.resetsAt)}
                  </span>
                </div>
              )
            })
          )}
          {cli.observedAt && (
            <small className="text-right text-[10px] text-app-muted">
              Observed {formatDate(cli.observedAt)}
            </small>
          )}
        </div>
      )}
    </div>
  )
}

function formatDate(value: number | string | null): string {
  if (value === null) return '—'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
    typeof value === 'number' ? new Date(value * 1000) : new Date(value),
  )
}

export const SessionStatusBar: React.FC<SessionStatusBarProps> = ({ status }) => {
  const installed = status?.clis.filter((cli) => cli.installed) ?? []
  return (
    <section
      className="flex min-h-[30px] items-center gap-2 border-t border-app bg-app-surface px-3 py-1 font-mono text-[11px] text-app-muted"
      aria-label="Session status"
    >
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${status?.available ? 'bg-app-success' : 'bg-app-error'}`}
        aria-hidden="true"
      />
      <div className="flex items-center gap-1.5 overflow-visible">
        {installed.map((cli) => (
          <CliStatusItem key={cli.id} cli={cli} />
        ))}
      </div>
      {installed.length === 0 && <span className="whitespace-nowrap">No CLI status available</span>}
    </section>
  )
}
