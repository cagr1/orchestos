import { ExternalLink, RotateCw } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { getPreviewUrl, savePreviewUrl } from '@/api/projects'
import { Tooltip } from '@/components/ui/tooltip'
import { localPreviewUrl } from '../../../../../preview/local-url'
import { normalizePreviewUrl, previewUrlKey } from './preview-url'

export function DevPreviewPanel({ projectId }: { projectId: string }) {
  const [url, setUrl] = useState(() =>
    normalizePreviewUrl(localStorage.getItem(previewUrlKey(projectId)) ?? ''),
  )
  const [input, setInput] = useState(url ?? '')
  const [invalid, setInvalid] = useState(false)
  const [revision, setRevision] = useState(0)
  const editVersion = useRef(0)
  useEffect(() => {
    const saved = normalizePreviewUrl(localStorage.getItem(previewUrlKey(projectId)) ?? '')
    setUrl(saved)
    setInput(saved ?? '')
    setInvalid(false)
    if (saved) {
      // Una URL guardada antes de USO.21 solo vivía en el navegador: se sube para que el agente la vea.
      if (localPreviewUrl(saved)) void savePreviewUrl(projectId, saved).catch(() => {})
      return
    }
    const controller = new AbortController()
    const version = editVersion.current
    void getPreviewUrl(projectId, controller.signal)
      .then((saved) => {
        if (
          controller.signal.aborted ||
          editVersion.current !== version ||
          typeof saved !== 'string'
        )
          return
        const next = normalizePreviewUrl(saved)
        if (!next) return
        setUrl(next)
        setInput(next)
        localStorage.setItem(previewUrlKey(projectId), next)
      })
      .catch(() => {})
    return () => controller.abort()
  }, [projectId])

  return (
    <section className="flex flex-1 min-h-0 min-w-0 flex-col">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-app px-3 py-2 text-xs">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <input
            type="text"
            placeholder="http://localhost:3000"
            value={input}
            aria-invalid={invalid}
            className="w-full min-w-0 rounded-control border border-app bg-app-bg px-2 py-1 text-app outline-none focus:border-app-accent"
            onChange={(event) => {
              editVersion.current++
              setInput(event.target.value)
            }}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return
              const next = normalizePreviewUrl(input)
              setInvalid(!next)
              if (!next) return
              setUrl(next)
              setInput(next)
              editVersion.current++
              localStorage.setItem(previewUrlKey(projectId), next)
              void savePreviewUrl(projectId, next).catch(() => {})
            }}
          />
          {url && !localPreviewUrl(url) && (
            <p className="text-app-muted">The agent can only open localhost URLs</p>
          )}
          {invalid && (
            <p role="alert" className="text-app-error">
              Enter an http:// or https:// URL
            </p>
          )}
        </div>
        <Tooltip content="Reload">
          <button
            type="button"
            aria-label="Reload"
            disabled={!url}
            onClick={() => setRevision((value) => value + 1)}
            className="p-1 rounded-control text-app-muted hover:text-app hover:bg-app-surface disabled:opacity-50"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </button>
        </Tooltip>
        <Tooltip content="Open in browser">
          <button
            type="button"
            aria-label="Open in browser"
            disabled={!url}
            onClick={() => url && window.open(url, '_blank', 'noopener')}
            className="p-1 rounded-control text-app-muted hover:text-app hover:bg-app-surface disabled:opacity-50"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </Tooltip>
      </header>
      {url ? (
        <iframe
          key={revision}
          title="Preview"
          src={url}
          className="flex-1 w-full border-0 bg-white"
        />
      ) : (
        <div className="flex flex-1 items-center justify-center p-6 text-sm text-app-muted">
          Run your dev server in the terminal and enter its URL above
        </div>
      )}
    </section>
  )
}
