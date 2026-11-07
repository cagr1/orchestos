import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { css } from '@codemirror/lang-css'
import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { markdown } from '@codemirror/lang-markdown'
import { yaml } from '@codemirror/lang-yaml'
import {
  bracketMatching,
  HighlightStyle,
  indentOnInput,
  syntaxHighlighting,
} from '@codemirror/language'
import { search, searchKeymap } from '@codemirror/search'
import { EditorState } from '@codemirror/state'
import {
  drawSelection,
  EditorView,
  highlightActiveLine,
  keymap,
  lineNumbers,
} from '@codemirror/view'
import { tags } from '@lezer/highlight'
import { useEffect, useRef } from 'react'

function language(path: string) {
  switch (path.split('.').pop()?.toLowerCase()) {
    case 'ts':
      return javascript({ typescript: true })
    case 'tsx':
      return javascript({ typescript: true, jsx: true })
    case 'js':
    case 'mjs':
      return javascript()
    case 'json':
      return json()
    case 'css':
      return css()
    case 'md':
    case 'markdown':
      return markdown()
    case 'yaml':
    case 'yml':
      return yaml()
    default:
      return []
  }
}

const theme = EditorView.theme({
  '&': { height: '100%', color: 'var(--app-text)', backgroundColor: 'var(--app-bg)' },
  '.cm-scroller': { fontFamily: 'inherit', fontSize: '12px', lineHeight: '24px', overflow: 'auto' },
  '.cm-content': { caretColor: 'var(--app-accent)', padding: '12px 0' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--app-accent)' },
  '.cm-gutters': {
    color: 'var(--app-text-muted)',
    backgroundColor: 'var(--app-bg)',
    borderColor: 'var(--app-border)',
  },
  '.cm-activeLine, .cm-activeLineGutter': { backgroundColor: 'var(--app-surface)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, .cm-content ::selection': {
    backgroundColor: 'var(--app-border)',
  },
  '.cm-panels, .cm-tooltip': {
    color: 'var(--app-text)',
    backgroundColor: 'var(--app-bg)',
    borderColor: 'var(--app-border)',
  },
  '.cm-searchMatch, .cm-matchingBracket': { outline: '1px solid var(--app-accent)' },
})

const highlighting = HighlightStyle.define([
  {
    tag: [
      tags.keyword,
      tags.name,
      tags.propertyName,
      tags.function(tags.variableName),
      tags.heading,
      tags.standard(tags.variableName),
    ],
    color: 'var(--app-accent)',
  },
  { tag: [tags.string, tags.regexp], color: 'var(--app-success)' },
  {
    tag: [tags.number, tags.bool, tags.null, tags.typeName],
    color: 'var(--app-warning)',
  },
  { tag: tags.comment, color: 'var(--app-text-muted)', fontStyle: 'italic' },
  { tag: tags.meta, color: 'var(--app-text-muted)' },
])

export function CodeEditor({
  path,
  value,
  onChange,
  onSave,
}: {
  path: string
  value: string
  onChange: (text: string) => void
  onSave: () => void
}) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<EditorView | null>(null)
  const callbacks = useRef({ onChange, onSave })
  callbacks.current = { onChange, onSave }
  const initial = useRef(value)
  initial.current = value
  const external = useRef(false)
  useEffect(() => {
    if (!host.current) return
    const editor = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: initial.current,
        extensions: [
          lineNumbers(),
          highlightActiveLine(),
          history(),
          drawSelection(),
          bracketMatching(),
          indentOnInput(),
          search(),
          language(path),
          theme,
          syntaxHighlighting(highlighting),
          EditorView.contentAttributes.of({ 'aria-label': path }),
          keymap.of([
            {
              key: 'Mod-s',
              preventDefault: true,
              run: () => {
                callbacks.current.onSave()
                return true
              },
            },
            ...defaultKeymap,
            ...historyKeymap,
            ...searchKeymap,
            indentWithTab,
          ]),
          EditorView.updateListener.of((update) => {
            if (update.docChanged && !external.current)
              callbacks.current.onChange(update.state.doc.toString())
          }),
        ],
      }),
    })
    view.current = editor
    return () => {
      editor.destroy()
      view.current = null
    }
  }, [path])
  useEffect(() => {
    const editor = view.current
    if (!editor || editor.state.doc.toString() === value) return
    external.current = true
    try {
      editor.dispatch({
        changes: { from: 0, to: editor.state.doc.length, insert: value },
        effects: editor.scrollSnapshot(),
      })
    } finally {
      external.current = false
    }
  }, [value])
  return <div ref={host} data-file-editor className="h-full min-h-0 font-mono" />
}
