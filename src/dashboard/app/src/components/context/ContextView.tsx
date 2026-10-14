import { FileText, RefreshCw, ShieldCheck } from 'lucide-react'
import type React from 'react'
import { useState } from 'react'
import type { ProjectContext } from '../../types/orchestos'

interface ContextViewProps {
  context: ProjectContext
  onRefreshGraph: () => void
  isRefreshing?: boolean
}

type ContextTab = 'constitution' | 'context' | 'graph'

const SEGMENT_BASE = 'relative rounded-control px-3 py-1 text-xs font-medium transition-colors'

export const ContextView: React.FC<ContextViewProps> = ({
  context,
  onRefreshGraph,
  isRefreshing = false,
}) => {
  const [activeTab, setActiveTab] = useState<ContextTab>('constitution')

  const segment = (tab: ContextTab, label: string) => (
    <button
      type="button"
      onClick={() => setActiveTab(tab)}
      className={`${SEGMENT_BASE} ${
        activeTab === tab ? 'bg-app-elevated text-app' : 'text-app-muted hover:text-app'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div data-view="graph" className="flex min-h-full flex-1 flex-col overflow-hidden select-none">
      {/* Top Bar */}
      <div data-view-header="graph" className="flex items-center justify-between px-6 py-3">
        <div className="inline-flex items-center gap-0.5 rounded-control bg-app-bg p-0.5">
          {segment('constitution', 'CONSTITUTION.md')}
          {segment('context', 'CONTEXT.md')}
          {segment('graph', `Code Graph (${context.codeGraphNodes} files)`)}
        </div>

        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs text-app-muted tabular-nums">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-app-success" />
            {context.staleFiles.length} stale references detected
          </span>
          <button
            type="button"
            onClick={onRefreshGraph}
            disabled={isRefreshing}
            aria-busy={isRefreshing}
            className="flex h-7 items-center gap-1.5 rounded-control bg-app-elevated px-3 text-xs font-medium text-app transition-colors hover:text-app-muted disabled:opacity-60"
          >
            <RefreshCw className="h-3 w-3" />
            {isRefreshing ? 'Rebuilding…' : 'Rebuild Code Graph'}
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div data-view-content="graph" className="flex-1 overflow-y-auto px-6 pb-6">
        <div className="space-y-4">
          {activeTab === 'constitution' && (
            <div className="space-y-4 rounded-card bg-app-elevated p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-app-muted" />
                  <h3 className="text-[13px] font-semibold text-app">
                    Agent Constitution (Immutable Rules)
                  </h3>
                </div>
                <span className="text-[11px] text-app-muted">Last verified: Today</span>
              </div>
              <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-app">
                {context.constitution}
              </pre>
            </div>
          )}

          {activeTab === 'context' && (
            <div className="space-y-4 rounded-card bg-app-elevated p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-app-muted" />
                  <h3 className="text-[13px] font-semibold text-app">
                    Project Architecture Context
                  </h3>
                </div>
                <span className="text-[11px] text-app-muted">
                  Branch: {context.gitBranch || 'Not a git repository'}
                </span>
              </div>
              <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-app">
                {context.contextDoc}
              </pre>
            </div>
          )}

          {activeTab === 'graph' && (
            <div className="space-y-4 rounded-card bg-app-elevated p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[13px] font-semibold text-app">
                    Dependency Topology & Code Graph
                  </h3>
                  <div className="mt-0.5 text-xs text-app-muted tabular-nums">
                    {context.edges} dependency edges indexed locally.
                  </div>
                </div>
                <span className="text-xs text-app-muted tabular-nums">
                  {context.codeGraphNodes} source units
                </span>
              </div>

              <div className="grid grid-cols-2 gap-6 text-xs">
                <div className="space-y-1">
                  <div className="text-[11px] font-semibold text-app-muted">Git Cleanliness</div>
                  <div className="flex items-center gap-1.5 text-app">
                    {context.isCleanWorktree !== null && (
                      <span
                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                          context.isCleanWorktree ? 'bg-app-success' : 'bg-app-warning'
                        }`}
                      />
                    )}
                    {context.isCleanWorktree === null
                      ? 'Not a git repository'
                      : context.isCleanWorktree
                        ? 'Clean tree (no unstaged edits)'
                        : 'Dirty worktree'}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-[11px] font-semibold text-app-muted">
                    Language Distribution
                  </div>
                  <div className="text-app tabular-nums">
                    {context.languages.length === 0
                      ? 'No indexed source files'
                      : context.languages
                          .map(
                            (entry) =>
                              `${entry.language} (${Math.round((entry.files / context.codeGraphNodes) * 100)}%)`,
                          )
                          .join(', ')}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
