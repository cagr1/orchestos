import {
  ChevronDown,
  ChevronRight,
  Ellipsis,
  FileCode,
  FileText,
  Folder,
  FolderOpen,
  GitCompare,
  History,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  Upload,
} from 'lucide-react'
import type React from 'react'
import { useEffect, useState } from 'react'
import { getExplorerFile, getExplorerTree } from '../../api/explorer'
import type { FileNode, ProjectItem, RunItem } from '../../types/orchestos'
import { ProviderLogo } from '../common/ProviderLogos'

export interface HistorySession {
  id: string
  projectId: string
  projectName: string
  title: string
  lastMessage: string
  cliId: string
  model: string
  messageCount: number
  timeAgo: string
  logs?: string[]
}

interface OrcaRightInspectorProps {
  currentProject: ProjectItem
  projects?: ProjectItem[]
  recentRuns: RunItem[]
  historySessions?: HistorySession[]
  onRestoreAgentToSidebar?: (session: HistorySession) => void
  onDeleteHistorySession?: (sessionId: string) => void
}

export function parseDiffPatch(patch: string): {
  lines: string[]
  additions: number
  deletions: number
} {
  const lines = patch
    .split(/\r?\n/)
    .filter((line) => line && !line.startsWith('Index:') && !/^=+$/.test(line))
  return {
    lines,
    additions: lines.filter((line) => line.startsWith('+') && !line.startsWith('+++')).length,
    deletions: lines.filter((line) => line.startsWith('-') && !line.startsWith('---')).length,
  }
}

