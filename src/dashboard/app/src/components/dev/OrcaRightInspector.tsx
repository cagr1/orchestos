import {
  ChevronDown,
  ChevronRight,
  Ellipsis,
  FolderOpen,
  GitCompare,
  History,
  List,
  ListTree,
  MoreHorizontal,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Search,
  Trash2,
  Upload,
} from 'lucide-react'
import type React from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { getExplorerTree, searchExplorerContents } from '../../api/explorer'
import { type GitChange, getGitChanges } from '../../api/git'
import { useAppearanceSettings } from '../../lib/appearance-settings'
import { useDiffSettings } from '../../lib/diff-settings'
import type { FileNode, ProjectItem } from '../../types/orchestos'
import { ProviderLogo } from '../common/ProviderLogos'
import { ResizableAside } from '../common/ResizableAside'
import { FileIcon } from '../ui/file-icon'
import type { OpenPathRequest } from './file-tabs'

export function attachExplorerChildren(
  nodes: FileNode[],
  path: string,
  children: FileNode[],
): FileNode[] {
  return nodes.map((node) =>
    node.path === path && !node.children
      ? { ...node, children }
      : node.children
        ? { ...node, children: attachExplorerChildren(node.children, path, children) }
        : node,
  )
}

function allExplorerFolders(nodes: FileNode[]): Record<string, boolean> {
  return Object.assign(
    {},
    ...nodes.map((node) => ({
      ...(node.isDir ? { [node.path]: true } : {}),
      ...allExplorerFolders(node.children ?? []),
    })),
  )
}

export function matchesExplorerName(node: FileNode, query: string): boolean {
  return (
    node.name.toLowerCase().includes(query.toLowerCase()) ||
    !!node.children?.some((child) => matchesExplorerName(child, query))
  )
}

export function foldersToLoad(tree: FileNode[], expanded: Record<string, boolean>): string[] {
  const openPaths = Object.entries(expanded)
    .filter(([, isExpanded]) => isExpanded)
    .map(([path]) => path)
  const folders = new Map<string, FileNode>()
  const visit = (nodes: FileNode[]) => {
    for (const node of nodes) {
      if (node.isDir) folders.set(node.path, node)
      if (node.children) visit(node.children)
    }
  }
  visit(tree)
  return openPaths
    .filter((path) => folders.has(path) && !folders.get(path)?.children)
    .sort((left, right) => left.split('/').length - right.split('/').length)
}

export type ChangeTreeNode = {
  name: string
  path: string
  file?: GitChange
  children: ChangeTreeNode[]
}

