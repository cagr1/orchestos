import { RefreshCw } from 'lucide-react'
import type React from 'react'
import { useEffect, useRef, useState } from 'react'
import type { SessionStatus } from '../../types/orchestos'
import { ProviderLogo } from '../common/ProviderLogos'

export interface CliQuotaInfo {
  id: string
  name: string
  quota5h: number | null // null if no data
  reset5h?: string
  quotaWeekly: number | null
  resetWeekly?: string
}

export function formatReset(epochSeconds: number | null): string | undefined {
  if (epochSeconds === null || epochSeconds * 1000 <= Date.now()) return undefined
  const date = new Date(epochSeconds * 1000)
  const hours = (epochSeconds * 1000 - Date.now()) / 3_600_000
  const format = new Intl.DateTimeFormat(undefined, {
    ...(hours > 24 ? { weekday: 'short', month: 'short', day: 'numeric' } : {}),
    hour: 'numeric',
    minute: 'numeric',
  })
  return `resets ${format.format(date)}`
}

function mapQuotas(status: SessionStatus | null): CliQuotaInfo[] {
  return (status?.clis ?? [])
    .filter((cli) => cli.installed)
    .map((cli) => {
      const windows = cli.rateLimits?.windows ?? []
      const fiveHour = windows.find((window) => window.windowMinutes === 300)
      const weekly = windows.find((window) => window.windowMinutes === 10080)
      const remaining = (window: typeof fiveHour) => {
        if (!window || (window.resetsAt !== null && window.resetsAt * 1000 <= Date.now()))
          return null
        return Math.max(0, window.remainingPct ?? 100 - window.usedPct)
      }
      return {
        id: cli.id,
        name: cli.label,
        quota5h: remaining(fiveHour),
        reset5h: formatReset(fiveHour?.resetsAt ?? null),
        quotaWeekly: remaining(weekly),
        resetWeekly: formatReset(weekly?.resetsAt ?? null),
      }
    })
}

interface ShellStatusBarProps {
  status?: SessionStatus | null
  refreshing?: boolean
  onRefresh?: () => void
}

export const ShellStatusBar: React.FC<ShellStatusBarProps> = ({
  status: incomingStatus,
  refreshing = false,
  onRefresh,
}) => {
  const [activeCliId, setActiveCliId] = useState<string | null>(null)
  const [status, setStatus] = useState<SessionStatus | null>(incomingStatus ?? null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => setStatus(incomingStatus ?? null), [incomingStatus])

  const quotas = mapQuotas(status)

  // Close floating panel on outside click and Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveCliId(null)
      }
    }

    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setActiveCliId(null)
      }
    }

    if (activeCliId) {
      document.addEventListener('keydown', handleKeyDown)
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [activeCliId])

  const activeCli = quotas.find((c) => c.id === activeCliId)

  return (
    <footer className="h-7 border-t border-app bg-app-bg px-3 flex items-center justify-between select-none text-xs flex-shrink-0 z-30 relative font-mono">
      {/* Installed CLIs list: product logo + thin bar + percent of its 5-hour quota remaining */}
      <div className="flex items-center gap-4">
        {quotas.map((cli) => {
          const hasData = cli.quota5h !== null || cli.quotaWeekly !== null
          const pct = hasData ? Math.round(cli.quota5h ?? cli.quotaWeekly ?? 0) : null

          return (
            <button
              key={cli.id}
              type="button"
              onClick={() => setActiveCliId(activeCliId === cli.id ? null : cli.id)}
              className={`flex items-center gap-1.5 py-0.5 px-1 rounded-control transition-colors ${
                activeCliId === cli.id
                  ? 'bg-app-elevated border border-app text-app'
                  : 'hover:bg-app-surface/60 text-app-muted hover:text-app'
              }`}
              title={`${cli.name}: ${hasData ? `${pct}% 5-hour quota remaining` : 'No quota limits reported'}`}
            >
              <ProviderLogo id={cli.id} size={14} className="w-3.5 h-3.5 flex-shrink-0" />
              <div className="w-12 h-1 bg-app-elevated rounded-pill overflow-hidden flex-shrink-0">
                {hasData && (
                  <div
                    className="h-full bg-app-accent rounded-pill transition-all"
                    style={{ width: `${pct}%` }}
                  />
                )}
              </div>
              <span className="text-[11px] text-app-muted">{hasData ? `${pct}%` : '—'}</span>
            </button>
          )
        })}
        {quotas.length > 0 && onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="p-1 rounded-control text-app-muted hover:text-app hover:bg-app-surface/60 transition-colors disabled:opacity-50"
            title="Refresh usage"
            aria-label="Refresh usage"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>

      {/* Floating Detail Panel (above the bar, not clipped) */}
      {activeCli && (
        <div
          ref={panelRef}
          className="absolute left-3 bottom-full mb-1.5 w-64 p-3 rounded-control bg-app-surface border border-app shadow-2xl z-50 text-app animate-in fade-in zoom-in-95 duration-100"
        >
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-app">
            <div className="flex items-center gap-2">
              <ProviderLogo id={activeCli.id} size={16} className="w-4 h-4 flex-shrink-0" />
              <span className="font-semibold text-xs font-sans text-app">{activeCli.name}</span>
            </div>
            <span className="text-[10px] text-app-muted">CLI Quotas</span>
          </div>

          {activeCli.quota5h !== null || activeCli.quotaWeekly !== null ? (
            <div className="space-y-3 font-sans">
              {/* 5-hour quota */}
              {activeCli.quota5h !== null && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-app-muted">5-hour quota</span>
                    <div className="flex items-center gap-1.5 font-mono text-[11px]">
                      <span className="font-semibold text-app">{activeCli.quota5h}%</span>
                      <span className="text-app-muted">·</span>
                      <span className="text-app-muted text-[10px]">{activeCli.reset5h}</span>
                    </div>
                  </div>
                  <div className="w-full h-1 bg-app-elevated rounded-pill overflow-hidden">
                    <div
                      className="h-full bg-app-accent rounded-pill"
                      style={{ width: `${activeCli.quota5h}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Weekly quota */}
              {activeCli.quotaWeekly !== null && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-app-muted">Weekly quota</span>
                    <div className="flex items-center gap-1.5 font-mono text-[11px]">
                      <span className="font-semibold text-app">{activeCli.quotaWeekly}%</span>
                      <span className="text-app-muted">·</span>
                      <span className="text-app-muted text-[10px]">{activeCli.resetWeekly}</span>
                    </div>
                  </div>
                  <div className="w-full h-1 bg-app-elevated rounded-pill overflow-hidden">
                    <div
                      className="h-full bg-app-accent/60 rounded-pill"
                      style={{ width: `${activeCli.quotaWeekly}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="hidden" aria-hidden="true" />
          )}
        </div>
      )}
    </footer>
  )
}