export const OrcaRightInspector: React.FC<OrcaRightInspectorProps> = ({
  currentProject,
  recentRuns,
  historySessions = [],
  onRestoreAgentToSidebar,
  onDeleteHistorySession,
}) => {
  const [tab, setTab] = useState<'files' | 'diff' | 'history'>('files')
  const [nodes, setNodes] = useState<FileNode[]>([])
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [selected, setSelected] = useState<FileNode>()
  const [query, setQuery] = useState('')
  const [searchMode, setSearchMode] = useState<'names' | 'contents'>('names')
  const [loading, setLoading] = useState(false)
  const [historyScope, setHistoryScope] = useState<'workspace' | 'project' | 'all'>('workspace')
  const [historySearch, setHistorySearch] = useState('')
  const [expandedSessionIds, setExpandedSessionIds] = useState<Record<string, boolean>>({})
  const [activeHistoryMenuId, setActiveHistoryMenuId] = useState<string | null>(null)

  const loadDirectory = async (path = '') => {
    setLoading(true)
    try {
      const entries = await getExplorerTree(path, currentProject.id)
      if (!path) setNodes(entries)
      else
        setNodes((current) =>
          current.map((node) => (node.path === path ? { ...node, children: entries } : node)),
        )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadDirectory()
  }, [currentProject.id])

  const toggle = async (node: FileNode) => {
    if (!node.isDir) {
      setSelected(await getExplorerFile(node.path, currentProject.id))
      return
    }
    const open = !expanded[node.path]
    setExpanded((value) => ({ ...value, [node.path]: open }))
    if (open && !node.children) await loadDirectory(node.path)
  }

  const renderTree = (items: FileNode[], depth = 0): React.ReactNode =>
    items
      .filter((node) => !query || node.name.toLowerCase().includes(query.toLowerCase()))
      .map((node) => (
        <div key={node.path}>
          <button
            type="button"
            onClick={() => void toggle(node)}
            className={`w-full flex items-center gap-1.5 py-1 px-2 rounded-control text-xs text-left ${depth === 0 ? 'pl-2.5' : depth === 1 ? 'pl-6' : depth === 2 ? 'pl-10' : 'pl-14'} ${selected?.path === node.path ? 'bg-app-surface text-app-accent border border-app' : 'text-app-muted hover:text-app hover:bg-app-surface/50'}`}
          >
            {node.isDir ? (
              expanded[node.path] ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )
            ) : (
              <span className="w-3.5" />
            )}
            {node.isDir ? (
              <Folder className="w-3.5 h-3.5 text-app-accent" />
            ) : node.name.endsWith('.md') ? (
              <FileText className="w-3.5 h-3.5 text-amber-400/80" />
            ) : (
              <FileCode className="w-3.5 h-3.5 text-sky-400/80" />
            )}
            <span className="truncate">{node.name}</span>
            {node.size && <span className="ml-auto text-[10px] text-app-muted">{node.size}</span>}
          </button>
          {node.isDir &&
            expanded[node.path] &&
            node.children &&
            renderTree(node.children, depth + 1)}
        </div>
      ))

  const diffRuns = recentRuns.filter((run) => run.fileDiffs?.length)
  const filteredHistory = historySessions.filter((session) => {
    if (historyScope === 'project' && session.projectId !== currentProject.id) return false
    const query = historySearch.trim().toLowerCase()
    return (
      !query ||
      [session.title, session.lastMessage, session.model, session.projectName].some((value) =>
        value.toLowerCase().includes(query),
      )
    )
  })
  const historyByProject = filteredHistory.reduce<Record<string, HistorySession[]>>(
    (groups, session) => {
      ;(groups[session.projectName] ||= []).push(session)
      return groups
    },
    {},
  )
  return (
    <aside className="w-96 flex-shrink-0 border-l border-app bg-app-bg flex flex-col h-full overflow-hidden text-app select-none z-10">
      <div className="h-11 border-b border-app px-2 flex items-center gap-1 bg-app-surface/40 flex-shrink-0">
        <button
          type="button"
          onClick={() => setTab('files')}
          className={`app-tab-btn ${tab === 'files' ? 'app-tab-btn-active' : 'app-tab-btn-inactive'}`}
        >
          <FolderOpen className="w-3.5 h-3.5 text-app-accent" />
          Files
        </button>
        <button
          type="button"
          onClick={() => setTab('diff')}
          className={`app-tab-btn ${tab === 'diff' ? 'app-tab-btn-active' : 'app-tab-btn-inactive'}`}
        >
          <GitCompare className="w-3.5 h-3.5 text-emerald-400" />
          Diff
        </button>
        <button
          type="button"
          onClick={() => setTab('history')}
          className={`app-tab-btn ${tab === 'history' ? 'app-tab-btn-active' : 'app-tab-btn-inactive'}`}
        >
          <History className="w-3.5 h-3.5 text-app-accent" />
          History
        </button>
      </div>
      {tab === 'files' ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-3 border-b border-app flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-semibold text-xs truncate">{currentProject.name}</span>
              {currentProject.branch && (
                <span className="text-xs font-mono px-1.5 py-0.5 rounded-pill bg-app-surface text-app-muted border border-app">
                  {currentProject.branch}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <label
                className="p-1 text-app-muted hover:text-app hover:bg-app-surface rounded-control cursor-pointer"
                title="Upload files"
                aria-label="Upload files"
              >
                <Upload className="w-3.5 h-3.5" />
                <input type="file" multiple className="hidden" />
              </label>
              <button
                type="button"
                onClick={() => void loadDirectory()}
                aria-label="Refresh file tree"
                className="p-1 text-app-muted hover:text-app"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                type="button"
                aria-label="More file options"
                title="More options"
                className="p-1 text-app-muted hover:text-app"
              >
                <Ellipsis className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div className="p-2 border-b border-app space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-app-muted absolute left-2.5 top-2" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Find files"
                className="w-full pl-8 pr-2.5 py-1 text-xs bg-app-surface border border-app rounded-control text-app placeholder:text-app-muted focus:outline-hidden"
              />
            </div>
            <div className="flex items-center gap-1">
              {(['names', 'contents'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setSearchMode(mode)}
                  className={`flex-1 py-0.5 text-xs font-medium rounded-control transition-colors ${searchMode === mode ? 'bg-app-elevated text-app shadow-xs border border-app' : 'text-app-muted hover:text-app'}`}
                >
                  {mode[0].toUpperCase() + mode.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-1 font-mono text-xs">{renderTree(nodes)}</div>
          {selected && (
            <div className="h-56 border-t border-app bg-app-surface flex flex-col">
              <div className="px-3 py-1.5 border-b border-app bg-app-elevated/70 text-xs font-mono text-app-accent truncate">
                {selected.path}
              </div>
              <pre className="flex-1 p-2.5 overflow-auto text-xs text-app bg-app-bg whitespace-pre-wrap">
                {selected.content}
              </pre>
            </div>
          )}
        </div>
      ) : tab === 'diff' ? (
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {diffRuns.length === 0 ? (
            <p className="text-xs text-app-muted">No run has produced a diff yet.</p>
          ) : (
            diffRuns.map((run) => (
              <section key={run.id} className="space-y-2">
                <div className="text-xs font-mono text-app-muted">{run.taskId || run.id}</div>
                {run.fileDiffs.map((diff, index) => {
                  const patch = diff.diff || diff.patch || ''
                  const parsedDiff = parseDiffPatch(patch)
                  const lines = parsedDiff.lines
                  return (
                    <div
                      key={`${run.id}-${index}`}
                      className="border border-app rounded-card bg-app-surface overflow-hidden text-xs"
                    >
                      <div className="px-3 py-1.5 bg-app-elevated border-b border-app flex items-center justify-between font-mono">
                        <span className="text-app font-medium">
                          {diff.filePath || diff.path || 'changed file'}
                        </span>
                        <span className="text-emerald-400">
                          +{parsedDiff.additions} -{parsedDiff.deletions}
                        </span>
                      </div>
                      <div className="p-2 font-mono text-xs space-y-0.5 bg-app-bg">
                        {lines.length === 0 ? (
                          <div className="text-app-muted">No patch content.</div>
                        ) : (
                          lines.map((line, lineIndex) => {
                            const added = line.startsWith('+') && !line.startsWith('+++')
                            const removed = line.startsWith('-') && !line.startsWith('---')
                            return (
                              <div
                                key={lineIndex}
                                className={
                                  added
                                    ? 'text-emerald-400 bg-emerald-950/30 px-1 rounded-control'
                                    : removed
                                      ? 'text-rose-400 bg-rose-950/30 px-1 rounded-control'
                                      : 'text-app-muted'
                                }
                              >
                                {line}
                              </div>
                            )
                          })
                        )}
                      </div>
                    </div>
                  )
                })}
              </section>
            ))
          )}
        </div>
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-3 border-b border-app flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider">
              History{' '}
              <span className="ml-1 px-2 py-0.5 rounded-pill bg-app-surface border border-app font-mono text-app-muted">
                {filteredHistory.length} shown
              </span>
            </h2>
          </div>
          <div className="p-2 border-b border-app space-y-2">
            <div className="grid grid-cols-3 gap-1 p-0.5 bg-app-surface rounded-control border border-app text-xs">
              {(['workspace', 'project', 'all'] as const).map((scope) => (
                <button
                  key={scope}
                  type="button"
                  onClick={() => setHistoryScope(scope)}
                  className={`py-1 rounded-control text-center font-medium ${historyScope === scope ? 'bg-app-elevated text-app font-semibold shadow-xs' : 'text-app-muted hover:text-app'}`}
                >
                  {scope[0].toUpperCase() + scope.slice(1)}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-app-muted absolute left-2.5 top-2" />
              <input
                value={historySearch}
                onChange={(event) => setHistorySearch(event.target.value)}
                placeholder="Search agent sessions..."
                className="w-full pl-8 pr-2.5 py-1 text-xs bg-app-surface border border-app rounded-control text-app placeholder:text-app-muted focus:outline-hidden"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-3">
            {Object.keys(historyByProject).length === 0 ? (
              <div className="p-6 text-center text-xs text-app-muted">
                No past agent sessions in history. Closed agents from the sidebar will appear here.
              </div>
            ) : (
              Object.entries(historyByProject).map(([projectName, sessions]) => (
                <div key={projectName} className="space-y-1.5">
                  <div className="flex items-center justify-between px-1.5 text-xs text-app-muted">
                    <span className="font-semibold text-app">{projectName}</span>
                    <span className="font-mono">{sessions.length}</span>
                  </div>
                  {sessions.map((session) => {
                    const expanded = !!expandedSessionIds[session.id]
                    const menuOpen = activeHistoryMenuId === session.id
                    return (
                      <div
                        key={session.id}
                        className="rounded-card border border-app bg-app-surface/60 p-2.5 text-xs space-y-1.5 relative"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <ProviderLogo
                              id={session.cliId}
                              className="w-3.5 h-3.5 flex-shrink-0"
                            />
                            <span className="font-semibold truncate" title={session.title}>
                              {session.title}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedSessionIds((value) => ({
                                  ...value,
                                  [session.id]: !expanded,
                                }))
                              }
                              className="p-1 rounded-control text-app-muted hover:text-app hover:bg-app-elevated"
                              aria-label="Toggle details"
                            >
                              {expanded ? (
                                <ChevronDown className="w-3 h-3" />
                              ) : (
                                <ChevronRight className="w-3 h-3" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => setActiveHistoryMenuId(menuOpen ? null : session.id)}
                              className="p-1 rounded-control text-app-muted hover:text-app hover:bg-app-elevated"
                              aria-label="Session options"
                            >
                              <Ellipsis className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        <p
                          className="text-xs text-app-muted font-mono truncate"
                          title={session.lastMessage}
                        >
                          {session.lastMessage}
                        </p>
                        <div className="flex items-center justify-between text-xs text-app-muted pt-1 border-t border-app/60 font-mono">
                          <span>
                            {session.messageCount} msgs · {session.timeAgo}
                          </span>
                          <span className="truncate max-w-[110px]" title={session.model}>
                            {session.model}
                          </span>
                        </div>
                        {expanded && session.logs && (
                          <div className="mt-2 p-2 rounded-control bg-app-bg border border-app font-mono text-xs text-app-muted space-y-1">
                            {session.logs.map((log, index) => (
                              <div key={index} className="truncate">
                                {log}
                              </div>
                            ))}
                          </div>
                        )}
                        {menuOpen && (
                          <>
                            <div
                              className="fixed inset-0 z-30"
                              onClick={() => setActiveHistoryMenuId(null)}
                            />
                            <div className="absolute right-2 top-8 z-40 w-44 rounded-card bg-app-surface border border-app shadow-xl p-1 text-xs space-y-0.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveHistoryMenuId(null)
                                  onRestoreAgentToSidebar?.(session)
                                }}
                                className="w-full text-left px-2.5 py-1.5 rounded-control text-app hover:bg-app-elevated flex items-center gap-2"
                              >
                                <RotateCcw className="w-3.5 h-3.5 text-app-accent" />
                                Restore to sidebar
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveHistoryMenuId(null)
                                  onDeleteHistorySession?.(session.id)
                                }}
                                className="w-full text-left px-2.5 py-1.5 rounded-control text-rose-400 hover:bg-rose-950/40 flex items-center gap-2"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Delete entry
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </aside>
  )
}
