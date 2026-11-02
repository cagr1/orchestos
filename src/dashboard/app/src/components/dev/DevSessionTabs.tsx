import { FileCode, FileText, Plus, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getConfig } from '../../api/settings'
import type { AgentItem } from '../../types/orchestos'
import { ProviderLogo } from '../common/ProviderLogos'
import type { SessionTabs } from './session-tabs'

export function DevSessionTabs({
  agents,
  state,
  projectId,
  onSelect,
  onClose,
  onNew,
  onPin,
}: {
  agents: AgentItem[]
  state: SessionTabs
  projectId: string
  onSelect: (id: string) => void
  onClose: (id: string) => void
  onNew: () => void
  onPin: (path: string) => void
}) {
  const [agent, setAgent] = useState('')
  useEffect(() => {
    let disposed = false
    setAgent('')
    void getConfig(projectId)
      .then((config) => {
        if (!disposed) setAgent(config.roleAssignments?.orchestrator?.agent ?? '')
      })
      .catch(() => {})
    return () => {
      disposed = true
    }
  }, [projectId])
  return (
    <div
      data-dev-session-tabs
      className="flex h-10 shrink-0 items-center gap-1 overflow-x-auto border-b border-app bg-app-bg px-2 py-1"
    >
      <div role="tablist" aria-label="Open Dev tabs" className="flex items-center gap-1">
        {state.tabs.map((tab) => {
          const session =
            tab.type === 'session' ? agents.find((agent) => agent.id === tab.id) : null
          const title =
            tab.type === 'file'
              ? tab.path.split('/').pop()
              : tab.type === 'new'
                ? 'New session'
                : (session?.name ?? 'Session')
          return (
            <div
              key={tab.id}
              className={`group relative flex w-56 shrink-0 items-center rounded-lg ${state.activeId === tab.id ? 'bg-app-surface text-app' : 'text-app-muted hover:bg-app-hover hover:text-app'}`}
            >
              <button
                type="button"
                role="tab"
                aria-selected={state.activeId === tab.id}
                data-session-tab={tab.type === 'session' ? tab.id : undefined}
                data-file-tab={tab.type === 'file' ? tab.path : undefined}
                data-new-session-tab={tab.type === 'new' ? tab.id : undefined}
                title={tab.type === 'file' ? tab.path : title}
                onClick={() => onSelect(tab.id)}
                onDoubleClick={() => {
                  if (tab.type === 'file') onPin(tab.path)
                }}
                className={`flex min-w-0 flex-1 items-center gap-2 px-3 py-1.5 pr-8 text-xs whitespace-nowrap ${tab.type === 'file' && !tab.pinned ? 'italic' : ''}`}
              >
                {tab.type === 'file' ? (
                  tab.path.endsWith('.md') ? (
                    <FileText size={14} className="text-amber-400/80" />
                  ) : (
                    <FileCode size={14} className="text-sky-400/80" />
                  )
                ) : (
                  <ProviderLogo id={session?.agent || agent} size={14} />
                )}
                <span className="min-w-0 flex-1 truncate">{title}</span>
              </button>
              <button
                type="button"
                aria-label={
                  tab.type === 'file' ? `Close file tab ${tab.path}` : `Close tab ${title}`
                }
                onClick={() => onClose(tab.id)}
                className="absolute right-1 rounded-control p-1 text-app-muted opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 hover:bg-app-hover hover:text-app focus:opacity-100"
              >
                <X size={12} />
              </button>
            </div>
          )
        })}
      </div>
      <button
        type="button"
        aria-label="New session"
        onClick={onNew}
        className="shrink-0 rounded-lg p-2 text-app-muted hover:bg-app-hover hover:text-app"
      >
        <Plus size={16} />
      </button>
    </div>
  )
}
