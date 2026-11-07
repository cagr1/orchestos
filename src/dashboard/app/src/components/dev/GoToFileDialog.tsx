import { Search, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { findExplorerFiles } from '../../api/explorer'
import { FileIcon } from '../ui/file-icon'

export function GoToFileDialog({
  projectId,
  onClose,
  onOpenFile,
}: {
  projectId: string
  onClose: () => void
  onOpenFile: (path: string) => void
}) {
  const [query, setQuery] = useState('')
  const [files, setFiles] = useState<string[]>([])
  const [selected, setSelected] = useState(0)
  const [error, setError] = useState('')
  useEffect(() => {
    setFiles([])
    setSelected(0)
    setError('')
    const controller = new AbortController()
    const timer = setTimeout(() => {
      void findExplorerFiles(query, projectId, controller.signal)
        .then((files) => {
          if (!controller.signal.aborted) setFiles(files.map((file) => file.path))
        })
        .catch((error) => {
          if (!controller.signal.aborted) setError(String(error))
        })
    }, 200)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query, projectId])

  return (
    <div
      data-go-to-file
      role="dialog"
      aria-modal="true"
      aria-label="Go to file"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          onClose()
        } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault()
          setSelected((index) =>
            files.length
              ? (index + (event.key === 'ArrowDown' ? 1 : -1) + files.length) % files.length
              : 0,
          )
        } else if (event.key === 'Enter' && files[selected]) {
          event.preventDefault()
          onOpenFile(files[selected])
        }
      }}
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 pt-20 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-app bg-app-surface shadow-2xl">
        <div className="flex items-center gap-3 border-b border-app p-3">
          <Search className="h-4 w-4 text-app-muted" />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Go to file…"
            aria-controls="go-to-file-results"
            aria-activedescendant={files[selected] ? `go-to-file-${selected}` : undefined}
            className="flex-1 bg-transparent text-sm text-app placeholder:text-app-muted focus:outline-none"
          />
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-app-muted hover:bg-app-elevated hover:text-app"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div
          id="go-to-file-results"
          role="listbox"
          className="max-h-96 space-y-1 overflow-y-auto p-2"
        >
          {error && (
            <div role="alert" className="p-6 text-center text-xs text-app-muted">
              {error}
            </div>
          )}
          {files.map((path, index) => (
            <button
              id={`go-to-file-${index}`}
              key={path}
              role="option"
              aria-selected={selected === index}
              onClick={() => onOpenFile(path)}
              className={`flex w-full items-center gap-2.5 rounded-lg p-2.5 text-left text-xs text-app transition-colors hover:bg-app-elevated ${selected === index ? 'bg-app-elevated' : ''}`}
            >
              <FileIcon
                name={path.split('/').at(-1) ?? path}
                kind="file"
                className="h-4 w-4 shrink-0"
              />
              <span className="truncate">
                <span className="text-app">{path.split('/').at(-1) ?? path}</span>
                {path.includes('/') && (
                  <span className="ml-1 text-app-muted">
                    {path.slice(0, path.lastIndexOf('/'))}/
                  </span>
                )}
              </span>
            </button>
          ))}
          {!error && query && files.length === 0 && (
            <div className="p-6 text-center text-xs text-app-muted">No matches</div>
          )}
        </div>
      </div>
    </div>
  )
}
