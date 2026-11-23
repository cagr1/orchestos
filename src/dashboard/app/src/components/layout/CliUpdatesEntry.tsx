import { ArrowUpCircle, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { type CliUpdateEntry, getCliUpdates, updateProvider } from '../../api/settings'
import { ProviderLogo } from '../common/ProviderLogos'
import { Button } from '../ui/button'
import { cliUpdatesLabel, runCliUpdatesSequentially } from './cli-updates-helpers'

type Result = { ok: boolean; text: string; detail?: string }
const POLL_MS = 30 * 60_000
export function CliUpdatesEntry({
  onVisibilityChange,
}: {
  onVisibilityChange: (visible: boolean) => void
}) {
  const [clis, setClis] = useState<CliUpdateEntry[]>([])
  const [open, setOpen] = useState(false)
  const [running, setRunning] = useState<string | null>(null)
  const [results, setResults] = useState<Record<string, Result>>({})
  const [retained, setRetained] = useState<CliUpdateEntry[]>([])
  const root = useRef<HTMLDivElement>(null)
  const alive = useRef(false)
  const lastFetch = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const requestSeq = useRef(0)
  const lock = useRef(false)
  const popoverGeneration = useRef(0)
  const fetchStatus = useCallback(async function fetchStatus(attempt = 0) {
    const seq = ++requestSeq.current
    clearTimeout(timer.current)
    try {
      const snapshot = await getCliUpdates()
      if (!alive.current || seq !== requestSeq.current) return
      lastFetch.current = Date.now()
      setClis(snapshot.clis)
      clearTimeout(timer.current)
      timer.current = setTimeout(
        () => {
          void fetchStatus(snapshot.checking && attempt < 15 ? attempt + 1 : 0)
        },
        snapshot.checking && attempt < 15 ? 4_000 : POLL_MS,
      )
    } catch {
      if (!alive.current || seq !== requestSeq.current) return
      clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        void fetchStatus()
      }, POLL_MS)
    }
  }, [])
  useEffect(() => {
    alive.current = true
    void fetchStatus()
    const visible = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastFetch.current > POLL_MS)
        void fetchStatus()
    }
    document.addEventListener('visibilitychange', visible)
    return () => {
      alive.current = false
      clearTimeout(timer.current)
      document.removeEventListener('visibilitychange', visible)
    }
  }, [fetchStatus])
  const updates = clis.filter((cli) => cli.updateAvailable)
  const visible = updates.length > 0 || open
  useEffect(() => {
    onVisibilityChange(visible)
  }, [visible, onVisibilityChange])
  const close = useCallback(() => {
    popoverGeneration.current++
    setOpen(false)
    setResults({})
    setRetained([])
  }, [])
  useEffect(() => {
    if (!open) return
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    const outside = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) close()
    }
    document.addEventListener('keydown', key)
    document.addEventListener('mousedown', outside)
    return () => {
      document.removeEventListener('keydown', key)
      document.removeEventListener('mousedown', outside)
    }
  }, [open, close])
  async function update(cli: CliUpdateEntry) {
    if (!alive.current) return
    const generation = popoverGeneration.current
    setRunning(cli.id)
    let result: Result
    try {
      const response = await updateProvider(cli.id)
      result = response.ok
        ? { ok: true, text: `Updated to ${response.version ?? '—'}` }
        : { ok: false, text: 'Update failed', detail: response.output }
    } catch (error) {
      result = {
        ok: false,
        text: 'Update failed',
        detail: error instanceof Error ? error.message : String(error),
      }
    }
    if (alive.current) {
      if (generation === popoverGeneration.current)
        setResults((previous) => ({ ...previous, [cli.id]: result }))
      await fetchStatus()
    }
  }
  async function run(rows: CliUpdateEntry[]) {
    if (lock.current) return
    lock.current = true
    try {
      await runCliUpdatesSequentially(rows, update)
    } finally {
      lock.current = false
      if (alive.current) setRunning(null)
    }
  }
  if (!visible) return null
  const rows = [
    ...retained,
    ...updates.filter((cli) => !retained.some((row) => row.id === cli.id)),
  ].map((row) => clis.find((cli) => cli.id === row.id) ?? row)
  return (
    <div ref={root} className="relative ml-auto">
      <button
        type="button"
        data-cli-updates-entry
        onClick={() => {
          if (open) close()
          else {
            setResults({})
            setRetained(updates)
            setOpen(true)
          }
        }}
        className="flex items-center gap-1.5 py-0.5 px-1 rounded-control transition-colors hover:bg-app-surface/60 text-app-muted hover:text-app"
      >
        <ArrowUpCircle size={14} />
        {cliUpdatesLabel(updates.length)}
      </button>
      {open && (
        <div className="absolute right-0 bottom-full mb-1.5 w-80 p-3 rounded-control bg-app-surface border border-app shadow-2xl z-50 text-app font-sans space-y-3">
          {rows.map((cli) => (
            <div key={cli.id} data-cli-update-row={cli.id} className="space-y-1">
              <div className="flex items-center gap-2">
                <ProviderLogo id={cli.id} size={16} />
                <span className="font-semibold text-xs">{cli.label}</span>
                <Button
                  variant="secondary"
                  size="sm"
                  className={`ml-auto ${running === cli.id ? '[&_svg]:animate-spin' : ''}`}
                  leadingIcon={running === cli.id ? RefreshCw : undefined}
                  disabled={!cli.canUpdate || running !== null || results[cli.id]?.ok}
                  onClick={() => {
                    void run([cli])
                  }}
                >
                  Update
                </Button>
              </div>
              <div className="font-mono text-[11px]">
                {cli.version ?? '—'} → {cli.latestVersion ?? '—'}
              </div>
              {!cli.canUpdate && <p className="text-app-muted text-[11px]">{cli.reason}</p>}
              {results[cli.id] && (
                <div
                  data-cli-update-result={results[cli.id]?.ok ? 'ok' : 'error'}
                  className="text-[11px]"
                >
                  {results[cli.id]?.text}
                  {!results[cli.id]?.ok && (
                    <details>
                      <summary>Update failed</summary>
                      <pre className="whitespace-pre-wrap break-words">
                        {results[cli.id]?.detail?.slice(-4000)}
                      </pre>
                    </details>
                  )}
                </div>
              )}
            </div>
          ))}
          <div className="border-t border-app pt-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={
                running !== null || !updates.some((cli) => cli.canUpdate && !results[cli.id]?.ok)
              }
              onClick={() => {
                void run(updates.filter((cli) => cli.canUpdate && !results[cli.id]?.ok))
              }}
            >
              Update all
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
