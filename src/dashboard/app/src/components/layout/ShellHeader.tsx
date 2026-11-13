import { PanelLeft, PanelRight, Search } from 'lucide-react'
import type React from 'react'
import { BrandMark } from './BrandMark'

interface ShellHeaderProps {
  onOpenCommandPalette: () => void
  onToggleLeftSidebar?: () => void
  onToggleRightInspector?: () => void
  isRightInspectorOpen?: boolean
}

export const ShellHeader: React.FC<ShellHeaderProps> = ({
  onOpenCommandPalette,
  onToggleLeftSidebar,
  onToggleRightInspector,
  isRightInspectorOpen = true,
}) => {
  return (
    <header
      data-shell-header
      className="h-11 border-b border-app bg-app-bg px-3.5 flex items-center justify-between select-none text-app flex-shrink-0 z-20"
    >
      {/* Left: Brand + Search + Sidebar Toggle */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-[13px] font-semibold tracking-tight text-app cursor-pointer select-none">
          <BrandMark className="h-4 w-4 text-app" />
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

      {/* Right: Only single toggle button for right inspector (status indicator removed as requested) */}
      <div className="flex items-center gap-2">
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
