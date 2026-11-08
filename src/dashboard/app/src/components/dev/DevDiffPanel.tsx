import { Columns2, Rows3, Space } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getGitChanges, getGitDiff } from '../../api/git'
import { useDiffSettings } from '../../lib/diff-settings'
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

type DiffLine = ReturnType<typeof numberedDiffLines>[number]
export type SplitDiffRow = { header: string } | { left: DiffLine | null; right: DiffLine | null }

export function splitDiffRows(patch: string): SplitDiffRow[] {
  const lines = numberedDiffLines(patch)
  const rows: SplitDiffRow[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    if (line.text.startsWith('@@')) {
      rows.push({ header: line.text })
    } else if (line.text.startsWith('-') || line.text.startsWith('+')) {
      const removed: DiffLine[] = []
      const added: DiffLine[] = []
      while (i < lines.length && lines[i]!.text.startsWith('-')) removed.push(lines[i++]!)
      while (i < lines.length && lines[i]!.text.startsWith('+')) added.push(lines[i++]!)
      i--
      for (let j = 0; j < Math.max(removed.length, added.length); j++) {
        rows.push({ left: removed[j] ?? null, right: added[j] ?? null })
      }
    } else if (line.oldLine !== null && line.newLine !== null) {
      rows.push({ left: line, right: line })
    } else {
      rows.push({ header: line.text })
    }
  }
  return rows
}

function diffLineClass(text: string) {
  return text.startsWith('+')
    ? 'bg-emerald-500/10 [[data-diff-palette=colorblind]_&]:bg-sky-500/10 text-emerald-400 [[data-diff-palette=colorblind]_&]:text-sky-400'
    : text.startsWith('-')
      ? 'bg-red-500/10 [[data-diff-palette=colorblind]_&]:bg-orange-500/10 text-app-error [[data-diff-palette=colorblind]_&]:text-orange-400'
      : text.startsWith('@@')
        ? 'text-app-accent'
        : ''
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
  const settings = useDiffSettings()
  const [view, setView] = useState(settings.view)
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(settings.ignoreWhitespace)
  useEffect(() => setView(settings.view), [settings.view])
  useEffect(() => setIgnoreWhitespace(settings.ignoreWhitespace), [settings.ignoreWhitespace])
  const [result, setResult] = useState<{ patch: string; deleted: boolean } | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => {
    let cancelled = false
    void Promise.all([
      getGitDiff(path, projectId, ignoreWhitespace),
      getGitChanges(projectId, ignoreWhitespace),
    ])
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
  }, [projectId, path, revision, ignoreWhitespace])
  return (
    <section
      data-diff-view={view}
      data-dev-diff-panel
      aria-label="Diff viewer"
      className="flex flex-col flex-1 min-w-0 overflow-hidden bg-app-bg"
    >
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-app px-3 py-2 text-xs">
        <span className="truncate text-app-muted" title={path}>
          {path} (diff)
        </span>
        <div className="flex items-center gap-1">
          <div
            role="group"
            aria-label="Diff view"
            className="flex rounded-control border border-app"
          >
            {(['unified', 'split'] as const).map((mode) => {
              const Icon = mode === 'unified' ? Rows3 : Columns2
              const label = mode === 'unified' ? 'Unified' : 'Split'
              return (
                <button
                  key={mode}
                  type="button"
                  aria-label={label}
                  title={label}
                  aria-pressed={view === mode}
                  onClick={() => setView(mode)}
                  className={`p-1 rounded-control ${view === mode ? 'bg-app-surface text-app' : 'text-app-muted hover:text-app'}`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </button>
              )
            })}
          </div>
          <button
            type="button"
            aria-label="Ignore whitespace"
            title="Ignore whitespace"
            aria-pressed={ignoreWhitespace}
            onClick={() => setIgnoreWhitespace((value) => !value)}
            className={`p-1 rounded-control ${ignoreWhitespace ? 'bg-app-surface text-app' : 'text-app-muted hover:text-app'}`}
          >
            <Space className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            disabled={!result || result.deleted || error}
            onClick={() => onOpenFile(path, { pin: true })}
            className="shrink-0 rounded-control px-2 py-1 text-app-muted hover:text-app hover:bg-app-surface disabled:opacity-50"
          >
            Open file
          </button>
        </div>
      </header>
      <div className="flex-1 min-h-0 overflow-auto font-mono text-xs leading-6 text-app-muted">
        {error ? (
          <p role="alert" className="p-3">
            Could not read git changes
          </p>
        ) : !result ? (
          <p className="p-3">Loading…</p>
        ) : view === 'split' ? (
          <pre data-diff-split className="w-max min-w-full py-2">
            {splitDiffRows(result.patch).map((row, index) =>
              'header' in row ? (
                <div key={index} className="px-2 text-app-accent">
                  {row.header}
                </div>
              ) : (
                <div key={index} data-diff-split-row className="grid grid-cols-2">
                  {(['left', 'right'] as const).map((side) => {
                    const line = row[side]
                    return (
                      <div
                        key={side}
                        data-diff-side={side}
                        data-diff-added={line?.text.startsWith('+') || undefined}
                        data-diff-removed={line?.text.startsWith('-') || undefined}
                        className={`flex min-w-0 px-2 border-r border-app ${diffLineClass(line?.text ?? '')}`}
                      >
                        <span
                          aria-hidden="true"
                          className="inline-block w-12 shrink-0 select-none pr-3 text-right opacity-60"
                        >
                          {side === 'left' ? line?.oldLine : line?.newLine}
                        </span>
                        <span>{line?.text ?? ' '}</span>
                      </div>
                    )
                  })}
                </div>
              ),
            )}
          </pre>
        ) : (
          <pre className="w-max min-w-full py-2">
            {numberedDiffLines(result.patch).map((line, index) => (
              <div
                key={index}
                data-diff-added={line.text.startsWith('+') || undefined}
                data-diff-removed={line.text.startsWith('-') || undefined}
                className={`flex px-2 ${diffLineClass(line.text)}`}
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
