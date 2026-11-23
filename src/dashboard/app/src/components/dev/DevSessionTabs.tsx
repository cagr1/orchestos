import { GitCompare, Globe, Loader2, Plus, SquareTerminal, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Tooltip } from '@/components/ui/tooltip'
import { getConfig } from '../../api/settings'
import type { AgentItem } from '../../types/orchestos'
import { AgentLauncher } from '../common/AgentLauncher'
import type { LaunchOption } from '../common/agent-launcher'
import { ProviderLogo } from '../common/ProviderLogos'
import { FileIcon } from '../ui/file-icon'
import type { OpenPathRequest } from './file-tabs'
import { devSessionAction } from './new-session-agent'
import type { SessionTabs } from './session-tabs'

export function DevSessionTabs({
  agents,
  state,
  projectId,
  onSelect,
  onClose,
  onNew,
  onOpenSettings,
  onPin,
  runningSessionIds,
  dirtyFileTabs,
}: {
  agents: AgentItem[]
  state: SessionTabs
  projectId: string
  onSelect: (id: string) => void
  onClose: (id: string) => void
  onNew: (action: ReturnType<typeof devSessionAction>) => void
  onOpenSettings: () => void
  onPin: (request: OpenPathRequest) => void
  runningSessionIds: Set<string>
  dirtyFileTabs: Set<string>
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
  const [lastAgent, setLastAgent] = useState('')
  const [anchor, setAnchor] = useState<{ left: number; top: number } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const tablistRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    setAnchor(null)
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
  const [hidden, setHidden] = useState({ left: false, right: false })
  const measure = useCallback(() => {
    const list = tablistRef.current
    if (!list) return
    const left = list.scrollLeft > 1
    const right = list.scrollLeft + list.clientWidth < list.scrollWidth - 1
    setHidden((prev) => (prev.left === left && prev.right === right ? prev : { left, right }))
  }, [])
  useEffect(() => {
    const list = tablistRef.current
    if (!list) return
    const resize = new ResizeObserver(measure)
    resize.observe(list)
    const children = new MutationObserver(measure)
    children.observe(list, { childList: true })
    measure()
    return () => {
      resize.disconnect()
      children.disconnect()
    }
  }, [measure])
  // biome-ignore lint/correctness/useExhaustiveDependencies: la pestaña seleccionada debe entrar en el viewport al cambiar activeId.
  useEffect(() => {
    tablistRef.current
      ?.querySelector<HTMLElement>('[aria-selected="true"]')
      ?.scrollIntoView({ inline: 'nearest', block: 'nearest' })
  }, [state.activeId])
  const fade = `linear-gradient(to right, ${hidden.left ? 'transparent' : '#000'}, #000 24px, #000 calc(100% - 24px), ${hidden.right ? 'transparent' : '#000'})`
  const choose = (option: LaunchOption) => {
    setAnchor(null)
    setLastAgent(option.id)
    localStorage.setItem(`orchestos-dev-agent:${projectId}`, option.id)
    onNew(
      devSessionAction({
        id: option.id,
        terminal: option.mode.session === 'terminal',
        chat: option.mode.session === 'chat',
      }),
    )
  }
  return (
    <div
      data-dev-session-tabs
      className="flex h-10 min-w-0 shrink-0 items-center gap-1 border-b border-app bg-app-bg px-2 py-1"
    >
      <div
        role="tablist"
        aria-label="Open Dev tabs"
        ref={tablistRef}
        onWheel={(event) => {
          if (Math.abs(event.deltaY) > Math.abs(event.deltaX))
            event.currentTarget.scrollLeft += event.deltaY
        }}
        onScroll={measure}
        style={{ maskImage: fade, WebkitMaskImage: fade }}
        className="flex min-w-0 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {state.tabs.map((tab) => {
          const session =
            tab.type === 'session' ? agents.find((agent) => agent.id === tab.id) : null
          const title =
            tab.type === 'file' || tab.type === 'diff'
              ? `${tab.path.split('/').pop()}${tab.type === 'diff' ? ' (diff)' : ''}`
              : tab.type === 'terminal'
                ? 'Terminal'
                : tab.type === 'preview'
                  ? 'Preview'
                  : tab.type === 'new'
                    ? 'New session'
                    : (session?.name ?? 'Session')
          return (
            <div
              key={tab.id}
              className={`group relative flex w-56 min-w-32 shrink items-center rounded-lg ${state.activeId === tab.id ? 'bg-app-surface text-app' : 'text-app-muted hover:bg-app-hover hover:text-app'}`}
            >
              {(tab.type === 'file' || tab.type === 'diff' ? tab.path : title) ? (
                <Tooltip content={tab.type === 'file' || tab.type === 'diff' ? tab.path : title}>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={state.activeId === tab.id}
                    data-session-tab={tab.type === 'session' ? tab.id : undefined}
                    data-dirty={tab.type === 'file' && dirtyFileTabs.has(tab.id) ? '' : undefined}
                    data-file-tab={tab.type === 'file' ? tab.path : undefined}
                    data-diff-tab={tab.type === 'diff' ? tab.path : undefined}
                    data-terminal-tab={tab.type === 'terminal' ? tab.id : undefined}
                    data-preview-tab={tab.type === 'preview' ? tab.id : undefined}
                    data-new-session-tab={tab.type === 'new' ? tab.id : undefined}
                    onClick={() => onSelect(tab.id)}
                    onDoubleClick={() => {
                      if (tab.type === 'file' || tab.type === 'diff')
                        onPin({ kind: tab.type, path: tab.path, pin: true })
                    }}
                    className={`flex min-w-0 flex-1 items-center gap-2 px-3 py-1.5 pr-8 text-left text-xs whitespace-nowrap ${(tab.type === 'file' || tab.type === 'diff') && !tab.pinned ? 'italic' : ''}`}
                  >
                    {tab.type === 'terminal' ? (
                      <SquareTerminal size={14} />
                    ) : tab.type === 'preview' ? (
                      <Globe size={14} />
                    ) : tab.type === 'diff' ? (
                      <GitCompare size={14} className="text-app-accent" />
                    ) : tab.type === 'file' ? (
                      <FileIcon
                        name={tab.path.split('/').pop() ?? tab.path}
                        kind="file"
                        className="w-3.5 h-3.5 shrink-0"
                      />
                    ) : tab.type === 'session' && runningSessionIds.has(tab.id) ? (
                      <Tooltip content="Running">
                        <span role="img" aria-label="Running" className="shrink-0">
                          <Loader2 size={14} className="animate-spin text-app-accent" />
                        </span>
                      </Tooltip>
                    ) : (
                      <ProviderLogo
                        id={session?.agent || (tab.type === 'new' ? tab.agent : '') || agent}
                        size={14}
                      />
                    )}
                    <span className="min-w-0 flex-1 truncate">{title}</span>
                  </button>
                </Tooltip>
              ) : (
                <button
                  type="button"
                  role="tab"
                  aria-selected={state.activeId === tab.id}
                  data-session-tab={tab.type === 'session' ? tab.id : undefined}
                  data-dirty={tab.type === 'file' && dirtyFileTabs.has(tab.id) ? '' : undefined}
                  data-file-tab={tab.type === 'file' ? tab.path : undefined}
                  data-diff-tab={tab.type === 'diff' ? tab.path : undefined}
                  data-terminal-tab={tab.type === 'terminal' ? tab.id : undefined}
                  data-preview-tab={tab.type === 'preview' ? tab.id : undefined}
                  data-new-session-tab={tab.type === 'new' ? tab.id : undefined}
                  onClick={() => onSelect(tab.id)}
                  onDoubleClick={() => {
                    if (tab.type === 'file' || tab.type === 'diff')
                      onPin({ kind: tab.type, path: tab.path, pin: true })
                  }}
                  className={`flex min-w-0 flex-1 items-center gap-2 px-3 py-1.5 pr-8 text-left text-xs whitespace-nowrap ${(tab.type === 'file' || tab.type === 'diff') && !tab.pinned ? 'italic' : ''}`}
                >
                  {tab.type === 'terminal' ? (
                    <SquareTerminal size={14} />
                  ) : tab.type === 'preview' ? (
                    <Globe size={14} />
                  ) : tab.type === 'diff' ? (
                    <GitCompare size={14} className="text-app-accent" />
                  ) : tab.type === 'file' ? (
                    <FileIcon
                      name={tab.path.split('/').pop() ?? tab.path}
                      kind="file"
                      className="w-3.5 h-3.5 shrink-0"
                    />
                  ) : tab.type === 'session' && runningSessionIds.has(tab.id) ? (
                    <Tooltip content="Running">
                      <span role="img" aria-label="Running" className="shrink-0">
                        <Loader2 size={14} className="animate-spin text-app-accent" />
                      </span>
                    </Tooltip>
                  ) : (
                    <ProviderLogo
                      id={session?.agent || (tab.type === 'new' ? tab.agent : '') || agent}
                      size={14}
                    />
                  )}
                  <span className="min-w-0 flex-1 truncate">{title}</span>
                </button>
              )}
              {tab.type === 'file' && dirtyFileTabs.has(tab.id) && (
                <span
                  aria-hidden="true"
                  className="absolute right-2 text-app-muted group-hover:hidden group-focus-within:hidden"
                >
                  ●
                </span>
              )}
              <button
                type="button"
                aria-label={
                  tab.type === 'diff'
                    ? `Close diff tab ${tab.path}`
                    : tab.type === 'file'
                      ? `Close file tab ${tab.path}`
                      : `Close tab ${title}`
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
        aria-haspopup="dialog"
        aria-expanded={!!anchor}
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect()
          setAnchor(anchor ? null : { left: rect.left, top: rect.bottom + 4 })
        }}
        className="shrink-0 rounded-lg p-2 text-app-muted hover:bg-app-hover hover:text-app"
      >
        <Plus size={16} />
      </button>
      {anchor && (
        <AgentLauncher
          anchor={anchor}
          lastAgent={lastAgent}
          onChoose={choose}
          onClose={() => setAnchor(null)}
          onOpenSettings={onOpenSettings}
        />
      )}
    </div>
  )
}
