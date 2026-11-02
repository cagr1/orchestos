import { useEffect, useState } from 'react'
import { getGitChanges, getGitDiff } from '../../api/git'
import { parseDiffPatch } from './OrcaRightInspector'

export function numberedDiffLines(patch: string) {
  let oldLine = 0
  let newLine = 0
  let inHunk = false
  return parseDiffPatch(patch).lines.flatMap((text) => {
    const hunk = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(text)
    if (hunk) {
      oldLine = Number(hunk[1])
      newLine = Number(hunk[2])
      inHunk = true
      return [{ text, oldLine: null, newLine: null }]
    }
    if (!inHunk && /^(diff --git |index |--- |\+\+\+ )/.test(text)) return []
    if (text.startsWith('+')) return [{ text, oldLine: null, newLine: newLine++ }]
    if (text.startsWith('-')) return [{ text, oldLine: oldLine++, newLine: null }]
    if (text.startsWith(' ')) return [{ text, oldLine: oldLine++, newLine: newLine++ }]
    return [{ text, oldLine: null, newLine: null }]
  })
}

export function DevDiffPanel({
  projectId,
  path,
  revision,
  onOpenFile,
}: {
  projectId: string
  path: string
  revision: number
  onOpenFile: (path: string, options: { pin: boolean }) => void
}) {
  const [result, setResult] = useState<{ patch: string; deleted: boolean } | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    let cancelled = false
    void Promise.all([getGitDiff(path, projectId), getGitChanges(projectId)])
      .then(([diff, changes]) => {
        if (cancelled) return
        setResult({
          patch: diff.patch,
          deleted: changes.files.some((file) => file.path === path && file.status === 'D'),
        })
        setError(false)
      })
      .catch(() => {
        if (!cancelled) setError(true)
      })
    return () => {
      cancelled = true
    }
  }, [projectId, path, revision])
  return (
    <section
      data-dev-diff-panel
      aria-label="Diff viewer"
      className="flex flex-col flex-1 min-w-0 overflow-hidden bg-app-bg"
    >
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-app px-3 py-2 text-xs">
        <span className="truncate text-app-muted" title={path}>
          {path} (diff)
        </span>
        <button
          type="button"
          disabled={!result || result.deleted || error}
          onClick={() => onOpenFile(path, { pin: true })}
          className="shrink-0 rounded-control px-2 py-1 text-app-muted hover:text-app hover:bg-app-surface disabled:opacity-50"
        >
          Open file
        </button>
      </header>
      <div className="flex-1 min-h-0 overflow-auto font-mono text-xs leading-6 text-app-muted">
        {error ? (
          <p role="alert" className="p-3">
            Could not read git changes
          </p>
        ) : !result ? (
          <p className="p-3">Loading…</p>
        ) : (
          <pre className="w-max min-w-full py-2">
            {numberedDiffLines(result.patch).map((line, index) => (
              <div
                key={index}
                data-diff-added={line.text.startsWith('+') || undefined}
                data-diff-removed={line.text.startsWith('-') || undefined}
                className={`flex px-2 ${line.text.startsWith('+') ? 'bg-emerald-500/10 text-emerald-400' : line.text.startsWith('-') ? 'bg-red-500/10 text-app-error' : line.text.startsWith('@@') ? 'text-app-accent' : ''}`}
              >
                <span
                  aria-hidden="true"
                  className="inline-block w-12 shrink-0 select-none pr-3 text-right opacity-60"
                >
                  {line.oldLine}
                </span>
                <span
                  aria-hidden="true"
                  className="inline-block w-12 shrink-0 select-none pr-3 text-right opacity-60"
                >
                  {line.newLine}
                </span>
                <span>{line.text}</span>
              </div>
            ))}
          </pre>
        )}
      </div>
    </section>
  )
}
