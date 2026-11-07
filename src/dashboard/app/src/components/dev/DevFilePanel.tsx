import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { getExplorerFile, saveExplorerFile } from '../../api/explorer'
import { ThreadMarkdown } from '../thread/ThreadMarkdown'
import { CodeEditor } from './CodeEditor'
import {
  getBuffer,
  getSnapshot,
  isDirty,
  markSaved,
  replaceFromDisk,
  setDraft,
  subscribe,
} from './file-buffers'

type DiskFile = Awaited<ReturnType<typeof getExplorerFile>>
type Conflict = { content: string; mtimeMs: number }

export function DevFilePanel({
  projectId,
  path,
  onClose,
}: {
  projectId: string
  path: string
  onClose: (path: string) => void
}) {
  useSyncExternalStore(subscribe, getSnapshot)
  const buffer = getBuffer(projectId, path)
  const [file, setFile] = useState<{ path: string; data?: DiskFile; error?: string } | null>(null)
  const [sourcePaths, setSourcePaths] = useState<Record<string, boolean>>({})
  const [conflicts, setConflicts] = useState<Record<string, Conflict | undefined>>({})
  const [errors, setErrors] = useState<Record<string, string | undefined>>({})
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const request = useRef(0)
  const saving = useRef(new Set<string>())
  const id = `${projectId}:${path}`
  const conflict = conflicts[id]
  const dirty = isDirty(projectId, path)

  useEffect(() => {
    let cancelled = false
    if (!getBuffer(projectId, path)) {
      setErrors((previous) => ({ ...previous, [id]: undefined }))
      setConflicts((previous) => ({ ...previous, [id]: undefined }))
    }
    const refresh = async () => {
      const sequence = ++request.current
      try {
        const data = await getExplorerFile(path, projectId)
        if (cancelled || sequence !== request.current) return
        setFile({ path, data })
        if (data.binary || data.tooLarge) return
        const current = getBuffer(projectId, path)
        if (!current || (!isDirty(projectId, path) && current.mtimeMs !== data.mtimeMs)) {
          replaceFromDisk(projectId, path, data.content ?? '', data.mtimeMs)
          setConflicts((previous) => ({ ...previous, [id]: undefined }))
        } else if (current.mtimeMs !== data.mtimeMs) {
          setConflicts((previous) => ({
            ...previous,
            [id]: { content: data.content ?? '', mtimeMs: data.mtimeMs },
          }))
        } else {
          setConflicts((previous) => ({ ...previous, [id]: undefined }))
        }
      } catch (error) {
        if (cancelled || sequence !== request.current) return
        const message = error instanceof Error ? error.message : 'Unable to open file.'
        if (/Request failed \((404|400)\)/.test(message) && !isDirty(projectId, path))
          closeRef.current(path)
        else setFile({ path, error: message })
      }
    }
    void refresh()
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [projectId, path, id])

  const save = async (expectedMtimeMs?: number) => {
    const current = getBuffer(projectId, path)
    if (!current || saving.current.has(id)) return
    saving.current.add(id)
    ++request.current
    const content = current.draft
    setErrors((previous) => ({ ...previous, [id]: undefined }))
    try {
      const result = await saveExplorerFile(
        path,
        content,
        expectedMtimeMs ?? current.mtimeMs,
        projectId,
      )
      if (result.conflict) setConflicts((previous) => ({ ...previous, [id]: result }))
      else {
        markSaved(projectId, path, content, result.mtimeMs)
        setConflicts((previous) => ({ ...previous, [id]: undefined }))
      }
    } catch (error) {
      setErrors((previous) => ({
        ...previous,
        [id]: error instanceof Error ? error.message : 'Unable to save file.',
      }))
    } finally {
      saving.current.delete(id)
    }
  }

  const disk = file?.path === path ? file.data : undefined
  const error = errors[id] ?? (file?.path === path ? file.error : undefined)
  const unavailable = disk?.binary || disk?.tooLarge
  const isMarkdown = /\.(md|markdown)$/i.test(path)
  const source = !!sourcePaths[path]
  return (
    <section
      data-dev-file-panel
      aria-label="File viewer"
      className="flex flex-col flex-1 min-w-0 overflow-hidden bg-app-bg"
    >
      {isMarkdown && !unavailable && (
        <div className="flex justify-end gap-1 p-1 border-b border-app">
          {['Preview', 'Source'].map((label) => (
            <button
              key={label}
              type="button"
              aria-pressed={source === (label === 'Source')}
              onClick={() =>
                setSourcePaths((previous) => ({ ...previous, [path]: label === 'Source' }))
              }
              className={`px-2 py-1 text-xs rounded-control ${source === (label === 'Source') ? 'bg-app-surface text-app-accent' : 'text-app-muted hover:text-app'}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {conflict && (
        <div
          data-file-conflict
          className="flex items-center gap-2 px-3 py-2 border-b border-app text-xs text-app"
        >
          <span className="flex-1">Changed on disk</span>
          <button
            type="button"
            className="px-2 py-1 text-app-accent"
            onClick={() => void save(conflict.mtimeMs)}
          >
            Keep mine
          </button>
          <button
            type="button"
            className="px-2 py-1 text-app-accent"
            onClick={() => {
              replaceFromDisk(projectId, path, conflict.content, conflict.mtimeMs)
              setConflicts((previous) => ({ ...previous, [id]: undefined }))
            }}
          >
            Reload
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="p-3 text-xs text-app-error">
          {error}
        </p>
      )}
      <div className="flex-1 min-h-0 overflow-auto">
        {unavailable ? (
          <div
            data-file-unavailable
            className="flex h-full items-center justify-center text-xs text-app-muted"
          >
            {disk.binary
              ? 'Binary file — not shown'
              : `File too large to open (${Math.round(disk.sizeBytes / 1024)} KB)`}
          </div>
        ) : !buffer ? (
          !error && <p className="p-3 text-xs text-app-muted">Loading…</p>
        ) : isMarkdown && !source ? (
          <div data-file-markdown className="p-4 text-sm text-app">
            <ThreadMarkdown text={buffer.draft} streaming={false} />
          </div>
        ) : (
          <CodeEditor
            key={path}
            path={path}
            value={buffer.draft}
            onChange={(text) => setDraft(projectId, path, text)}
            onSave={() => void save()}
          />
        )}
      </div>
      <footer
        data-file-dirty={dirty ? '' : undefined}
        className="shrink-0 border-t border-app px-3 py-1 text-xs text-app-muted font-mono truncate"
        title={path}
      >
        {path}
        {dirty && <span className="ml-3">Unsaved</span>}
      </footer>
    </section>
  )
}
