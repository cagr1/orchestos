import { FileText } from 'lucide-react'
import type React from 'react'
import type { ProjectContext } from '../../types/orchestos'

interface ContextViewProps {
  context: ProjectContext
}

export const ContextView: React.FC<ContextViewProps> = ({ context }) => {
  return (
    <div data-view="graph" className="flex min-h-full flex-1 flex-col overflow-hidden select-none">
      {/* Top Bar */}
      <div data-view-header="graph" className="flex items-center justify-between px-6 py-3">
        <div className="inline-flex items-center gap-0.5 rounded-control bg-app-bg p-0.5">
          <span className="relative rounded-control px-3 py-1 text-xs font-medium transition-colors bg-app-elevated text-app">
            CONTEXT.md
          </span>
        </div>
      </div>

      {/* Content Area */}
      <div data-view-content="graph" className="flex-1 overflow-y-auto px-6 pb-6">
        <div className="space-y-4">
          <div className="space-y-4 rounded-card bg-app-elevated p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-app-muted" />
                <h3 className="text-[13px] font-semibold text-app">Project Architecture Context</h3>
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
        </div>
      </div>
    </div>
  )
}
