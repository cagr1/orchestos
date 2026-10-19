import { FileText, ShieldCheck } from 'lucide-react'
import type React from 'react'
import { useState } from 'react'
import type { ProjectContext } from '../../types/orchestos'

interface ContextViewProps {
  context: ProjectContext
}

type ContextTab = 'constitution' | 'context'

const SEGMENT_BASE = 'relative rounded-control px-3 py-1 text-xs font-medium transition-colors'

export const ContextView: React.FC<ContextViewProps> = ({ context }) => {
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
                  {context.isCleanWorktree !== null &&
                    ` · ${context.isCleanWorktree ? 'Clean tree' : 'Dirty worktree'}`}
                </span>
              </div>
              <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-app">
                {context.contextDoc}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
