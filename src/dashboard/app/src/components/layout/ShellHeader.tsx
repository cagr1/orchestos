import { FolderGit2, PanelLeft, PanelRight, Search } from 'lucide-react'
import type React from 'react'
import type { SessionContextResponse } from '../../api/chat'
import { ContextRing } from '../common/ContextRing'

interface ShellHeaderProps {
  onOpenCommandPalette: () => void
  onToggleLeftSidebar?: () => void
  onToggleRightInspector?: () => void
  isRightInspectorOpen?: boolean
  activeProjectName?: string
  activeBranch?: string
  sessionContext?: SessionContextResponse | null
}

export const ShellHeader: React.FC<ShellHeaderProps> = ({
  onOpenCommandPalette,
  onToggleLeftSidebar,
  onToggleRightInspector,
  isRightInspectorOpen = true,
  activeProjectName = 'orchestos',
  activeBranch = 'master',
  sessionContext,
}) => {
  return (
    <header
      data-shell-header
      className="h-11 bg-app-bg px-3.5 flex items-center justify-between select-none text-app flex-shrink-0 z-20"
    >
      {/* Left: Brand + Search + Sidebar Toggle */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 text-[13px] font-semibold tracking-tight text-app cursor-pointer select-none">
          <span className="text-app">Orchest</span>
          <span className="text-app-accent">OS</span>
        </div>

        <div className="flex items-center gap-1 ml-1">
          {/* Quick search button */}
          <button
            type="button"
            onClick={onOpenCommandPalette}
            className="p-1.5 rounded-control text-app-muted hover:text-app hover:bg-app-surface transition-colors"
            title="Search tasks, runs, specs (⌘K)"
            aria-label="Open Command Palette"
          >
            <Search className="w-3.5 h-3.5" />
          </button>

          {/* Toggle left sidebar button */}
          {onToggleLeftSidebar && (
            <button
              type="button"
              onClick={onToggleLeftSidebar}
              className="p-1.5 rounded-control text-app-muted hover:text-app hover:bg-app-surface transition-colors"
              title="Toggle Navigation Sidebar"
              aria-label="Toggle Navigation Sidebar"
            >
              <PanelLeft className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Middle: Subtle project breadcrumb (kept exactly as requested) */}
      <div className="hidden sm:flex items-center gap-2 text-[12.5px] text-app-muted">
        <FolderGit2 className="w-3.5 h-3.5 text-app-muted" />
        <span className="text-app font-medium">{activeProjectName}</span>
        <span className="text-app-muted/60">/</span>
        <span className="text-app-muted">{activeBranch}</span>
      </div>

      {/* Right: Only single toggle button for right inspector (status indicator removed as requested) */}
      <div className="flex items-center gap-2">
        {sessionContext?.pct != null && !Number.isNaN(sessionContext.pct) && (
          <ContextRing
            percent={sessionContext.pct}
            usedTokens={sessionContext.used ?? undefined}
            maxTokens={sessionContext.window ?? undefined}
          />
        )}
        {onToggleRightInspector && (
          <button
            type="button"
            onClick={onToggleRightInspector}
            className={`p-1.5 rounded-control transition-colors ${
              isRightInspectorOpen
                ? 'text-app bg-app-surface'
                : 'text-app-muted hover:text-app hover:bg-app-surface'
            }`}
            title="Toggle Right Workspace Panel"
            aria-label="Toggle Right Workspace Panel"
          >
            <PanelRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </header>
  )
}
