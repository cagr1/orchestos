import type React from 'react'
import { useEffect, useState } from 'react'
import { ProviderLogo } from '../common/ProviderLogos'

interface CliStatus {
  id: string
  label: string
  binary: string
  installed: boolean
  available: boolean
  context: {
    used: number
    window: number
    pct: number
    level: 'ok' | 'warn' | 'critical'
    model: string | null
  } | null
}

interface SessionStatus {
  available: boolean
  clis: CliStatus[]
}

export const SessionStatusBar: React.FC = () => {
  const [status, setStatus] = useState<SessionStatus>({ available: false, clis: [] })
  const [reachable, setReachable] = useState(true)

  useEffect(() => {
    let disposed = false
    const refresh = async () => {
      try {
        const response = await fetch('/api/session/status')
        if (!response.ok) throw new Error(String(response.status))
        const next = (await response.json()) as SessionStatus
        if (!disposed) {
          setStatus(next)
          setReachable(true)
        }
      } catch {
        if (!disposed) setReachable(false)
      }
    }
    void refresh()
    const timer = window.setInterval(refresh, 5_000)
    return () => {
      disposed = true
      window.clearInterval(timer)
    }
  }, [])

  const installed = status.clis.filter((cli) => cli.installed)
  return (
    <footer
      className="flex min-h-[30px] items-center gap-2 border-t border-app bg-app-surface px-3 py-1 font-mono text-[11px] text-app-muted"
      aria-label="Session status"
    >
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${reachable ? 'bg-app-success' : 'bg-app-error'}`}
        aria-hidden="true"
      />
      <div className="flex items-center gap-1.5 overflow-x-auto">
        {installed.map((cli) => {
          const remaining = cli.context ? Math.max(0, 100 - cli.context.pct) : null
          const toneClass =
            cli.context?.level === 'critical'
              ? 'bg-app-error'
              : cli.context?.level === 'warn'
                ? 'bg-app-warning'
                : 'bg-app-accent'
          return (
            <details key={cli.id} className="relative">
              <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-control border border-transparent px-1.5 py-0.5 text-app hover:border-app hover:bg-app-elevated [&::-webkit-details-marker]:hidden">
                <ProviderLogo id={cli.id} className="w-3.5 h-3.5" />
                <span className="h-1 w-11 overflow-hidden rounded-pill bg-app-elevated">
                  <span
                    className={`block h-full rounded-pill ${toneClass}`}
                    style={{ width: `${remaining ?? 0}%` }}
                  />
                </span>
                <span>
                  {remaining === null
                    ? '—'
                    : `${remaining.toLocaleString([], { maximumFractionDigits: 1 })}%`}
                </span>
              </summary>
              <div className="absolute bottom-7 left-0 z-20 grid min-w-[190px] gap-1 rounded-card border border-app bg-app-elevated p-2.5 text-app shadow-2xl">
                <strong>{cli.label}</strong>
                <small className="text-app-muted">{cli.binary}</small>
                <span className="text-app-muted">
                  {remaining === null ? 'Unavailable' : `${remaining}% context remaining`}
                </span>
                {cli.context?.model && (
                  <span className="text-app-muted">Model: {cli.context.model}</span>
                )}
              </div>
            </details>
          )
        })}
      </div>
      {installed.length === 0 && <span className="whitespace-nowrap">No CLI status available</span>}
    </footer>
  )
}