export function buildChangesTree(files: GitChange[]): ChangeTreeNode[] {
  const roots: ChangeTreeNode[] = []
  for (const file of files) {
    const parts = file.path.split('/')
    let nodes = roots
    parts.forEach((name, index) => {
      const path = parts.slice(0, index + 1).join('/')
      let node = nodes.find((entry) => entry.path === path)
      if (!node) {
        node = { name, path, children: [], ...(index === parts.length - 1 ? { file } : {}) }
        nodes.push(node)
      }
      nodes = node.children
    })
  }
  const compact = (nodes: ChangeTreeNode[]): ChangeTreeNode[] =>
    nodes
      .map((original) => {
        let node = { ...original }
        while (!node.file && node.children.length === 1 && !node.children[0]!.file) {
          const child = node.children[0]!
          node = { ...child, name: `${node.name}/${child.name}` }
        }
        return { ...node, children: compact(node.children) }
      })
      .sort((a, b) => Number(!!a.file) - Number(!!b.file) || a.name.localeCompare(b.name))
  return compact(roots)
}

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
  projects: ProjectItem[]
  historySessions?: HistorySession[]
  onRestoreAgentToSidebar?: (session: HistorySession) => void
  onDeleteHistorySession?: (sessionId: string) => void
  activeFilePath?: string | null
  activeDiffPath?: string | null
  onOpenDiff: (request: OpenPathRequest) => void
  onDiffRefresh: () => void
  onOpenFile: (path: string, options: { pin: boolean }) => void
  onUploadFiles?: (files: FileList) => void
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
  projects,
  historySessions = [],
  onRestoreAgentToSidebar,
  onDeleteHistorySession,
  onUploadFiles,
  activeFilePath,
  activeDiffPath,
  onOpenDiff,
  onDiffRefresh,
  onOpenFile,
}) => {
  const { showGitIgnored } = useAppearanceSettings()
  const diffSettings = useDiffSettings()
  const [changesLayout, setChangesLayout] = useState(diffSettings.changesLayout)
  const [changeFolders, setChangeFolders] = useState<Record<string, boolean>>({})
  useEffect(() => setChangesLayout(diffSettings.changesLayout), [diffSettings.changesLayout])
  // biome-ignore lint/correctness/useExhaustiveDependencies: cambiar de proyecto o expansión predeterminada reinicia las carpetas del diff.
  useEffect(() => setChangeFolders({}), [diffSettings.foldersExpanded, currentProject.id])
  const [activeTab, setActiveTab] = useState<'files' | 'diff' | 'history'>('files')
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({})
  const [searchQuery, setSearchQuery] = useState('')
  const [searchMode, setSearchMode] = useState<'names' | 'contents'>('names')
  const [contentResults, setContentResults] = useState<FileNode[]>([])
  const [contentError, setContentError] = useState<string | null>(null)
  const [fileTree, setFileTree] = useState<FileNode[]>([])
  const [treeError, setTreeError] = useState<string | null>(null)
  const [loadingFolders, setLoadingFolders] = useState<Record<string, boolean>>({})
  const treeRequest = useRef(0)
  const foldersInFlight = useRef(new Set<string>())
  const currentProjectId = useRef(currentProject.id)
  currentProjectId.current = currentProject.id

  const projectId = currentProject.id
  const loadTree = useCallback(() => {
    const request = ++treeRequest.current
    void getExplorerTree('', projectId)
      .then((tree) => {
        if (request !== treeRequest.current || projectId !== currentProjectId.current) return
        setFileTree(tree)
        setTreeError(null)
        setLoadingFolders({})
      })
      .catch((error) => {
        if (request === treeRequest.current && projectId === currentProjectId.current) {
          setTreeError(error instanceof Error ? error.message : 'Unable to load files.')
        }
      })
  }, [projectId])

  useEffect(() => {
    loadTree()
  }, [loadTree])

  useEffect(() => {
    const projectId = currentProject.id
    for (const path of foldersToLoad(
      fileTree,
      searchQuery && searchMode === 'names' ? allExplorerFolders(fileTree) : expandedFolders,
    )) {
      const requestKey = `${projectId}:${path}`
      if (foldersInFlight.current.has(requestKey)) continue
      foldersInFlight.current.add(requestKey)
      setLoadingFolders((prev) => ({ ...prev, [path]: true }))
      void getExplorerTree(path, projectId)
        .then((children) => {
          if (projectId !== currentProjectId.current) return
          setFileTree((prev) => attachExplorerChildren(prev, path, children))
          setTreeError(null)
        })
        .catch((error) => {
          if (projectId === currentProjectId.current) {
            setTreeError(error instanceof Error ? error.message : 'Unable to load files.')
          }
        })
        .finally(() => {
          foldersInFlight.current.delete(requestKey)
          if (projectId === currentProjectId.current) {
            setLoadingFolders((prev) => ({ ...prev, [path]: false }))
          }
        })
    }
  }, [fileTree, expandedFolders, currentProject.id, searchQuery, searchMode])

  useEffect(() => {
    setContentResults([])
    setContentError(null)
    if (searchMode !== 'contents' || searchQuery.trim().length < 2) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      void searchExplorerContents(searchQuery, projectId, controller.signal)
        .then((files) => {
          if (!controller.signal.aborted) setContentResults(files)
        })
        .catch((error) => {
          if (!controller.signal.aborted)
            setContentError(error instanceof Error ? error.message : String(error))
        })
    }, 200)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [projectId, searchQuery, searchMode])

  const [gitFiles, setGitFiles] = useState<GitChange[]>([])
  const [gitError, setGitError] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const refreshRef = useRef(onDiffRefresh)
  refreshRef.current = onDiffRefresh

  // biome-ignore lint/correctness/useExhaustiveDependencies: cambiar de proyecto descarta los cambios git del proyecto anterior.
  useEffect(() => {
    setGitFiles([])
  }, [currentProject.id])

  // biome-ignore lint/correctness/useExhaustiveDependencies: refresh fuerza la lectura al pulsar Refresh git changes.
  useEffect(() => {
    if (activeTab !== 'diff') return
    let cancelled = false
    const load = async () => {
      try {
        const data = await getGitChanges(currentProject.id, diffSettings.ignoreWhitespace)
        if (!cancelled) {
          setGitFiles(data.files)
          setGitError(false)
          refreshRef.current()
        }
      } catch {
        if (!cancelled) setGitError(true)
      }
    }
    void load()
    const timer = window.setInterval(() => void load(), 4000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [activeTab, currentProject.id, refresh, diffSettings.ignoreWhitespace])

  // History Tab specific states
  const [historyScope, setHistoryScope] = useState<'workspace' | 'project' | 'all'>('workspace')
  const [historySearch, setHistorySearch] = useState('')
  const [expandedSessionIds, setExpandedSessionIds] = useState<Record<string, boolean>>({})
  const [activeHistoryMenuId, setActiveHistoryMenuId] = useState<string | null>(null)

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => ({ ...prev, [path]: !prev[path] }))
  }

  const toggleSessionExpand = (id: string) => {
    setExpandedSessionIds((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  // Filter history sessions
  const filteredHistory = historySessions.filter((s) => {
    if (historyScope === 'project' && s.projectId !== currentProject.id) {
      return false
    }
    if (historySearch.trim()) {
      const q = historySearch.toLowerCase()
      return (
        s.title.toLowerCase().includes(q) ||
        s.lastMessage.toLowerCase().includes(q) ||
        s.model.toLowerCase().includes(q) ||
        s.projectName.toLowerCase().includes(q)
      )
    }
    return true
  })

  // Group filtered history by project
  const historyByProject: Record<string, HistorySession[]> = {}
  filteredHistory.forEach((s) => {
    const key = s.projectName || s.projectId
    if (!historyByProject[key]) {
      historyByProject[key] = []
    }
    historyByProject[key].push(s)
  })

  const renderTree = (nodes: FileNode[], depth = 0) => {
    return nodes
      .filter((node) => {
        if (!showGitIgnored && node.ignored) return false
        if (!searchQuery || searchMode === 'contents') return true
        return matchesExplorerName(node, searchQuery)
      })
      .map((node) => {
        const isFolder = node.isDir
        const isExpanded = !!searchQuery || !!expandedFolders[node.path]
        const isSelected = activeFilePath === node.path

        return (
          <div key={node.path} className="select-none">
            <button
              type="button"
              onClick={() => {
                if (isFolder) {
                  toggleFolder(node.path)
                } else {
                  onOpenFile(node.path, { pin: false })
                }
              }}
              onDoubleClick={() => {
                if (!isFolder) onOpenFile(node.path, { pin: true })
              }}
              data-explorer-file={isFolder ? undefined : node.path}
              style={{ paddingLeft: `${depth * 14 + 10}px` }}
              className={`w-full flex items-center justify-between py-1 px-2 rounded-control text-xs text-left cursor-pointer transition-colors ${
                isSelected
                  ? 'bg-app-surface text-app-accent font-medium border border-app'
                  : 'text-app-muted hover:text-app hover:bg-app-surface/50'
              } ${node.ignored ? 'opacity-50 italic' : ''}`}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                {isFolder ? (
                  <>
                    {isExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5 text-app-muted flex-shrink-0" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-app-muted flex-shrink-0" />
                    )}
                    <FileIcon
                      name={node.name}
                      kind="folder"
                      expanded={isExpanded}
                      className="w-3.5 h-3.5 flex-shrink-0"
                    />
                  </>
                ) : (
                  <>
                    <span className="w-3.5" />
                    <FileIcon name={node.name} kind="file" className="w-3.5 h-3.5 flex-shrink-0" />
                  </>
                )}
                <span className="truncate">{node.name}</span>
              </div>
              {node.size && (
                <span className="text-xs font-mono text-app-muted ml-2">{node.size}</span>
              )}
            </button>

            {isFolder && isExpanded && loadingFolders[node.path] && (
              <div
                className="px-2 py-1 text-xs text-app-muted/60"
                style={{ paddingLeft: `${(depth + 1) * 14 + 10}px` }}
              >
                Loading…
              </div>
            )}
            {isFolder && isExpanded && node.children && (
              <div>{renderTree(node.children, depth + 1)}</div>
            )}
          </div>
        )
      })
  }

  const renderChangeFile = (file: GitChange) => {
    const parts = file.path.split('/')
    const name = parts.pop()
    const statusColor =
      file.status === 'M'
        ? 'text-app-warning'
        : file.status === 'D'
          ? 'text-app-error [[data-diff-palette=colorblind]_&]:text-orange-400'
          : file.status === 'R'
            ? 'text-app-accent'
            : 'text-emerald-400 [[data-diff-palette=colorblind]_&]:text-sky-400'
    return (
      <div key={file.path}>
        <DiffFileButton
          path={file.path}
          selected={activeDiffPath === file.path}
          onOpen={onOpenDiff}
        >
          <FileIcon name={name ?? file.path} kind="file" className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="text-app truncate">{name}</span>
          <span className="text-app-muted truncate flex-1">{parts.join('/')}</span>
          <span className="font-mono text-emerald-400 flex-shrink-0 [[data-diff-palette=colorblind]_&]:text-sky-400">
            +{file.additions}
          </span>
          <span className="font-mono text-app-error flex-shrink-0 [[data-diff-palette=colorblind]_&]:text-orange-400">
            −{file.deletions}
          </span>
          <span className={`font-mono flex-shrink-0 ${statusColor}`}>{file.status}</span>
        </DiffFileButton>
      </div>
    )
  }

  const renderChangesTree = (nodes: ChangeTreeNode[], depth = 0): React.ReactNode =>
    nodes.map((node) => {
      if (node.file)
        return (
          <div key={node.path} style={{ paddingLeft: `${depth * 14}px` }}>
            {renderChangeFile(node.file)}
          </div>
        )
      const expanded = changeFolders[node.path] ?? diffSettings.foldersExpanded
      return (
        <div key={node.path}>
          <button
            type="button"
            data-changes-folder={node.path}
            aria-expanded={expanded}
            onClick={() =>
              setChangeFolders((previous) => ({ ...previous, [node.path]: !expanded }))
            }
            style={{ paddingLeft: `${depth * 14 + 10}px` }}
            className="w-full flex items-center gap-1.5 py-1 px-2 rounded-control text-xs text-left text-app-muted hover:text-app hover:bg-app-surface/50"
          >
            {expanded ? (
              <ChevronDown className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 shrink-0" />
            )}
            <FileIcon
              name={node.name}
              kind="folder"
              expanded={expanded}
              className="w-3.5 h-3.5 shrink-0"
            />
            <span className="truncate">{node.name}</span>
          </button>
          {expanded && renderChangesTree(node.children, depth + 1)}
        </div>
      )
    })

  return (
    <ResizableAside
      side="right"
      className="flex-shrink-0 border-l border-app bg-app-bg flex flex-col h-full text-app select-none z-10"
    >
      {/* Top Header with Tab Switcher (No redundant X button - only single toggle in ShellHeader) */}
      <div
        data-inspector-tabs
        className="h-10 border-b border-app px-2 flex items-center justify-between bg-app-surface/40 flex-shrink-0"
      >
        <div className="flex items-center gap-1 w-full justify-between">
          <button
            type="button"
            onClick={() => setActiveTab('files')}
            className={`app-tab-btn ${
              activeTab === 'files' ? 'app-tab-btn-active' : 'app-tab-btn-inactive'
            }`}
            title="Project File Explorer"
            aria-label="Files"
          >
            <FolderOpen className="w-3.5 h-3.5 text-app-accent" />
            <span>Files</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('diff')}
            className={`app-tab-btn ${
              activeTab === 'diff' ? 'app-tab-btn-active' : 'app-tab-btn-inactive'
            }`}
            title="Git Worktree Diff"
            aria-label="Diff"
          >
            <GitCompare className="w-3.5 h-3.5 text-emerald-400" />
            <span>Diff</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`app-tab-btn ${
              activeTab === 'history' ? 'app-tab-btn-active' : 'app-tab-btn-inactive'
            }`}
            title="Agent History"
            aria-label="History"
          >
            <History className="w-3.5 h-3.5 text-amber-400" />
            <span>History</span>
          </button>
        </div>
      </div>

      {/* TAB 1: File Explorer */}
      {activeTab === 'files' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Project Title + Action Icons */}
          <div className="p-3 border-b border-app flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-xs text-app tracking-wide truncate max-w-[180px]">
                {currentProject.name}
              </span>
              <span className="text-xs font-mono px-1.5 py-0.5 rounded-pill bg-app-surface text-app-muted border border-app">
                {currentProject.branch}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <label
                className="p-1 text-app-muted hover:text-app hover:bg-app-surface rounded-control cursor-pointer transition-colors"
                title="Upload folder or files"
                aria-label="Upload files"
              >
                <Upload className="w-3.5 h-3.5" />
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && onUploadFiles) {
                      onUploadFiles(e.target.files)
                    }
                  }}
                />
              </label>
              <button
                type="button"
                onClick={loadTree}
                className="p-1 text-app-muted hover:text-app hover:bg-app-surface rounded-control transition-colors"
                title="Refresh tree"
                aria-label="Refresh file tree"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                className="p-1 text-app-muted hover:text-app hover:bg-app-surface rounded-control transition-colors"
                title="More options"
                aria-label="More file options"
              >
                <MoreHorizontal className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Search box with integrated Aa / {} mode toggle */}
          <div className="p-2 border-b border-app flex-shrink-0">
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 text-app-muted absolute left-2.5 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Find files"
                className="w-full pl-8 pr-14 py-1 text-xs bg-app-surface border border-app rounded-control focus:border-app-accent focus:outline-hidden text-app placeholder:text-app-muted font-mono"
              />
              <div className="absolute right-1.5 flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => setSearchMode('names')}
                  className={`px-1 py-0.5 text-[10px] font-mono rounded-control transition-colors ${
                    searchMode === 'names'
                      ? 'bg-app-elevated text-app font-bold border border-app shadow-2xs'
                      : 'text-app-muted hover:text-app'
                  }`}
                  title="Search file names (Aa)"
                  aria-label="Search file names"
                >
                  Aa
                </button>
                <button
                  type="button"
                  onClick={() => setSearchMode('contents')}
                  className={`px-1 py-0.5 text-[10px] font-mono rounded-control transition-colors ${
                    searchMode === 'contents'
                      ? 'bg-app-elevated text-app font-bold border border-app shadow-2xs'
                      : 'text-app-muted hover:text-app'
                  }`}
                  title="Search file contents ({})"
                  aria-label="Search file contents"
                >
                  {`{}`}
                </button>
              </div>
            </div>
          </div>

          {/* Tree View */}
          <div className="flex-1 overflow-y-auto p-1 font-mono text-xs">
            {contentError || treeError ? (
              <div role="alert" className="p-2 text-xs text-rose-400">
                {contentError || treeError}
              </div>
            ) : (
              renderTree(searchMode === 'contents' && searchQuery ? contentResults : fileTree)
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Worktree Diff */}
      {activeTab === 'diff' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-3 border-b border-app flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-app">CHANGES</span>
              <span className="px-1.5 rounded-pill bg-app-surface text-xs text-app-muted">
                {gitFiles.length}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Changes layout"
                title={changesLayout === 'list' ? 'Tree' : 'List'}
                aria-pressed={changesLayout === 'tree'}
                onClick={() => setChangesLayout((value) => (value === 'list' ? 'tree' : 'list'))}
                className="p-1 text-app-muted hover:text-app rounded-control"
              >
                {changesLayout === 'list' ? (
                  <ListTree className="w-3.5 h-3.5" />
                ) : (
                  <List className="w-3.5 h-3.5" />
                )}
              </button>
              <button
                type="button"
                aria-label="Refresh git changes"
                onClick={() => setRefresh((value) => value + 1)}
                className="p-1 text-app-muted hover:text-app rounded-control"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-1">
            {gitError && (
              <div className="p-3 text-xs text-app-muted">Could not read git changes</div>
            )}
            {!gitError && gitFiles.length === 0 && (
              <div className="p-3 text-xs text-app-muted">No changes</div>
            )}
            {changesLayout === 'list'
              ? gitFiles.map(renderChangeFile)
              : renderChangesTree(buildChangesTree(gitFiles))}
          </div>
        </div>
      )}

      {/* TAB 3: History (Agent History exactly as specified) */}
      {activeTab === 'history' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header: Title + "N shown" */}
          <div className="p-3 border-b border-app flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-app">History</h2>
              <span className="px-2 py-0.5 rounded-pill bg-app-surface border border-app text-xs font-mono text-app-muted">
                {filteredHistory.length} shown
              </span>
            </div>
          </div>

          {/* Segmented control: Workspace | Project | All */}
          <div className="p-2 border-b border-app space-y-2 flex-shrink-0">
            <div className="grid grid-cols-3 gap-1 p-0.5 bg-app-surface rounded-control border border-app text-xs">
              <button
                type="button"
                onClick={() => setHistoryScope('workspace')}
                className={`py-1 rounded-control text-center font-medium transition-colors ${
                  historyScope === 'workspace'
                    ? 'bg-app-elevated text-app font-semibold shadow-xs'
                    : 'text-app-muted hover:text-app'
                }`}
              >
                Workspace
              </button>
              <button
                type="button"
                onClick={() => setHistoryScope('project')}
                className={`py-1 rounded-control text-center font-medium transition-colors ${
                  historyScope === 'project'
                    ? 'bg-app-elevated text-app font-semibold shadow-xs'
                    : 'text-app-muted hover:text-app'
                }`}
              >
                Project
              </button>
              <button
                type="button"
                onClick={() => setHistoryScope('all')}
                className={`py-1 rounded-control text-center font-medium transition-colors ${
                  historyScope === 'all'
                    ? 'bg-app-elevated text-app font-semibold shadow-xs'
                    : 'text-app-muted hover:text-app'
                }`}
              >
                All
              </button>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-app-muted absolute left-2.5 top-2" />
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Search agent sessions..."
                className="w-full pl-8 pr-2.5 py-1 text-xs bg-app-surface border border-app rounded-control focus:border-app-accent focus:outline-hidden text-app placeholder:text-app-muted"
              />
            </div>
          </div>

          {/* History list grouped by project with counter */}
          <div className="flex-1 overflow-y-auto p-2 space-y-3">
            {Object.keys(historyByProject).length === 0 ? (
              <div className="p-6 text-center text-xs text-app-muted">
                No past agent sessions in history. Closed agents from the sidebar will appear here.
              </div>
            ) : (
              Object.entries(historyByProject).map(([projectName, sessions]) => (
                <div key={projectName} className="space-y-1.5">
                  {/* Group header with counter */}
                  <div className="flex items-center justify-between px-1.5 text-xs text-app-muted">
                    <span className="font-semibold text-app">{projectName}</span>
                    <span className="font-mono text-app-muted">{sessions.length}</span>
                  </div>

                  {/* Sessions in this project */}
                  <div className="space-y-1.5">
                    {sessions.map((session) => {
                      const isExpanded = !!expandedSessionIds[session.id]
                      const isMenuOpen = activeHistoryMenuId === session.id

                      return (
                        <div
                          key={session.id}
                          className="rounded-card border border-app bg-app-surface/60 p-2.5 text-xs space-y-1.5 hover:border-app transition-colors relative"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <ProviderLogo
                                id={session.cliId}
                                className="w-3.5 h-3.5 flex-shrink-0"
                              />
                              <span
                                className="font-semibold text-app truncate"
                                title={session.title}
                              >
                                {session.title}
                              </span>
                            </div>

                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                type="button"
                                onClick={() => toggleSessionExpand(session.id)}
                                className="p-1 rounded-control text-app-muted hover:text-app hover:bg-app-elevated transition-colors"
                                title={isExpanded ? 'Collapse session' : 'Expand session'}
                                aria-label="Toggle details"
                              >
                                {isExpanded ? (
                                  <ChevronDown className="w-3 h-3" />
                                ) : (
                                  <ChevronRight className="w-3 h-3" />
                                )}
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  setActiveHistoryMenuId(isMenuOpen ? null : session.id)
                                }
                                className="p-1 rounded-control text-app-muted hover:text-app hover:bg-app-elevated transition-colors"
                                title="Session options"
                                aria-label="Session options"
                              >
                                <Ellipsis className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                          {/* Last line of the message */}
                          <p
                            className="text-xs text-app-muted font-mono truncate"
                            title={session.lastMessage}
                          >
                            {session.lastMessage}
                          </p>

                          {/* Meta: message count, time ago, model */}
                          <div className="flex items-center justify-between text-xs text-app-muted pt-1 border-t border-app/60 font-mono">
                            <div className="flex items-center gap-2">
                              <span>{session.messageCount} msgs</span>
                              <span>·</span>
                              <span>{session.timeAgo}</span>
                            </div>
                            <span
                              className="text-app-muted/90 truncate max-w-[110px]"
                              title={session.model}
                            >
                              {session.model}
                            </span>
                          </div>

                          {/* Expanded detail logs */}
                          {isExpanded && session.logs && (
                            <div className="mt-2 p-2 rounded-control bg-app-bg border border-app font-mono text-xs text-app-muted space-y-1">
                              {session.logs.map((log, i) => (
                                <div key={i} className="truncate">
                                  {log}
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Ellipsis menu dropdown */}
                          {isMenuOpen && (
                            <>
                              <button
                                type="button"
                                aria-label="Close menu"
                                className="fixed inset-0 z-30"
                                onClick={() => setActiveHistoryMenuId(null)}
                              />
                              <div className="absolute right-2 top-8 z-40 w-44 rounded-card bg-app-surface border border-app shadow-xl p-1 text-xs space-y-0.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveHistoryMenuId(null)
                                    if (onRestoreAgentToSidebar) {
                                      onRestoreAgentToSidebar(session)
                                    }
                                  }}
                                  className="w-full text-left px-2.5 py-1.5 rounded-control text-app hover:bg-app-elevated flex items-center gap-2"
                                >
                                  <RotateCcw className="w-3.5 h-3.5 text-app-accent" />
                                  <span>Restore to sidebar</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveHistoryMenuId(null)
                                    if (onDeleteHistorySession) {
                                      onDeleteHistorySession(session.id)
                                    }
                                  }}
                                  className="w-full text-left px-2.5 py-1.5 rounded-control text-rose-400 hover:bg-rose-950/40 flex items-center gap-2"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                                  <span>Delete entry</span>
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </ResizableAside>
  )
}

export function DiffFileButton({
  path,
  selected,
  onOpen,
  children,
}: {
  path: string
  selected: boolean
  onOpen: (request: OpenPathRequest) => void
  children?: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={path}
      data-diff-file={path}
      aria-pressed={selected}
      onClick={() => onOpen({ kind: 'diff', path, pin: false })}
      onDoubleClick={() => onOpen({ kind: 'diff', path, pin: true })}
      className={`w-full flex items-center gap-2 px-2 py-1 text-xs text-left hover:bg-app-surface rounded-control ${selected ? 'bg-app-surface' : ''}`}
    >
      {children}
    </button>
  )
}
