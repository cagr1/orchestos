import { Plus, X } from 'lucide-react'
import type { AgentItem } from '../../types/orchestos'
import { ProviderLogo } from '../common/ProviderLogos'

export function DevSessionTabs({
  agents,
  activeId,
  onSelect,
  onClose,
  onNew,
}: {
  agents: AgentItem[]
  activeId: string | null
  onSelect: (id: string) => void
  onClose: (id: string) => void
  onNew: () => void
}) {
  return (
    <div
      data-dev-session-tabs
      className="flex shrink-0 items-center overflow-x-auto border-b border-app bg-app-bg"
    >
      <div role="tablist" aria-label="Open sessions" className="flex items-center">
        {agents.map((agent) => (
          <div
            key={agent.id}
            className={`group flex items-center border-r border-app ${activeId === agent.id ? 'bg-app-surface text-app' : 'text-app-muted'}`}
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeId === agent.id}
              data-session-tab={agent.id}
              onClick={() => onSelect(agent.id)}
              className="flex items-center gap-2 px-3 py-2 text-xs whitespace-nowrap hover:text-app"
            >
              <ProviderLogo id={agent.agent || agent.model} size={14} />
              <span className="max-w-48 truncate">{agent.name}</span>
            </button>
            <button
              type="button"
              aria-label={`Close tab ${agent.name}`}
              onClick={() => onClose(agent.id)}
              className="mr-2 p-1 rounded-control opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-app-hover text-app-muted hover:text-app"
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        aria-label="New session"
        onClick={onNew}
        className="shrink-0 p-2 text-app-muted hover:text-app hover:bg-app-hover rounded-control"
      >
        <Plus size={16} />
      </button>
    </div>
  )
}
