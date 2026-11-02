import { FileCode, FileText, Plus, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { type CliModelCatalog, getCliModels } from '../../api/chat'
import { getConfig } from '../../api/settings'
import type { AgentItem } from '../../types/orchestos'
import { cliDisplayName } from '../common/AgentComposer'
import { ProviderLogo } from '../common/ProviderLogos'
import { isFunctionalChatCli } from './new-session-agent'
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
  onNew: (agent: string) => void
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
  const [catalogs, setCatalogs] = useState<CliModelCatalog[]>([])
  const [lastAgent, setLastAgent] = useState('')
  const [menu, setMenu] = useState<{ left: number; top: number } | null>(null)
  const [selected, setSelected] = useState(0)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let disposed = false
    void getCliModels()
      .then((catalogs) => {
        if (!disposed) setCatalogs(catalogs.filter(isFunctionalChatCli))
      })
      .catch(() => {})
    return () => {
      disposed = true
    }
  }, [])
  useEffect(() => {
    setMenu(null)
    setLastAgent(localStorage.getItem(`orchestos-dev-agent:${projectId}`) ?? '')
  }, [projectId])
  useEffect(() => {
    const active = state.tabs.find((tab) => tab.id === state.activeId)
    const used =
      active?.type === 'new'
        ? active.agent
        : active?.type === 'session'
          ? agents.find((agent) => agent.id === active.id)?.agent
          : undefined
    if (used) {
      setLastAgent(used)
      localStorage.setItem(`orchestos-dev-agent:${projectId}`, used)
    }
  }, [state.activeId, state.tabs, agents, projectId])
  const options = [...catalogs].sort(
    (a, b) => Number(b.id === lastAgent) - Number(a.id === lastAgent),
  )
  useEffect(() => {
    if (!menu) return
    menuRef.current?.querySelectorAll<HTMLButtonElement>('button')[selected]?.focus()
  }, [menu, selected])
  useEffect(() => {
    if (!menu) return
    const close = (event: MouseEvent) => {
      if (
        !menuRef.current?.contains(event.target as Node) &&
        !buttonRef.current?.contains(event.target as Node)
      )
        setMenu(null)
    }
    const dismiss = () => setMenu(null)
    document.addEventListener('mousedown', close)
    window.addEventListener('resize', dismiss)
    window.addEventListener('scroll', dismiss, true)
    return () => {
      document.removeEventListener('mousedown', close)
      window.removeEventListener('resize', dismiss)
      window.removeEventListener('scroll', dismiss, true)
    }
  }, [menu])
  const choose = (agent: string) => {
    setMenu(null)
    setLastAgent(agent)
    localStorage.setItem(`orchestos-dev-agent:${projectId}`, agent)
    onNew(agent)
  }
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
                className={`flex min-w-0 flex-1 items-center gap-2 px-3 py-1.5 pr-8 text-left text-xs whitespace-nowrap ${tab.type === 'file' && !tab.pinned ? 'italic' : ''}`}
              >
                {tab.type === 'file' ? (
                  tab.path.endsWith('.md') ? (
                    <FileText size={14} className="text-amber-400/80" />
                  ) : (
                    <FileCode size={14} className="text-sky-400/80" />
                  )
                ) : (
                  <ProviderLogo
                    id={session?.agent || (tab.type === 'new' ? tab.agent : '') || agent}
                    size={14}
                  />
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
        ref={buttonRef}
        aria-label="New session"
        aria-haspopup="menu"
        aria-expanded={!!menu}
        disabled={!options.length}
        onClick={() => {
          if (options.length === 1) return choose(options[0].id)
          const rect = buttonRef.current!.getBoundingClientRect()
          setSelected(0)
          setMenu(
            menu
              ? null
              : { left: Math.min(rect.left, window.innerWidth - 224), top: rect.bottom + 4 },
          )
        }}
        className="shrink-0 rounded-lg p-2 text-app-muted hover:bg-app-hover hover:text-app"
      >
        <Plus size={16} />
      </button>
      {menu &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label="New session agent"
            style={menu}
            className="fixed z-50 w-56 rounded-card bg-app-surface border border-app shadow-2xl p-2 text-xs text-app"
            onKeyDown={(event) => {
              if (event.key === 'Escape' || event.key === 'Tab') {
                setMenu(null)
                if (event.key === 'Escape') {
                  event.preventDefault()
                  buttonRef.current?.focus()
                }
              } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault()
                setSelected(
                  (index) =>
                    (index + (event.key === 'ArrowDown' ? 1 : -1) + options.length) %
                    options.length,
                )
              }
            }}
          >
            {options.map((option, index) => (
              <button
                key={option.id}
                type="button"
                role="menuitemradio"
                aria-checked={selected === index}
                tabIndex={selected === index ? 0 : -1}
                onFocus={() => setSelected(index)}
                onClick={() => choose(option.id)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-control text-left text-app-muted hover:text-app hover:bg-app-elevated/40 ${selected === index ? 'bg-app-elevated/40 text-app' : ''}`}
              >
                <ProviderLogo id={option.id} size={14} />
                {cliDisplayName(option.id, option.label)}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </div>
  )
}
