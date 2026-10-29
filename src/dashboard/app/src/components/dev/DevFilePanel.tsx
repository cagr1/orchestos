import hljs from 'highlight.js/lib/core'
import bash from 'highlight.js/lib/languages/bash'
import css from 'highlight.js/lib/languages/css'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import markdown from 'highlight.js/lib/languages/markdown'
import typescript from 'highlight.js/lib/languages/typescript'
import yaml from 'highlight.js/lib/languages/yaml'
import { X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { getExplorerFile } from '../../api/explorer'
import { ThreadMarkdown } from '../thread/ThreadMarkdown'
import type { FileTabs } from './file-tabs'

for (const [name, language] of Object.entries({
  bash,
  css,
  javascript,
  json,
  markdown,
  typescript,
  yaml,
})) {
  hljs.registerLanguage(name, language)
}
const LANGUAGES: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  mjs: 'javascript',
  json: 'json',
  md: 'markdown',
  markdown: 'markdown',
  yaml: 'yaml',
  yml: 'yaml',
  css: 'css',
  bash: 'bash',
  sh: 'bash',
}
const TOKEN_CLASSES = [
  '[&_.hljs-keyword]:text-app-accent [&_.hljs-selector-tag]:text-app-accent [&_.hljs-name]:text-app-accent',
  '[&_.hljs-string]:text-app-success [&_.hljs-attr]:text-app-accent [&_.hljs-regexp]:text-app-success',
  '[&_.hljs-number]:text-app-warning [&_.hljs-literal]:text-app-warning [&_.hljs-built_in]:text-app-accent',
  '[&_.hljs-comment]:text-app-muted [&_.hljs-comment]:italic [&_.hljs-meta]:text-app-muted',
  '[&_.hljs-title]:text-app-accent [&_.hljs-type]:text-app-warning [&_.hljs-section]:text-app-accent',
].join(' ')

function FileSource({ path, content }: { path: string; content: string }) {
  const extension = path.split('.').pop()?.toLowerCase() ?? ''
  const language = Object.hasOwn(LANGUAGES, extension) ? LANGUAGES[extension] : undefined
  const highlighted = useMemo(
    () => (language ? hljs.highlight(content, { language }).value : null),
    [content, language],
  )
  return (
    <div data-file-source className="flex min-h-full min-w-max font-mono text-xs leading-6 p-3">
      <pre
        data-line-numbers
        aria-hidden="true"
        className="select-none pr-4 text-right text-app-muted border-r border-app mr-4"
      >
        {content
          .split('\n')
          .map((_, index) => index + 1)
          .join('\n')}
      </pre>
      <pre className={`text-app ${TOKEN_CLASSES}`}>
        {highlighted === null ? (
          <code>{content}</code>
        ) : (
          // highlight.js escapes source text before emitting its own token spans.
          // biome-ignore lint/security/noDangerouslySetInnerHtml: HTML comes only from highlight.js escaping this source.
          <code dangerouslySetInnerHTML={{ __html: highlighted }} />
        )}
      </pre>
    </div>
  )
}

export function DevFilePanel({
  projectId,
  state,
  onOpen,
  onClose,
  onCloseAll,
}: {
  projectId: string
  state: FileTabs
  onOpen: (path: string, options: { pin: boolean }) => void
  onClose: (path: string) => void
  onCloseAll: () => void
}) {
  const [files, setFiles] = useState<Record<string, { content?: string; error?: string }>>({})
  const [sourcePaths, setSourcePaths] = useState<Record<string, boolean>>({})
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const paths = JSON.stringify(state.tabs.map((tab) => tab.path))
  useEffect(() => {
    let cancelled = false
    setFiles({})
    for (const path of JSON.parse(paths) as string[]) {
      void getExplorerFile(path, projectId)
        .then((file) => {
          if (!cancelled) setFiles((prev) => ({ ...prev, [path]: { content: file.content ?? '' } }))
        })
        .catch((error) => {
          if (cancelled) return
          const message = error instanceof Error ? error.message : 'Unable to open file.'
          if (/Request failed \((404|400)\)/.test(message)) closeRef.current(path)
          else setFiles((prev) => ({ ...prev, [path]: { error: message } }))
        })
    }
    return () => {
      cancelled = true
    }
  }, [projectId, paths])
  const path = state.activePath
  const file = path ? files[path] : undefined
  const isMarkdown = /\.(md|markdown)$/i.test(path ?? '')
  const source = !!sourcePaths[path ?? '']
  return (
    <section
      data-dev-file-panel
      aria-label="File viewer"
      className="flex flex-col flex-1 min-w-0 overflow-hidden border-l border-app bg-app-bg"
    >
      <div className="flex shrink-0 items-center border-b border-app">
        <div role="tablist" aria-label="Open files" className="flex flex-1 min-w-0 overflow-x-auto">
          {state.tabs.map((tab) => (
            <div
              key={tab.path}
              className={`group flex items-center border-r border-app ${path === tab.path ? 'bg-app-surface text-app' : 'text-app-muted'}`}
            >
              <button
                type="button"
                role="tab"
                data-file-tab={tab.path}
                aria-selected={path === tab.path}
                onClick={() => onOpen(tab.path, { pin: false })}
                onDoubleClick={() => onOpen(tab.path, { pin: true })}
                title={tab.path}
                className={`px-3 py-2 text-xs whitespace-nowrap hover:text-app ${tab.pinned ? '' : 'italic'}`}
              >
                {tab.path.split('/').pop()}
              </button>
              <button
                type="button"
                aria-label={`Close file tab ${tab.path}`}
                onClick={() => onClose(tab.path)}
                className="mr-2 p-1 rounded-control opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-app-hover text-app-muted hover:text-app"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          aria-label="Close file panel"
          onClick={onCloseAll}
          className="p-2 text-app-muted hover:text-app hover:bg-app-hover"
        >
          <X size={14} />
        </button>
      </div>
      {isMarkdown && path && (
        <div className="flex justify-end gap-1 p-1 border-b border-app">
          {['Preview', 'Source'].map((label) => (
            <button
              key={label}
              type="button"
              aria-pressed={source === (label === 'Source')}
              onClick={() => setSourcePaths((prev) => ({ ...prev, [path]: label === 'Source' }))}
              className={`px-2 py-1 text-xs rounded-control ${source === (label === 'Source') ? 'bg-app-surface text-app-accent' : 'text-app-muted hover:text-app'}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-auto">
        {!file ? (
          <p className="p-3 text-xs text-app-muted">Loading…</p>
        ) : file.error ? (
          <p role="alert" className="p-3 text-xs text-app-error">
            {file.error}
          </p>
        ) : isMarkdown && !source ? (
          <div data-file-markdown className="p-4 text-sm text-app">
            <ThreadMarkdown text={file.content ?? ''} streaming={false} />
          </div>
        ) : (
          <FileSource path={path ?? ''} content={file.content ?? ''} />
        )}
      </div>
      <footer
        className="shrink-0 border-t border-app px-3 py-1 text-xs text-app-muted font-mono truncate"
        title={path ?? ''}
      >
        {path}
      </footer>
    </section>
  )
}
