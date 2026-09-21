/**
 * Riel izquierdo (UI.3, Mes 30) — reemplaza `buildNav()` de `app.js`.
 *
 * POR QUÉ CONSERVA LAS CLASES CSS VANILLA, y no se reescribe a Tailwind como los
 * componentes de UI.2. Las 4 reglas de diseño de v0.12 —las que se descubrieron a los
 * golpes, en dos rondas, con un screenshot de Carlos de por medio— **están implementadas
 * en CSS, no en JS**. El hover-swap del logo por el botón panel-left, por ejemplo, es
 * `.app[data-sidebar="collapsed"] .sidebar-toprow:hover .sidebar-toprow-logo { display: none }`:
 * CSS puro, sin una línea de JavaScript. Reescribir esas ~460 líneas a Tailwind, en el
 * componente que está SIEMPRE en pantalla y que concentra los bugs históricos del proyecto,
 * sería tomar todo el riesgo junto sin ninguna necesidad — y sin poder distinguir después
 * si algo se rompió por React o por el CSS nuevo.
 *
 * Entonces UI.3 migra **la estructura y el comportamiento**; el CSS probado se queda tal
 * cual y sigue resolviendo las 4 reglas. Reducirlo a tokens es literalmente el trabajo de
 * UI.5 ("`screens.css`/`styles.css` reducidos a tokens"), donde además ya no habrá vanilla
 * compitiendo por las mismas clases.
 *
 * UI.8.3 reorganiza el riel en Chat, Activity, proyectos y Settings.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useT } from '../../lib/i18n.ts'
import { Icon, RawIcon } from '../../lib/icons.tsx'
import { pushToast } from '../../lib/toast-store.ts'
import { type NavEntry, shellApi } from './shell-api.ts'
import { useShell } from './use-shell.ts'

type Project = { id: string; path: string; stackProfile: string; lastUpdated: string }
type Session = {
  id: string
  agent: string
  title: string | null
  updatedAt: string
  projectId: string | null
}

function relativeTime(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 1000))
  if (seconds < 60) return 'now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}d`
}

export function Sidebar() {
  const shell = useShell()
  const t = useT()
  const api = shellApi()
  const nav: NavEntry[] = api?.nav ?? []

  const settings = nav.find((n) => n.id === 'settings')
  const [projects, setProjects] = useState<Project[]>([])
  const [isChoosingProject, setIsChoosingProject] = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [sessions, setSessions] = useState<Record<string, Session[]>>({})
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuProjectId, setMenuProjectId] = useState<string | null>(null)
  const [chatSearch, setChatSearch] = useState('')
  const loadProjects = useCallback(async () => {
    const response = await fetch('/api/projects')
    if (!response.ok) throw new Error('Could not load projects')
    setProjects((await response.json()) as Project[])
  }, [])
  const chooseProject = async () => {
    if (isChoosingProject) return
    setIsChoosingProject(true)
    try {
      const response = await fetch('/api/projects/choose', { method: 'POST' })
      const data = (await response.json()) as Project | { cancelled: true } | { error: string }
      if (!response.ok || 'error' in data) {
        pushToast('error' in data ? data.error : t('nav.project.add.error'), 'error')
        return
      }
      if ('cancelled' in data) return
      await loadProjects()
      api?.selectWorkspaceProject(data.id)
    } catch {
      pushToast(t('nav.project.add.error'), 'error')
    } finally {
      setIsChoosingProject(false)
    }
  }
  useEffect(() => {
    void loadProjects().catch(() => setProjects([]))
  }, [loadProjects])

  const loadProjectSessions = useCallback(async (projectId: string) => {
    try {
      const response = await fetch(`/api/chat/sessions?project=${encodeURIComponent(projectId)}`)
      const value = response.ok ? await response.json() : []
      setSessions((current) => ({ ...current, [projectId]: value }))
    } catch {
      setSessions((current) => ({ ...current, [projectId]: [] }))
    }
  }, [])
  useEffect(() => {
    void shell.sessionsVersion
    for (const project of projects) if (expanded[project.id]) void loadProjectSessions(project.id)
  }, [shell.sessionsVersion, projects, expanded, loadProjectSessions])

  const openMenu = (projectId: string | null) => {
    setMenuProjectId(projectId)
    setMenuOpen(true)
  }

  // El atajo se muestra según la plataforma, igual que en vanilla.
  const kbdHint = navigator.platform.toLowerCase().includes('mac') ? '⌘K' : 'Ctrl K'
  const isBright = document.documentElement.getAttribute('data-theme') === 'light'
  const logoSrc = `assets/${isBright ? 'logo_black' : 'logo_white'}.png`

  return (
    <>
      <div className="sidebar-toprow">
        {/* El swap logo <-> botón es 100% CSS (regla 4): los dos elementos están SIEMPRE
            en el DOM y el `:hover` decide cuál se ve. Si esto se resolviera en JS, el
            markup cambiaría al pasar el mouse — el gate lo verifica comparando el
            outerHTML antes y después del hover. */}
        <img className="sidebar-toprow-logo" src={logoSrc} alt="OrchestOS" aria-hidden="true" />
        <b className="sidebar-brand-text">
          Orchest<span>OS</span>
        </b>
        <div className="sidebar-toprow-icons">
          <NavButton
            id="navSearchBtn"
            className="sidebar-toprow-btn sidebar-search-btn"
            tip={`${t('nav.search')} (${kbdHint})`}
            onActivate={() => api?.openCommandPalette()}
          >
            <Icon name="search" />
          </NavButton>
          <NavButton
            id="navCollapseBtn"
            className="sidebar-toprow-btn"
            tip={t(shell.sidebarExpanded ? 'nav.sidebar.collapse' : 'nav.sidebar.expand')}
            onActivate={() => api?.toggleSidebar()}
          >
            <Icon name="panelLeft" />
          </NavButton>
        </div>
      </div>

      <div className="sidebar-mode-row">
        <NavButton
          id="shellModeChat"
          className={`sidebar-mode-btn${shell.shellMode === 'chat' ? ' active' : ''}`}
          tip={t('nav.mode.chat')}
          label={t('nav.mode.chat')}
          ariaPressed={shell.shellMode === 'chat'}
          onActivate={() => api?.setShellMode('chat')}
        >
          <span className="sidebar-mode-icon">
            <Icon name="chat" />
          </span>
          <span className="sidebar-mode-label">{t('nav.mode.chat')}</span>
        </NavButton>
        <NavButton
          id="shellModeDev"
          className={`sidebar-mode-btn${shell.shellMode === 'dev' ? ' active' : ''}`}
          tip={t('nav.mode.dev')}
          label={t('nav.mode.dev')}
          ariaPressed={shell.shellMode === 'dev'}
          onActivate={() => api?.setShellMode('dev')}
        >
          <span className="sidebar-mode-icon">
            <Icon name="code" />
          </span>
          <span className="sidebar-mode-label">{t('nav.mode.dev')}</span>
        </NavButton>
      </div>

      <div className="nav-sep" />

      {shell.shellMode === 'chat' ? (
        <div className="sidebar-chats">
          <div className="sidebar-new-chat-wrap">
            <NavButton
              id="sidebarNewChat"
              className="nav-icon sidebar-new-chat"
              tip={t('chat.sessions.new')}
              label={t('chat.sessions.new')}
              ariaExpanded={menuOpen}
              onActivate={() => openMenu(null)}
            >
              <span className="nav-ic">
                <Icon name="plus" />
              </span>
              <span className="nav-label">{t('chat.sessions.new')}</span>
            </NavButton>
            {menuOpen && menuProjectId === null && (
              <CliMenu api={api} projectId={null} onClose={() => setMenuOpen(false)} />
            )}
          </div>
          <div className="sidebar-section-label">
            <span>{t('nav.section.chats')}</span>
          </div>
          <label className="sidebar-chat-search">
            <Icon name="search" />
            <input
              type="search"
              value={chatSearch}
              placeholder="Search chats"
              aria-label="Search chats"
              onChange={(event) => setChatSearch(event.target.value)}
            />
          </label>
          {shell.generalSessions.filter((session) => {
            const query = chatSearch.trim().toLowerCase()
            return !query || (session.title || 'Untitled chat').toLowerCase().includes(query)
          }).length === 0 ? (
            <div className="sidebar-sessions-empty">{t('chat.sessions.empty')}</div>
          ) : (
            shell.generalSessions
              .filter((session) => {
                const query = chatSearch.trim().toLowerCase()
                return !query || (session.title || 'Untitled chat').toLowerCase().includes(query)
              })
              .map((session) => (
                <SessionRow
                  key={session.id}
                  session={session}
                  active={shell.screen === 'chat' && shell.chatSessionId === session.id}
                  api={api}
                />
              ))
          )}
        </div>
      ) : (
        <>
          <div className="sidebar-projects">
            <div className="sidebar-section-label">
              <span>Projects</span>
              <NavButton
                id="addProjectBtn"
                className="sidebar-project-add"
                tip={t('nav.project.add')}
                label={t('nav.project.add')}
                disabled={isChoosingProject}
                onActivate={() => void chooseProject()}
              >
                <Icon name="plus" />
              </NavButton>
            </div>
            {projects.map((project) => {
              const isExpanded = expanded[project.id] ?? false
              const projectSessions = sessions[project.id] ?? []
              const projectName = project.path.split('/').pop() || project.path
              return (
                <div key={project.id} className="sidebar-project-tree" data-project-id={project.id}>
                  <div
                    className={`nav-icon${shell.screen === 'workspace' && shell.workspaceProjectId === project.id ? ' active' : ''}`}
                    data-tip={projectName}
                    aria-label={projectName}
                    role="button"
                    tabIndex={0}
                    onClick={() => api?.selectWorkspaceProject(project.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        api?.selectWorkspaceProject(project.id)
                      }
                    }}
                  >
                    <span className="nav-ic">
                      <Icon name="project" />
                    </span>
                    <span className="nav-label">{projectName}</span>
                    <NavButton
                      id={`add-agent-${project.id}`}
                      className="sidebar-row-add"
                      tip={t('nav.agent.new')}
                      label={t('nav.agent.new')}
                      onActivate={() => {
                        setExpanded((value) => ({ ...value, [project.id]: true }))
                        openMenu(project.id)
                      }}
                    >
                      <Icon name="plus" />
                    </NavButton>
                  </div>
                  <div
                    className="sidebar-agents-toggle"
                    role="button"
                    tabIndex={0}
                    aria-expanded={isExpanded}
                    onClick={() => {
                      setExpanded((value) => ({ ...value, [project.id]: !isExpanded }))
                      if (!isExpanded && sessions[project.id] === undefined) {
                        void loadProjectSessions(project.id)
                      }
                    }}
                  >
                    {projectSessions.length} agents <span aria-hidden="true">⌄</span>
                  </div>
                  {isExpanded &&
                    projectSessions.map((session) => (
                      <div
                        key={session.id}
                        className={`sidebar-agent-row${shell.screen === 'chat' && shell.chatSessionId === session.id ? ' active' : ''}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => api?.openChatSession(session.id, project.id)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            api?.openChatSession(session.id, project.id)
                          }
                        }}
                      >
                        <span className="sidebar-agent-icon" data-agent={session.agent}>
                          <RawIcon svg={api?.agentIcon(session.agent) ?? ''} />
                        </span>
                        <span className="sidebar-agent-title">
                          {session.title || 'Untitled chat'}
                        </span>
                        <span className="sidebar-agent-time">
                          {relativeTime(session.updatedAt)}
                        </span>
                      </div>
                    ))}
                  {menuOpen && menuProjectId === project.id && (
                    <CliMenu api={api} projectId={project.id} onClose={() => setMenuOpen(false)} />
                  )}
                </div>
              )
            })}
          </div>
        </>
      )}
      <div className="grow" />

      {settings && (
        <NavIcon entry={settings} shellScreen={shell.screen} skillsCount={shell.skillsCount} />
      )}
    </>
  )
}

function NavIcon({
  entry,
  shellScreen,
  skillsCount,
}: {
  entry: NavEntry
  shellScreen: string
  skillsCount: number
}) {
  const t = useT()
  const api = shellApi()
  // Los ítems de operador solo existen en modo avanzado: en vanilla `navItem()` devolvía
  // string vacío. No llevan badge "adv" — se quitó en Mes 22/F2 por redundante.
  return (
    <div
      className={`nav-icon${entry.operator ? ' operator visible' : ''}${shellScreen === entry.id ? ' active' : ''}`}
      data-nav={entry.id}
      data-tip={t(entry.key)}
      role="button"
      tabIndex={0}
      onClick={() => api?.go(entry.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          api?.go(entry.id)
        }
      }}
    >
      <span className="nav-ic">
        <RawIcon svg={entry.icon} />
        {entry.badge && (
          <span className="nav-count-badge" data-count={entry.id}>
            {skillsCount}
          </span>
        )}
      </span>
      <span className="nav-label">{t(entry.key)}</span>
    </div>
  )
}

/**
 * Botón del riel. Sigue siendo un `<div role="button">` y no un `<button>`, a propósito:
 * el CSS del shell selecciona por `.sidebar-toprow-btn`/`.nav-icon` y un `<button>` real
 * arrastraría estilos de user-agent (fondo, borde, font) que habría que resetear — y el
 * reset de Tailwind está desactivado en este proyecto justamente para no tocar el vanilla.
 * El comportamiento de teclado (Enter/Espacio), que el `<button>` daría gratis, se
 * implementa acá igual que lo hacía `buildNav()`.
 */
function NavButton({
  id,
  className,
  tip,
  label,
  ariaPressed,
  ariaExpanded,
  disabled = false,
  onActivate,
  children,
}: {
  id: string
  className: string
  tip: string
  label?: string
  ariaPressed?: boolean
  ariaExpanded?: boolean
  disabled?: boolean
  onActivate: () => void
  children: React.ReactNode
}) {
  return (
    <div
      id={id}
      className={className}
      data-tip={tip}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={label}
      aria-pressed={ariaPressed}
      aria-expanded={ariaExpanded}
      aria-disabled={disabled}
      data-disabled={disabled || undefined}
      onClick={(event) => {
        if (disabled) return
        event.stopPropagation()
        onActivate()
      }}
      onKeyDown={(e) => {
        if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          e.stopPropagation()
          onActivate()
        }
      }}
    >
      {children}
    </div>
  )
}

function SessionRow({
  session,
  active,
  api,
}: {
  session: Session
  active: boolean
  api: ReturnType<typeof shellApi>
}) {
  return (
    <div
      className={`sidebar-agent-row sidebar-chat-row${active ? ' active' : ''}`}
      role="button"
      tabIndex={0}
      onClick={() => api?.openChatSession(session.id, null)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          api?.openChatSession(session.id, null)
        }
      }}
    >
      <span className="sidebar-agent-icon" data-agent={session.agent}>
        <RawIcon svg={api?.agentIcon(session.agent) ?? ''} />
      </span>
      <span className="sidebar-agent-title">{session.title || 'Untitled chat'}</span>
      <span className="sidebar-agent-time">{relativeTime(session.updatedAt)}</span>
      <button
        className="sidebar-row-delete"
        type="button"
        aria-label="Delete"
        onClick={(event) => {
          event.stopPropagation()
          void api?.deleteChatSession(session.id)
        }}
      >
        ×
      </button>
    </div>
  )
}

function CliMenu({
  api,
  projectId,
  onClose,
}: {
  api: ReturnType<typeof shellApi>
  projectId: string | null
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const outside = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose()
    }
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', outside)
    document.addEventListener('keydown', onEscape)
    return () => {
      document.removeEventListener('mousedown', outside)
      document.removeEventListener('keydown', onEscape)
    }
  }, [onClose])
  return (
    <div ref={ref} className="sidebar-cli-menu" role="menu">
      {api?.cliModes().map((info) => {
        const available = info.detected !== false
        const reason = info.path ? 'Not detected' : 'Unavailable'
        return available ? (
          <button
            key={info.id}
            type="button"
            role="menuitem"
            onClick={() => {
              void api.startNewChatSession(info.id, projectId)
              onClose()
            }}
          >
            <span className="sidebar-cli-icon" data-agent={info.id}>
              <RawIcon svg={api.agentIcon(info.id)} />
            </span>
            <span>{window.t?.(`chat.modelfx.agentLabel.${info.id}`) ?? info.id}</span>
          </button>
        ) : (
          <div key={info.id} className="disabled" aria-disabled="true" title={reason}>
            <span className="sidebar-cli-icon" data-agent={info.id}>
              <RawIcon svg={api?.agentIcon(info.id) ?? ''} />
            </span>
            <span>
              {window.t?.(`chat.modelfx.agentLabel.${info.id}`) ?? info.id}
              <small>{reason}</small>
            </span>
          </div>
        )
      })}
    </div>
  )
}
