import { useEffect, useRef, useState } from 'react'
import { cloneLocation, cloneProject } from '../../api/projects'
import type { ProjectItem } from '../../types/orchestos'

export function CloneProjectDialog({
  projectPath,
  onCloned,
  onClose,
}: {
  projectPath?: string
  onCloned: (project: ProjectItem) => Promise<void>
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [url, setUrl] = useState('')
  const [parentDir, setParentDir] = useState(
    projectPath ? projectPath.replace(/\/[^/]+\/?$/, '') || '/' : '',
  )
  const [busy, setBusy] = useState(false)
  const [choosing, setChoosing] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    dialogRef.current?.showModal()
    if (projectPath) return
    let disposed = false
    void cloneLocation()
      .then((path) => {
        if (!disposed) setParentDir((current) => current || path || '')
      })
      .catch((error) => {
        if (!disposed) setError(String(error))
      })
    return () => {
      disposed = true
    }
  }, [projectPath])
  const name =
    url
      .trim()
      .split(/[/:]/)
      .pop()
      ?.replace(/\.git$/, '') ?? ''
  return (
    <dialog
      ref={dialogRef}
      aria-label="Clone from URL"
      onCancel={(event) => {
        event.preventDefault()
        if (!busy && !choosing) onClose()
      }}
      className="m-auto w-[min(32rem,90vw)] rounded-card border border-app bg-app-surface p-5 text-xs text-app shadow-2xl backdrop:bg-black/50"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault()
          setBusy(true)
          setError('')
          void cloneProject(url.trim(), parentDir)
            .then(onCloned)
            .then(onClose)
            .catch((error) => setError(error instanceof Error ? error.message : String(error)))
            .finally(() => setBusy(false))
        }}
        className="space-y-4"
      >
        <h2 className="text-sm font-semibold">Clone from URL</h2>
        <p className="text-app-muted">Enter the Git URL and choose where to clone it.</p>
        <label className="block space-y-1">
          {' '}
          <span>Git URL</span>
          <input
            autoFocus
            required
            value={url}
            disabled={busy}
            onChange={(event) => setUrl(event.target.value)}
            className="w-full rounded-control border border-app bg-app-bg p-2"
          />
        </label>
        <div className="flex items-end gap-2">
          <label className="block flex-1 min-w-0 space-y-1">
            <span>Clone location</span>
            <input
              required
              value={parentDir}
              disabled={busy || choosing}
              onChange={(event) => setParentDir(event.target.value)}
              className="w-full rounded-control border border-app bg-app-bg p-2"
            />
          </label>
          <button
            type="button"
            disabled={busy || choosing}
            className="rounded-control border border-app p-2"
            onClick={() => {
              setChoosing(true)
              setError('')
              void cloneLocation(true)
                .then((path) => {
                  if (path) setParentDir(path)
                })
                .catch((error) => setError(String(error)))
                .finally(() => setChoosing(false))
            }}
          >
            Choose folder
          </button>
        </div>
        <p role="note" className="break-all text-app-muted" aria-label="Clone destination">
          {parentDir.replace(/\/$/, '')}/{name}
        </p>
        {error && (
          <p role="alert" className="text-app-error break-all">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            disabled={busy || choosing}
            onClick={onClose}
            className="rounded-control border border-app px-3 py-2"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || choosing || !url.trim() || !parentDir.trim()}
            className="rounded-control bg-app-accent px-3 py-2 text-app-bg disabled:opacity-50"
          >
            {busy ? 'Cloning...' : 'Clone'}
          </button>
        </div>
      </form>
    </dialog>
  )
}
