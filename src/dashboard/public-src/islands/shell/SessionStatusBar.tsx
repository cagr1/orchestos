import { useEffect, useState } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover.tsx'
import { Icon } from '../../lib/icons.tsx'
import { useT } from '../../lib/i18n.ts'

interface RateLimitWindow { id: string; usedPct: number; remainingPct?: number; windowMinutes: number | null; resetsAt: number | null }
interface CliStatus {
  id: 'claude' | 'codex' | 'opencode' | 'kimi'; label: string; binary: string; installed: boolean; available: boolean; observedAt: string | null
  context: { used: number; window: number; model: string | null; pct: number; level: 'ok' | 'warn' | 'critical'; source: string } | null
  rateLimits: { source: string; windows: RateLimitWindow[] } | null
}
interface SessionStatus { available: boolean; clis: CliStatus[] }
const EMPTY_STATUS: SessionStatus = { available: false, clis: [] }
const ICONS: Record<CliStatus['id'], string> = { claude: 'spark', codex: 'term', opencode: 'term', kimi: 'chat' }

export function SessionStatusBar() {
  const t = useT(); const [status, setStatus] = useState<SessionStatus>(EMPTY_STATUS); const [reachable, setReachable] = useState(true)
  useEffect(() => {
    let disposed = false; let activeRequest: AbortController | null = null
    const refresh = async () => {
      activeRequest?.abort(); activeRequest = new AbortController()
      try { const response = await fetch('/api/session/status', { signal: activeRequest.signal }); if (!response.ok) throw new Error(String(response.status)); const next = await response.json() as SessionStatus; if (!disposed) { setStatus(next); setReachable(true) } }
      catch (error) { if (!disposed && !(error instanceof DOMException && error.name === 'AbortError')) setReachable(false) }
    }
    void refresh(); const timer = window.setInterval(refresh, 5_000)
    return () => { disposed = true; activeRequest?.abort(); window.clearInterval(timer) }
  }, [])
  return <section className="session-statusbar-inner" aria-label={t('session.status.label')}>
    <span className={`session-statusbar-live${reachable ? '' : ' offline'}`} aria-hidden="true" />
    <div className="session-statusbar-clis">{status.clis.map((cli) => <CliStatusItem key={cli.id} cli={cli} t={t} />)}</div>
    {status.clis.length === 0 && <span className="session-statusbar-empty">{t('session.status.none')}</span>}
  </section>
}

function CliStatusItem({ cli, t }: { cli: CliStatus; t: (key: string, ...args: unknown[]) => string }) {
  const remaining = cli.context ? Math.max(0, 100 - cli.context.pct) : null; const tone = cli.context?.level ?? 'idle'
  return <Popover><PopoverTrigger asChild><button type="button" className="session-statusbar-cli" data-tone={tone} data-available={cli.available} aria-label={`${cli.label}: ${remaining === null ? t('session.status.unavailable') : `${formatPercent(remaining)}%`}`}>
    <span className="session-statusbar-cli-icon"><Icon name={ICONS[cli.id]} /><span className="session-statusbar-cli-monogram">{cli.label.slice(0, 1)}</span></span><span className="session-statusbar-cli-track" aria-hidden="true"><span className="session-statusbar-cli-fill" style={{ width: `${remaining ?? 0}%` }} /></span><span className="session-statusbar-cli-value">{remaining === null ? '—' : `${formatPercent(remaining)}%`}</span>
  </button></PopoverTrigger><PopoverContent className="session-statusbar-popover" align="end" side="top" sideOffset={10}>
    <div className="session-statusbar-popover-heading"><span className="session-statusbar-popover-icon"><Icon name={ICONS[cli.id]} /><span className="session-statusbar-cli-monogram">{cli.label.slice(0, 1)}</span></span><div><strong>{cli.label}</strong><small>{cli.installed ? cli.binary : t('session.status.unavailable')}</small></div><span className={`session-statusbar-popover-dot${cli.available ? '' : ' offline'}`} aria-hidden="true" /></div>
    {cli.context ? <><Detail label={t('session.status.context')} value={`${formatPercent(remaining ?? 0)}% ${t('session.status.remaining')}`} /><Detail label="Model" value={cli.context.model ?? t('session.status.unavailable')} /><Detail label="Tokens" value={`${formatNumber(cli.context.used)} / ${formatNumber(cli.context.window)}`} />{cli.rateLimits?.windows.map((window) => <Detail key={window.id} label={`${t('session.status.quota')} · ${formatWindow(window.windowMinutes)}`} value={`${formatPercent(window.remainingPct ?? 100 - window.usedPct)}% ${t('session.status.remaining')}`} detail={resetTitle(window.resetsAt, t('session.status.resets'))} />)}{cli.observedAt && <small className="session-statusbar-observed">{formatObserved(cli.observedAt)}</small>}</> : <p className="session-statusbar-unavailable">{cli.installed ? t('session.status.none') : t('session.status.unavailable')}</p>}
  </PopoverContent></Popover>
}
function Detail({ label, value, detail }: { label: string; value: string; detail?: string }) { return <div className="session-statusbar-detail"><span>{label}</span><strong>{value}</strong>{detail && <small>{detail}</small>}</div> }
function formatPercent(value: number): string { return value.toLocaleString(undefined, { maximumFractionDigits: 1 }) }
function formatNumber(value: number): string { return value.toLocaleString(undefined, { notation: 'compact', maximumFractionDigits: 1 }) }
function formatWindow(minutes: number | null): string { if (minutes === null) return ''; if (minutes % 1_440 === 0) return `${minutes / 1_440}d`; if (minutes % 60 === 0) return `${minutes / 60}h`; return `${minutes}m` }
function resetTitle(epochSeconds: number | null, label: string): string | undefined { return epochSeconds === null ? undefined : `${label} ${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(epochSeconds * 1_000))}` }
function formatObserved(value: string): string { return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(value)) }
