import React, { useState } from 'react';
import {
  Folder,
  FolderOpen,
  FileCode,
  FileText,
  ChevronRight,
  ChevronDown,
  Search,
  RefreshCw,
  MoreHorizontal,
  Upload,
  GitCompare,
  History,
  Sliders,
  ShieldCheck,
  Ellipsis,
  MessageSquare,
  Clock,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { FileNode, ProjectItem, RunItem } from '../../types/orchestos';
import { ORCHESTOS_FILE_TREE } from '../../data/orcaProjectData';
import { ProviderLogo } from '../common/ProviderLogos';

export interface HistorySession {
  id: string;
  projectId: string;
  projectName: string;
  title: string;
  lastMessage: string;
  cliId: string;
  model: string;
  messageCount: number;
  timeAgo: string;
  logs?: string[];
}

interface OrcaRightInspectorProps {
  currentProject: ProjectItem;
  projects: ProjectItem[];
  recentRuns: RunItem[];
  historySessions?: HistorySession[];
  onRestoreAgentToSidebar?: (session: HistorySession) => void;
  onDeleteHistorySession?: (sessionId: string) => void;
  onUploadFiles?: (files: FileList) => void;
}

export const OrcaRightInspector: React.FC<OrcaRightInspectorProps> = ({
  currentProject,
  projects,
  recentRuns,
  historySessions = [],
  onRestoreAgentToSidebar,
  onDeleteHistorySession,
  onUploadFiles,
}) => {
  const [activeTab, setActiveTab] = useState<'files' | 'diff' | 'history'>('files');
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    context: true,
    dashboard: true,
    tasks: true,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState<'names' | 'contents'>('names');
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(
    ORCHESTOS_FILE_TREE[0]?.children?.[0] || null
  );

  // History Tab specific states
  const [historyScope, setHistoryScope] = useState<'workspace' | 'project' | 'all'>('workspace');
  const [historySearch, setHistorySearch] = useState('');
  const [expandedSessionIds, setExpandedSessionIds] = useState<Record<string, boolean>>({});
  const [activeHistoryMenuId, setActiveHistoryMenuId] = useState<string | null>(null);

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => ({ ...prev, [path]: !prev[path] }));
  };

  const toggleSessionExpand = (id: string) => {
    setExpandedSessionIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Filter history sessions
  const filteredHistory = historySessions.filter((s) => {
    if (historyScope === 'project' && s.projectId !== currentProject.id) {
      return false;
    }
    if (historySearch.trim()) {
      const q = historySearch.toLowerCase();
      return (
        s.title.toLowerCase().includes(q) ||
        s.lastMessage.toLowerCase().includes(q) ||
        s.model.toLowerCase().includes(q) ||
        s.projectName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Group filtered history by project
  const historyByProject: Record<string, HistorySession[]> = {};
  filteredHistory.forEach((s) => {
    const key = s.projectName || s.projectId;
    if (!historyByProject[key]) {
      historyByProject[key] = [];
    }
    historyByProject[key].push(s);
  });

  const renderTree = (nodes: FileNode[], depth = 0) => {
    return nodes
      .filter((node) => {
        if (!searchQuery) return true;
        return node.name.toLowerCase().includes(searchQuery.toLowerCase());
      })
      .map((node) => {
        const isFolder = node.isDir;
        const isExpanded = !!expandedFolders[node.path];
        const isSelected = selectedFile?.path === node.path;

        return (
          <div key={node.path} className="select-none">
            <button
              type="button"
              onClick={() => {
                if (isFolder) {
                  toggleFolder(node.path);
                } else {
                  setSelectedFile(node);
                }
              }}
              style={{ paddingLeft: `${depth * 14 + 10}px` }}
              className={`w-full flex items-center justify-between py-1 px-2 rounded-control text-xs text-left cursor-pointer transition-colors ${
                isSelected
                  ? 'bg-app-surface text-app-accent font-medium border border-app'
                  : 'text-app-muted hover:text-app hover:bg-app-surface/50'
              }`}
            >
              <div className="flex items-center gap-1.5 min-w-0">
                {isFolder ? (
                  <>
                    {isExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5 text-app-muted flex-shrink-0" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-app-muted flex-shrink-0" />
                    )}
                    <Folder className={`w-3.5 h-3.5 flex-shrink-0 ${isExpanded ? 'text-app-accent' : 'text-app-muted'}`} />
                  </>
                ) : (
                  <>
                    <span className="w-3.5" />
                    {node.name.endsWith('.md') ? (
                      <FileText className="w-3.5 h-3.5 text-amber-400/80 flex-shrink-0" />
                    ) : (
                      <FileCode className="w-3.5 h-3.5 text-sky-400/80 flex-shrink-0" />
                    )}
                  </>
                )}
                <span className="truncate">{node.name}</span>
              </div>
              {node.size && (
                <span className="text-xs font-mono text-app-muted ml-2">{node.size}</span>
              )}
            </button>

            {isFolder && isExpanded && node.children && (
              <div>{renderTree(node.children, depth + 1)}</div>
            )}
          </div>
        );
      });
  };

  return (
    <aside className="w-96 flex-shrink-0 border-l border-app bg-app-bg flex flex-col h-full overflow-hidden text-app select-none z-10">
      {/* Top Header with Tab Switcher (No redundant X button - only single toggle in ShellHeader) */}
      <div className="h-11 border-b border-app px-2 flex items-center justify-between bg-app-surface/40 flex-shrink-0">
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
                      onUploadFiles(e.target.files);
                    }
                  }}
                />
              </label>
              <button
                type="button"
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

          {/* Search box & filter pills */}
          <div className="p-2 border-b border-app space-y-2 flex-shrink-0">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-app-muted absolute left-2.5 top-2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Find files"
                className="w-full pl-8 pr-2.5 py-1 text-xs bg-app-surface border border-app rounded-control focus:border-app-accent focus:outline-hidden text-app placeholder:text-app-muted font-mono"
              />
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setSearchMode('names')}
                className={`flex-1 py-0.5 text-xs font-medium rounded-control transition-colors ${
                  searchMode === 'names'
                    ? 'bg-app-elevated text-app shadow-xs border border-app'
                    : 'text-app-muted hover:text-app'
                }`}
              >
                Names
              </button>
              <button
                type="button"
                onClick={() => setSearchMode('contents')}
                className={`flex-1 py-0.5 text-xs font-medium rounded-control transition-colors ${
                  searchMode === 'contents'
                    ? 'bg-app-elevated text-app shadow-xs border border-app'
                    : 'text-app-muted hover:text-app'
                }`}
              >
                Contents
              </button>
            </div>
          </div>

          {/* Tree View */}
          <div className="flex-1 overflow-y-auto p-1 font-mono text-xs">
            {renderTree(ORCHESTOS_FILE_TREE)}
          </div>

          {/* File Preview Drawer if selected */}
          {selectedFile && selectedFile.content && (
            <div className="h-56 border-t border-app bg-app-surface flex flex-col flex-shrink-0">
              <div className="px-3 py-1.5 border-b border-app bg-app-elevated/70 flex items-center justify-between text-xs">
                <span className="font-mono text-xs text-app-accent font-medium truncate" title={selectedFile.path}>
                  {selectedFile.path}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedFile(null)}
                  className="text-app-muted hover:text-app text-xs"
                >
                  Close
                </button>
              </div>
              <div className="flex-1 p-2.5 overflow-auto font-mono text-xs text-app bg-app-bg whitespace-pre leading-relaxed">
                {selectedFile.content}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Worktree Diff */}
      {activeTab === 'diff' && (
        <div className="flex-1 flex flex-col p-3 overflow-y-auto space-y-3">
          <div className="p-2.5 rounded-card bg-app-surface border border-app text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-app-muted font-medium">Worktree Sandbox</span>
              <span className="text-xs font-mono text-emerald-400 bg-emerald-950/40 px-1.5 py-0.5 rounded-pill border border-emerald-800/40">
                refs/orchestos/sandbox-t3
              </span>
            </div>
            <p className="text-xs text-app-muted">
              Isolated branch modifications awaiting dual QA pass before merging to master.
            </p>
          </div>

          <div className="space-y-2">
            <div className="text-xs font-bold text-app-muted uppercase tracking-wider">
              Modified Files in Contract (2)
            </div>

            <div className="border border-app rounded-card bg-app-surface overflow-hidden text-xs">
              <div className="px-3 py-1.5 bg-app-elevated border-b border-app flex items-center justify-between font-mono text-xs">
                <span className="text-app font-medium">src/run/contract-check.ts</span>
                <span className="text-emerald-400 text-xs">+14 -2</span>
              </div>
              <div className="p-2 font-mono text-xs space-y-0.5 bg-app-bg">
                <div className="text-app-muted">@@ -42,6 +42,18 @@</div>
                <div className="text-emerald-400 bg-emerald-950/30 px-1 rounded-control">
                  + export function enforceOutputSlice(attempted: string[], slice: string[]) &#123;
                </div>
                <div className="text-emerald-400 bg-emerald-950/30 px-1 rounded-control">
                  +   const illegal = attempted.filter(p =&gt; !slice.includes(p));
                </div>
                <div className="text-emerald-400 bg-emerald-950/30 px-1 rounded-control">
                  +   if (illegal.length &gt; 0) throw new BoundaryError(illegal);
                </div>
                <div className="text-emerald-400 bg-emerald-950/30 px-1 rounded-control">+ &#125;</div>
                <div className="text-rose-400 bg-rose-950/30 px-1 rounded-control">- // unchecked file write</div>
              </div>
            </div>

            <div className="border border-app rounded-card bg-app-surface overflow-hidden text-xs">
              <div className="px-3 py-1.5 bg-app-elevated border-b border-app flex items-center justify-between font-mono text-xs">
                <span className="text-app font-medium">tasks/tasks.yaml</span>
                <span className="text-emerald-400 text-xs">+6 -0</span>
              </div>
              <div className="p-2 font-mono text-xs space-y-0.5 bg-app-bg">
                <div className="text-app-muted">@@ -18,2 +18,8 @@</div>
                <div className="text-emerald-400 bg-emerald-950/30 px-1 rounded-control">
                  +   qa_verdict: pass
                </div>
                <div className="text-emerald-400 bg-emerald-950/30 px-1 rounded-control">
                  +   run_id: run_88190a
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: History (Agent History exactly as specified) */}
      {activeTab === 'history' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Header: Title + "N shown" */}
          <div className="p-3 border-b border-app flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-app">
                History
              </h2>
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
                      const isExpanded = !!expandedSessionIds[session.id];
                      const isMenuOpen = activeHistoryMenuId === session.id;

                      return (
                        <div
                          key={session.id}
                          className="rounded-card border border-app bg-app-surface/60 p-2.5 text-xs space-y-1.5 hover:border-app transition-colors relative"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <ProviderLogo id={session.cliId} className="w-3.5 h-3.5 flex-shrink-0" />
                              <span className="font-semibold text-app truncate" title={session.title}>
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
                                onClick={() => setActiveHistoryMenuId(isMenuOpen ? null : session.id)}
                                className="p-1 rounded-control text-app-muted hover:text-app hover:bg-app-elevated transition-colors"
                                title="Session options"
                                aria-label="Session options"
                              >
                                <Ellipsis className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                          {/* Last line of the message */}
                          <p className="text-xs text-app-muted font-mono truncate" title={session.lastMessage}>
                            {session.lastMessage}
                          </p>

                          {/* Meta: message count, time ago, model */}
                          <div className="flex items-center justify-between text-xs text-app-muted pt-1 border-t border-app/60 font-mono">
                            <div className="flex items-center gap-2">
                              <span>{session.messageCount} msgs</span>
                              <span>·</span>
                              <span>{session.timeAgo}</span>
                            </div>
                            <span className="text-app-muted/90 truncate max-w-[110px]" title={session.model}>
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
                              <div
                                className="fixed inset-0 z-30"
                                onClick={() => setActiveHistoryMenuId(null)}
                              />
                              <div className="absolute right-2 top-8 z-40 w-44 rounded-card bg-app-surface border border-app shadow-xl p-1 text-xs space-y-0.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveHistoryMenuId(null);
                                    if (onRestoreAgentToSidebar) {
                                      onRestoreAgentToSidebar(session);
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
                                    setActiveHistoryMenuId(null);
                                    if (onDeleteHistorySession) {
                                      onDeleteHistorySession(session.id);
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
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </aside>
  );
};
