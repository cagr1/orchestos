import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { flushSync } from 'react-dom'
import type { TaskClass } from '../../../router/classify'
import {
  archiveSession,
  attachTurnDetails,
  type ChatMessageRow,
  commitAndRunProjectTask,
  createSession,
  deleteProjectTask,
  deleteSession,
  getProjectTasks,
  getSessionMessages,
  getTimeline,
  listArchivedSessions,
  listSessions,
  mapMessage,
  newChatProjectId,
  type ProjectTaskRow,
  renameSession,
  restoreSession,
  runProjectTask,
  sendMessage,
  stopActiveChatTurn as stopActiveChatSession,
  type TimelineResponse,
} from './api/chat'
import { getProjectContext } from './api/project'
import { chooseProject, deleteProject, listProjects, purgeProjectData } from './api/projects'
import {
  addInstinct,
  addLibrarySkill,
  approveInstinct,
  approveSpec,
  compileSkill,
  draftSpec,
  enableLibrarySkill,
  explainTask,
  graduateInstinct,
  lintSpec,
  listInstincts,
  listMemory,
  listSkills,
  listSpecs,
  previewGraduation,
  rejectInstinct,
  resolveMemoryConflict,
  setInstinctStatus,
  setLibrarySkillPhases,
  updateInstinct,
} from './api/projectTabs'
import { getRun, getRunApprovals, listRuns, type PendingApproval } from './api/runs'
import { pollProjectAndThreadTasks } from './api/taskPolling'
import {
  decideTaskPollAction,
  getRunnableTask,
  listTasks,
  resolveTaskReportPoll,
  runTask,
  TaskRunError,
} from './api/tasks'
import { mergeOptimisticAttachments } from './components/chat/mergeAttachments'
import { OrchestChatView } from './components/chat/OrchestChatView'
import { CloneProjectDialog } from './components/common/CloneProjectDialog'
import { CommandPalette } from './components/common/CommandPalette'
import { ConfirmDialog } from './components/common/ConfirmDialog'
import type { ProjectAddAction } from './components/common/ProjectAddButton'
import { DevDiffPanel } from './components/dev/DevDiffPanel'
import { DevFilePanel } from './components/dev/DevFilePanel'
import { DevSessionTabs } from './components/dev/DevSessionTabs'
import { DiscardChangesModal } from './components/dev/DiscardChangesModal'
import {
  dirtyPaths,
  drop,
  getSnapshot,
  hasDirtyBuffers,
  isDirty,
  subscribe,
} from './components/dev/file-buffers'
import { openFileTab, openPathTab } from './components/dev/file-tabs'
import { GoToFileDialog } from './components/dev/GoToFileDialog'
import { OpenCodeTerminal } from './components/dev/OpenCodeTerminal'
import { type HistorySession, OrcaRightInspector } from './components/dev/OrcaRightInspector'
import { OrchestDevWorkspace } from './components/dev/OrchestDevWorkspace'
import {
  closeSessionTab,
  convertNewTab,
  emptySessionTabs,
  openNewTab,
  openSessionTab,
  openTerminalTab,
  persistedDevTabs,
  readSessionTabs,
  restoreSessionTabs,
  SESSION_TABS_KEY,
} from './components/dev/session-tabs'
import { ShellHeader } from './components/layout/ShellHeader'
import { ShellSidebar } from './components/layout/ShellSidebar'
import { ShellStatusBar } from './components/layout/ShellStatusBar'
import {
  OrchestSettingsView,
  type ProjectSubTab,
  type SettingsSection,
} from './components/settings/OrchestSettingsView'
import { projectsWithApprovals, threadsWithApprovals } from './components/thread/taskCards'
import { useAttentionNotifications } from './hooks/useAttentionNotifications'
import { stopActiveChatTurn } from './hooks/useStopChatTurn'
import {
  readAppearanceSettings,
  resetScale,
  stepScale,
  useAppearanceSettings,
  writeAppearanceSettings,
} from './lib/appearance-settings'
import { discardChatQueue } from './lib/chat-queue'
import { readChatSettings, writeChatSettings } from './lib/chat-settings'
import {
  type CommandId,
  KEYBINDINGS,
  reachesAppFromTerminal,
  useKeybindings,
} from './lib/keybindings'
import { activeAfterLoad, mergeLoadedThreads, threadPendingForSend } from './lib/merge-threads'
import type {
  AppMode,
  ChatAttachment,
  ChatThread,
  InstinctItem,
  MemoryItem,
  NavigationTab,
  ProjectContext,
  ProjectItem,
  RunItem,
  SessionStatus,
  SkillItem,
  SpecItem,
  TaskItem,
} from './types/orchestos'

export default function App() {
  useKeybindings()
  const { uiScale } = useAppearanceSettings()
  const [theme, setTheme] = useState<string>(() => {
    try {
      return localStorage.getItem('orchestos-theme') || 'orchestos'
    } catch {
      return 'orchestos'
    }
  })
  const [mode, setMode] = useState<AppMode>('chat')
  const [previousMode, setPreviousMode] = useState<AppMode>('chat')

  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false)
  const [isGoToFileOpen, setIsGoToFileOpen] = useState(false)
  const [newChatSignal, setNewChatSignal] = useState(0)
  const [settingsSearchSignal, setSettingsSearchSignal] = useState(0)
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState<boolean>(true)
  const [isRightInspectorOpen, setIsRightInspectorOpen] = useState<boolean>(true)

  // Projects state
  const [projects, setProjects] = useState<ProjectItem[]>([])
  const [deletingProjectIds, setDeletingProjectIds] = useState<Set<string>>(() => new Set())
  const [activeProjectId, setActiveProjectId] = useState<string>('')
  const [diffRevision, setDiffRevision] = useState(0)
  const [devTabs, setDevTabs] = useState(readSessionTabs)
  useSyncExternalStore(subscribe, getSnapshot)
  const dirtyFileTabs = new Set([...dirtyPaths(activeProjectId)].map((path) => `file:${path}`))
  const [discardTab, setDiscardTab] = useState<{ projectId: string; path: string } | null>(null)
  const [closeRunning, setCloseRunning] = useState<{ projectId: string; id: string } | null>(null)
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasDirtyBuffers()) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', beforeUnload)
    return () => window.removeEventListener('beforeunload', beforeUnload)
  }, [])
  const activeDevTabs = devTabs[activeProjectId] ?? emptySessionTabs()
  const activeDevTab = activeDevTabs.tabs.find((tab) => tab.id === activeDevTabs.activeId)
  const activeAgentId = activeDevTab?.type === 'session' ? activeDevTab.id : null
  const handleOpenFile = (path: string, { pin }: { pin: boolean }) =>
    updateDevTabs(activeProjectId, (tabs) => openFileTab(tabs, path, pin))
  const updateDevTabs = (
    projectId: string,
    update: (
      tabs: import('./components/dev/session-tabs').SessionTabs,
    ) => import('./components/dev/session-tabs').SessionTabs,
  ) => {
    setDevTabs((current) => ({
      ...current,
      [projectId]: update({
        ...(current[projectId] ?? emptySessionTabs()),
        tabs: (current[projectId]?.tabs ?? []).map((tab) =>
          tab.type === 'file' && isDirty(projectId, tab.path) ? { ...tab, pinned: true } : tab,
        ),
      }),
    }))
  }
  useEffect(() => {
    try {
      localStorage.setItem(
        SESSION_TABS_KEY,
        JSON.stringify(
          Object.fromEntries(
            Object.entries(devTabs).map(([id, tabs]) => [id, persistedDevTabs(tabs)]),
          ),
        ),
      )
    } catch {
      /* Storage unavailable. */
    }
  }, [devTabs])
  useEffect(() => {
    if (!projects.length) return
    setDevTabs((current) =>
      Object.fromEntries(
        projects.map((project) => [
          project.id,
          (() => {
            const live = current[project.id]
            const restored = restoreSessionTabs(
              live,
              project.agents.map((agent) => agent.id),
              (() => {
                try {
                  const last = JSON.parse(localStorage.getItem('orchestos-last-dev') || 'null')
                  return last?.projectId === project.id ? last.sessionId : undefined
                } catch {
                  return undefined
                }
              })(),
            )
            if (!live?.tabs.some((tab) => tab.type === 'terminal')) return restored
            const tabs = live.tabs.filter(
              (tab) => tab.type === 'terminal' || restored.tabs.some((item) => item.id === tab.id),
            )
            return {
              tabs,
              activeId: tabs.find((tab) => tab.id === live.activeId)?.id ?? tabs[0]?.id ?? null,
            }
          })(),
        ]),
      ),
    )
  }, [projects])
  const [sessionStatus, setSessionStatus] = useState<SessionStatus | null>(() => {
    try {
      const cached = localStorage.getItem('orchestos-session-status')
      return cached ? (JSON.parse(cached) as SessionStatus) : null
    } catch {
      return null
    }
  })
  const [refreshingUsage, setRefreshingUsage] = useState(false)
  const usageAbortRef = useRef<AbortController | null>(null)
  const [historySessions, setHistorySessions] = useState<HistorySession[]>([])
  const [projectError, setProjectError] = useState<string | null>(null)

  // Settings deep-link state
  const [settingsSection, setSettingsSection] = useState<SettingsSection>('general')
  const [settingsProjectTab, setSettingsProjectTab] = useState<ProjectSubTab>('tasks')
  const [language, setLanguage] = useState<'en' | 'es'>(() => {
    try {
      return (localStorage.getItem('orchestos-language') as 'en' | 'es' | null) || 'en'
    } catch {
      return 'en'
    }
  })

  useEffect(() => {
    localStorage.setItem('orchestos-theme', theme)
  }, [theme])
  useEffect(() => {
    localStorage.setItem('orchestos-language', language)
  }, [language])

  // Core OrchestOS entities state
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [threadTasks, setThreadTasks] = useState<{
    projectId: string | null | undefined
    tasks: TaskItem[]
  } | null>(null)
  const [approvals, setApprovals] = useState<{
    projectId: string | null | undefined
    byRun: Record<string, PendingApproval[]>
  } | null>(null)
  const [taskError, setTaskError] = useState<string | null>(null)
  const [taskRunError, setTaskRunError] = useState<{ message: string; code?: string } | null>(null)
  const [runningTaskId, setRunningTaskId] = useState<string | null>(null)
  const [evidenceRunId, setEvidenceRunId] = useState<string | undefined>()
  const [runs, setRuns] = useState<RunItem[]>([])
  const [projectContext, setProjectContext] = useState<ProjectContext | null>(null)
  const [specs, setSpecs] = useState<SpecItem[]>([])
  const [instincts, setInstincts] = useState<InstinctItem[]>([])
  const [memories, setMemories] = useState<MemoryItem[]>([])
  const [threads, setThreads] = useState<ChatThread[]>([])
  const [attentionSessionsProject, setAttentionSessionsProject] = useState<string | null>()
  const [attentionTasksProject, setAttentionTasksProject] = useState<string>()
  const [runningSessionIds, setRunningSessionIds] = useState<Set<string>>(() => new Set())
  const closeDevTab = (projectId: string, id: string) => {
    if (id.startsWith('file:') && isDirty(projectId, id.slice(5))) {
      setDiscardTab({ projectId, path: id.slice(5) })
      return
    }
    if (id.startsWith('file:')) drop(projectId, id.slice(5))
    if (!id.startsWith('file:') && runningSessionIds.has(id)) {
      const preference = readChatSettings().closeRunningTab
      if (preference === 'stop') void stopActiveChatSession(id, projectId)
      else if (preference === 'ask') {
        setCloseRunning({ projectId, id })
        return
      }
    }
    updateDevTabs(projectId, (tabs) => closeSessionTab(tabs, id))
  }
  const failedSessionIds = useRef(new Set<string>())
  const locallyRunningSessionIds = useRef<Set<string>>(new Set())
  // Sube en cada envío local; settleChatTurn descarta lecturas que empezaron antes.
  const localSendGeneration = useRef<Map<string, number>>(new Map())
  const handleDevTimelinePending = useCallback((sessionId: string, pending: boolean) => {
    if (pending || locallyRunningSessionIds.current.has(sessionId)) return
    setRunningSessionIds((current) => {
      if (!current.has(sessionId)) return current
      const next = new Set(current)
      next.delete(sessionId)
      return next
    })
  }, [])
  const [skills, setSkills] = useState<SkillItem[]>([])
  const [projectTabsLoading, setProjectTabsLoading] = useState(false)
  const [projectTabsError, setProjectTabsError] = useState<string | null>(null)
  const [activeThreadId, setActiveThreadId] = useState<string>('')
  const threadsRef = useRef<ChatThread[]>([])
  const pendingNewChat = useRef<Promise<ChatThread | null> | null>(null)
  useEffect(() => {
    if (mode === 'dev') setActiveThreadId(activeAgentId || '')
  }, [mode, activeAgentId])
  threadsRef.current = threads
  const reportedTaskIds = useRef(new Set<string>())
  const completedTaskPollAttempts = useRef(new Map<string, number>())
  const seenRunningTaskIds = useRef(new Set<string>())
  const projectHydrationControllers = useRef(new Map<string, Set<AbortController>>())
  const projectHydrationReads = useRef(new Map<string, Set<Promise<unknown>>>())
  const purgingProjectIds = useRef(new Set<string>())

  const abortProjectHydrations = async (projectId: string) => {
    for (const controller of projectHydrationControllers.current.get(projectId) ?? []) {
      controller.abort()
    }
    projectHydrationControllers.current.delete(projectId)
    const pendingReads = [...(projectHydrationReads.current.get(projectId) ?? [])]
    await Promise.allSettled(pendingReads)
    projectHydrationReads.current.delete(projectId)
  }

  // El servidor no persiste adjuntos: se recuerdan por sesión para devolverlos al mensaje al recargar.
  const sentAttachments = useRef(
    new Map<string, Array<{ content: string; attachments: ChatAttachment[] }>>(),
  )

  const loadThreadMessagesRaw = useCallback(
    async (sessionId: string, projectId?: string | null, onIncomplete?: () => void) => {
      if (projectId && purgingProjectIds.current.has(projectId)) return []
      const controller = new AbortController()
      if (projectId) {
        const controllers = projectHydrationControllers.current.get(projectId) ?? new Set()
        controllers.add(controller)
        projectHydrationControllers.current.set(projectId, controllers)
      }
      let settled: [
        PromiseSettledResult<ChatMessageRow[]>,
        PromiseSettledResult<TimelineResponse>,
        PromiseSettledResult<ProjectTaskRow[]>,
      ]
      try {
        const reads = Promise.allSettled([
          getSessionMessages(sessionId, projectId ?? null, controller.signal),
          getTimeline(sessionId, projectId ?? null, controller.signal),
          getProjectTasks(projectId, controller.signal),
        ])
        if (projectId) {
          const pending = projectHydrationReads.current.get(projectId) ?? new Set()
          pending.add(reads)
          projectHydrationReads.current.set(projectId, pending)
        }
        try {
          settled = await reads
        } finally {
          if (projectId) {
            const pending = projectHydrationReads.current.get(projectId)
            pending?.delete(reads)
            if (pending?.size === 0) projectHydrationReads.current.delete(projectId)
          }
        }
      } finally {
        if (projectId) {
          const controllers = projectHydrationControllers.current.get(projectId)
          controllers?.delete(controller)
          if (controllers?.size === 0) projectHydrationControllers.current.delete(projectId)
        }
      }
      if (controller.signal.aborted) {
        onIncomplete?.()
        return []
      }
      const [messagesResult, timelineResult, tasksResult] = settled
      if (messagesResult.status !== 'fulfilled') throw messagesResult.reason
      const rows = messagesResult.value
      const baseMessages = rows.map(mapMessage)
      if (timelineResult.status !== 'fulfilled' || tasksResult.status !== 'fulfilled') {
        onIncomplete?.()
        return baseMessages
      }
      const detailed = attachTurnDetails(baseMessages, rows, timelineResult.value)
      const pendingTasks = new Map(
        tasksResult.value
          .filter((task) => task.status === 'pending')
          .map((task) => [task.id, task]),
      )
      const taskById = new Map(tasksResult.value.map((task) => [task.id, task]))
      return detailed.map((named) => {
        const row = rows.find((candidate) => String(candidate.id) === named.id)
        let message = named
        if (row?.taskId) {
          const known = taskById.get(row.taskId)
          const hasLaterReport = rows.some(
            (other) => other.taskId === row.taskId && other.taskReport && other.id > row.id,
          )
          message = {
            ...named,
            taskDescription: known?.description,
            ...(!known && !hasLaterReport && !named.taskReport ? { taskDeleted: true } : {}),
          }
        }
        if (!message.taskHeld || !row?.taskId) return message
        const task = pendingTasks.get(row.taskId)
        // Una pending con motivo ya fue lanzada (fallo o bloqueo por árbol sucio).
        if (task?.status === 'pending' && task.retryReason?.trim())
          return { ...message, taskHeld: false, proposedTask: undefined }
        // ERP.4.13: ya se lanzó (hay un reporte posterior de la misma tarea): la acción vive en el último reporte
        const launched = rows.some(
          (later) => later.id > row.id && later.taskId === row.taskId && later.taskReport,
        )
        if (launched) return { ...message, taskHeld: false, proposedTask: undefined }
        if (!task) return { ...message, taskHeld: false, proposedTask: undefined }
        return {
          ...message,
          proposedTask: {
            id: task.id,
            description: task.description,
            output: row.existingFiles.length ? row.existingFiles : (task.output ?? []),
          },
        }
      })
    },
    [],
  )

  const loadThreadMessages = useCallback(
    async (sessionId: string, projectId?: string | null, onIncomplete?: () => void) => {
      const messages = await loadThreadMessagesRaw(sessionId, projectId, onIncomplete)
      return [...(sentAttachments.current.get(sessionId) ?? [])]
        .reverse()
        .reduce((merged, entry) => mergeOptimisticAttachments(merged, entry), messages)
    },
    [loadThreadMessagesRaw],
  )

  // USO.8: los hilos que no están abiertos y el historial solo leen mensajes; la línea de tiempo y las
  // tareas se piden al abrir el hilo (antes: una por sesión al cargar, ~38).
  const loadThreadMessagesLight = useCallback(
    async (sessionId: string, projectId?: string | null) => {
      if (projectId && purgingProjectIds.current.has(projectId)) return []
      const messages = (await getSessionMessages(sessionId, projectId ?? null)).map(mapMessage)
      return [...(sentAttachments.current.get(sessionId) ?? [])]
        .reverse()
        .reduce((merged, entry) => mergeOptimisticAttachments(merged, entry), messages)
    },
    [],
  )

  const settleChatTurn = useCallback(
    async (
      sessionId: string,
      projectId?: string | null,
      attempt = 0,
      generation = localSendGeneration.current.get(sessionId) ?? 0,
    ): Promise<void> => {
      let messages: Awaited<ReturnType<typeof loadThreadMessages>>
      try {
        messages = await loadThreadMessages(sessionId, projectId)
      } catch (error) {
        // El hilo ya pasó a running:false: ningún poll lo vuelve a pedir, así que se reintenta aquí.
        if (attempt >= 3) throw error
        await new Promise((resolve) => window.setTimeout(resolve, 1000 * 2 ** attempt))
        return settleChatTurn(sessionId, projectId, attempt + 1, generation)
      }
      // Hubo un envío nuevo desde que empezó esta lectura (en curso o ya terminado): su propia
      // recarga es más nueva; aplicar esta pisaría su turno.
      if ((localSendGeneration.current.get(sessionId) ?? 0) !== generation) return
      setThreads((current) =>
        current.map((thread) =>
          thread.id === sessionId ? { ...thread, messages, running: false } : thread,
        ),
      )
    },
    [loadThreadMessages],
  )

  // biome-ignore lint/correctness/useExhaustiveDependencies: cambiar de modo vuelve a hidratar las sesiones visibles.
  useEffect(() => {
    let disposed = false
    const visibleProjectId = activeProjectId || projects[0]?.id || null
    void listSessions(visibleProjectId)
      .then(async (loaded) => {
        if (disposed) return
        const initial = loaded.map((thread) => ({ ...thread, messagesLoaded: false }))
        setRunningSessionIds((current) => {
          const next = new Set(current)
          for (const thread of loaded) {
            if (thread.running) next.add(thread.id)
            else if (!locallyRunningSessionIds.current.has(thread.id)) next.delete(thread.id)
          }
          return next
        })
        setThreads((current) => mergeLoadedThreads(current, initial, visibleProjectId))
        setAttentionSessionsProject(visibleProjectId)
        setActiveThreadId((current) =>
          activeAfterLoad(
            current,
            mergeLoadedThreads(threadsRef.current, initial, visibleProjectId),
            loaded,
          ),
        )
        const hydrated = await Promise.all(
          loaded.map(async (thread) => ({
            ...thread,
            messages: await loadThreadMessagesLight(thread.id, thread.projectId).catch(() => []),
            messagesLoaded: true,
            detailsLoaded: false,
          })),
        )
        const activeTimelines = await Promise.all(
          loaded
            .filter((thread) => thread.running)
            .map(async (thread) => ({
              id: thread.id,
              pending: (await getTimeline(thread.id, thread.projectId).catch(() => null))?.pending,
            })),
        )
        if (!disposed) {
          setRunningSessionIds((current) => {
            const next = new Set(current)
            for (const timeline of activeTimelines)
              if (timeline.pending === false && !locallyRunningSessionIds.current.has(timeline.id))
                next.delete(timeline.id)
            return next
          })
        }
        if (!disposed)
          setThreads((current) => mergeLoadedThreads(current, hydrated, visibleProjectId))
      })
      .catch(() => {
        if (!disposed) setThreads([])
      })
    return () => {
      disposed = true
    }
  }, [activeProjectId, projects, mode, loadThreadMessagesLight])

  useEffect(() => {
    let disposed = false
    void listProjects()
      .then((loaded) => {
        if (disposed) return
        setProjects(loaded)
        const remembered = (() => {
          try {
            return JSON.parse(localStorage.getItem('orchestos-last-dev') || 'null') as {
              projectId?: string
              sessionId?: string
            } | null
          } catch {
            return null
          }
        })()
        const rememberedProjectId =
          remembered?.projectId || localStorage.getItem('orchestos-last-project')
        const rememberedProject =
          rememberedProjectId && loaded.find((project) => project.id === rememberedProjectId)
        const rememberedAgent = rememberedProject?.agents.find(
          (agent) => agent.id === remembered?.sessionId,
        )
        setActiveProjectId((current) =>
          current && loaded.some((project) => project.id === current)
            ? current
            : rememberedProject?.id || loaded[0]?.id || '',
        )
        if (rememberedProject && rememberedAgent) {
          setDevTabs((current) => ({
            ...current,
            [rememberedProject.id]:
              current[rememberedProject.id] ??
              openSessionTab(emptySessionTabs(), rememberedAgent.id),
          }))
          void listSessions(rememberedProject.id).then(async (sessions) => {
            const session = sessions.find((item) => item.id === rememberedAgent.id)
            if (!session) return
            const hydrated = {
              ...session,
              messages: await loadThreadMessages(session.id, session.projectId),
            }
            setThreads((current) => [
              ...current.filter((item) => item.id !== hydrated.id),
              hydrated,
            ])
          })
        }
      })
      .catch(() => {
        if (!disposed) setProjects([])
      })
    return () => {
      disposed = true
    }
  }, [loadThreadMessages])

  // USO.8: el hilo abierto completa su línea de tiempo y tareas si solo tenía los mensajes.
  const detailsInFlight = useRef(new Set<string>())
  const [detailsRetry, setDetailsRetry] = useState(0)
  const activeNeedsDetails = threads.find(
    (thread) => thread.id === activeThreadId && thread.detailsLoaded === false,
  )
  // biome-ignore lint/correctness/useExhaustiveDependencies: detailsRetry relanza la lectura que quedó vieja.
  useEffect(() => {
    const target = activeNeedsDetails
    if (!target || detailsInFlight.current.has(target.id)) return
    // Con un envío en vuelo la lectura del servidor aún no lo trae: se espera a que asiente.
    if (target.messages.some((message) => message.id.startsWith('pending_'))) return
    detailsInFlight.current.add(target.id)
    let complete = true
    let stale = false
    void loadThreadMessages(target.id, target.projectId, () => {
      complete = false
    })
      .then((messages) => {
        // Sin línea de tiempo o tareas se queda pendiente: se reintenta al volver a abrirlo.
        if (!complete) return
        // Los mensajes cambiaron mientras se leía (envío, sondeo): esta lectura es vieja.
        const now = threadsRef.current.find((thread) => thread.id === target.id)
        if (now?.messages !== target.messages) {
          stale = now?.detailsLoaded === false
          return
        }
        setThreads((current) =>
          current.map((thread) =>
            thread.id === target.id &&
            thread.detailsLoaded === false &&
            thread.messages === target.messages
              ? { ...thread, messages, detailsLoaded: true }
              : thread,
          ),
        )
      })
      .catch(() => {})
      .finally(() => {
        detailsInFlight.current.delete(target.id)
        if (stale) setDetailsRetry((count) => count + 1)
      })
  }, [activeNeedsDetails, loadThreadMessages, detailsRetry])

  const currentProject = projects.find((p) => p.id === activeProjectId) || projects[0]

  const currentProjectId = currentProject?.id
  const currentProjectIdRef = useRef(currentProjectId)
  currentProjectIdRef.current = currentProjectId

  const [terminalInputs, setTerminalInputs] = useState<
    { id: string; projectId: string; data: string }[]
  >([])
  const handleRunCommand = (command: string) => {
    if (!currentProject) return
    setTerminalInputs((pending) => [
      ...pending,
      {
        id: crypto.randomUUID(),
        projectId: currentProject.id,
        data: `${command}\r`,
      },
    ])
    updateDevTabs(currentProject.id, openTerminalTab)
  }

  const handleOpenTerminal = () => {
    if (currentProject) updateDevTabs(currentProject.id, openTerminalTab)
  }

  const activeThread = threads.find((t) => t.id === activeThreadId)
  const hasRunningTasks = tasks.some((task) => task.status === 'running')
  const activeThreadTasks =
    threadTasks?.projectId === activeThread?.projectId ? (threadTasks?.tasks ?? []) : []
  const hasRunningThreadTasks = activeThreadTasks.some((task) => task.status === 'running')
  const pollThreadId = activeThread?.id
  const activeThreadProjectId = activeThread?.projectId
  const activeThreadMessages = activeThread?.messages
  useEffect(() => {
    if (!currentProjectId) return
    const localCountOf = (taskId: string) =>
      (activeThreadMessages ?? []).filter((other) => other.taskId === taskId).length
    const awaiting = [
      ...new Set(
        (activeThreadMessages ?? [])
          .filter((message) => message.role === 'assistant' && message.taskId && !message.taskHeld)
          .map((message) => message.taskId as string),
      ),
    ].filter(
      (taskId) =>
        !reportedTaskIds.current.has(
          `${pollThreadId}:${taskId}:${pollThreadId ? localCountOf(taskId) : 0}`,
        ),
    )
    if (!awaiting.length && !hasRunningTasks && !hasRunningThreadTasks) return
    let disposed = false
    let polling = false
    const poll = async () => {
      if (polling || document.hidden) return
      polling = true
      try {
        const result = await pollProjectAndThreadTasks(currentProjectId, activeThreadProjectId)
        if (disposed) return
        const tasks = result.threadTasks
        setTasks(result.projectTasks)
        setThreadTasks({ projectId: activeThreadProjectId, tasks })
        const byRun: Record<string, PendingApproval[]> = {}
        await Promise.all(
          tasks
            .filter(
              (task) => task.status === 'running' && task.runId && (task.pendingApprovals ?? 0) > 0,
            )
            .map(async (task) => {
              byRun[task.runId!] = await getRunApprovals(task.runId!, activeThreadProjectId)
            }),
        )
        if (disposed) return
        setApprovals({ projectId: activeThreadProjectId, byRun })
        for (const taskId of awaiting) {
          if (disposed || !pollThreadId) return
          const task = tasks.find((item) => item.id === taskId)
          const localCount = localCountOf(taskId)
          const runKey = `${pollThreadId}:${taskId}`
          const key = `${runKey}:${localCount}`
          const action = decideTaskPollAction({
            task,
            localCount,
            seenRunning: seenRunningTaskIds.current.has(runKey),
          })
          if (action === 'running') {
            seenRunningTaskIds.current.add(runKey)
            completedTaskPollAttempts.current.delete(key)
            continue
          }
          if (action === 'resolve') {
            reportedTaskIds.current.add(key)
            completedTaskPollAttempts.current.delete(key)
            continue
          }
          const messages = await loadThreadMessages(pollThreadId, activeThreadProjectId)
          if (disposed) return
          const outcome = resolveTaskReportPoll({
            localCount,
            serverCount: messages.filter((message) => message.taskId === taskId).length,
            attempts: completedTaskPollAttempts.current.get(key) ?? 0,
          })
          if (outcome.resolved) {
            reportedTaskIds.current.add(key)
            completedTaskPollAttempts.current.delete(key)
            if (outcome.merge) seenRunningTaskIds.current.delete(runKey)
          } else {
            completedTaskPollAttempts.current.set(key, outcome.attempts)
          }
          if (outcome.merge) {
            setThreads((prev) =>
              prev.map((thread) =>
                thread.id === pollThreadId
                  ? {
                      ...thread,
                      messages: [
                        ...thread.messages,
                        ...messages.filter(
                          (message) =>
                            !thread.messages.some((existing) => existing.id === message.id),
                        ),
                      ],
                    }
                  : thread,
              ),
            )
          }
        }
      } catch {
        // A transient polling failure should not hide a report forever.
      } finally {
        polling = false
      }
    }
    // USO.3: 1 s solo con una tarea corriendo; una que espera turno se consulta cada 5 s.
    const timer = window.setInterval(
      () => void poll(),
      hasRunningTasks || hasRunningThreadTasks ? 1_000 : 5_000,
    )
    void poll()
    return () => {
      disposed = true
      window.clearInterval(timer)
    }
  }, [
    pollThreadId,
    activeThreadProjectId,
    activeThreadMessages,
    currentProjectId,
    hasRunningTasks,
    hasRunningThreadTasks,
    loadThreadMessages,
  ])
  const activeAgent = currentProject?.agents.find((a) => a.id === activeAgentId) || null
  const projectForSession = (id: string) => {
    const thread = threads.find((item) => item.id === id)
    if (thread) return thread.projectId
    const archived = historySessions.find((item) => item.id === id)
    return archived?.projectId && archived.projectId !== 'workspace' ? archived.projectId : null
  }

  const handleSelectProject = (projectId: string) => {
    setActiveProjectId(projectId)
    localStorage.setItem('orchestos-last-project', projectId)
  }

  const reloadHistory = useCallback(async () => {
    const archived = await listArchivedSessions()
    const projectNames = new Map(projects.map((project) => [project.id, project.name]))
    const loaded = await Promise.all(
      archived.map(async (session) => {
        const messages = await loadThreadMessagesLight(session.id, session.projectId).catch(
          () => [],
        )
        const last = messages[messages.length - 1]
        const elapsed = Math.max(0, Date.now() - Date.parse(session.updatedAt))
        const minutes = Math.floor(elapsed / 60000)
        const timeAgo =
          minutes < 60
            ? `${minutes}m`
            : minutes < 2880
              ? `${Math.floor(minutes / 60)}h`
              : `${Math.floor(minutes / 1440)}d`
        return {
          id: session.id,
          projectId: session.projectId || 'workspace',
          projectName: session.projectId
            ? projectNames.get(session.projectId) || 'Unknown project'
            : 'Workspace',
          title: session.title,
          lastMessage: last?.content?.split(/\r?\n/).filter(Boolean).pop() || 'No messages',
          cliId: session.agent,
          model: last?.model || session.agent,
          messageCount: messages.length,
          timeAgo,
          logs: messages.map((message) => `${message.role}: ${message.content}`).slice(-8),
        } satisfies HistorySession
      }),
    )
    setHistorySessions(loaded)
  }, [projects, loadThreadMessagesLight])

  useEffect(() => {
    if (projects.length) void reloadHistory().catch(() => setHistorySessions([]))
  }, [projects, reloadHistory])

  useEffect(() => {
    if (!currentProjectId) {
      setRuns([])
      return
    }
    let disposed = false
    void listRuns(currentProjectId)
      .then((loaded) => {
        if (!disposed) setRuns(loaded)
      })
      .catch(() => {
        if (!disposed) setRuns([])
      })
    return () => {
      disposed = true
    }
  }, [currentProjectId])

  useEffect(() => {
    if (!currentProjectId) {
      setProjectContext(null)
      return
    }
    let disposed = false
    setProjectContext(null)
    void getProjectContext(currentProjectId)
      .then((context) => {
        if (!disposed) setProjectContext(context)
      })
      .catch(() => {
        if (!disposed) setProjectContext(null)
      })
    return () => {
      disposed = true
    }
  }, [currentProjectId])

  // biome-ignore lint/correctness/useExhaustiveDependencies: cambiar de modo refresca las tareas del proyecto.
  useEffect(() => {
    if (!currentProjectId) {
      setTasks([])
      setTaskError(null)
      return
    }
    if (purgingProjectIds.current.has(currentProjectId)) return
    let disposed = false
    const controller = new AbortController()
    const controllers = projectHydrationControllers.current.get(currentProjectId) ?? new Set()
    controllers.add(controller)
    projectHydrationControllers.current.set(currentProjectId, controllers)
    const taskRead = listTasks(currentProjectId, controller.signal)
    const pendingReads = projectHydrationReads.current.get(currentProjectId) ?? new Set()
    pendingReads.add(taskRead)
    projectHydrationReads.current.set(currentProjectId, pendingReads)
    void taskRead
      .then((result) => {
        if (disposed) return
        setTasks(result.tasks)
        setAttentionTasksProject(currentProjectId)
        setTaskError(result.error || null)
      })
      .catch((error) => {
        if (!disposed && !controller.signal.aborted) {
          setTasks([])
          setTaskError(error instanceof Error ? error.message : String(error))
        }
      })
    return () => {
      disposed = true
      controller.abort()
      const active = projectHydrationControllers.current.get(currentProjectId)
      active?.delete(controller)
      if (active?.size === 0) projectHydrationControllers.current.delete(currentProjectId)
      const pending = projectHydrationReads.current.get(currentProjectId)
      pending?.delete(taskRead)
      if (pending?.size === 0) projectHydrationReads.current.delete(currentProjectId)
    }
  }, [mode, currentProjectId])

  const refreshProjectTabs = useCallback(async (projectId: string) => {
    if (purgingProjectIds.current.has(projectId) || currentProjectIdRef.current !== projectId)
      return
    // Registrada como hidratación del proyecto: el purge la aborta antes de borrar (si no, 404 tras el purge).
    const controller = new AbortController()
    const controllers = projectHydrationControllers.current.get(projectId) ?? new Set()
    controllers.add(controller)
    projectHydrationControllers.current.set(projectId, controllers)
    setProjectTabsLoading(true)
    setProjectTabsError(null)
    const reads = Promise.all([
      listMemory(projectId, controller.signal),
      listSpecs(projectId, controller.signal),
      listSkills(projectId, controller.signal),
      listInstincts(projectId, controller.signal),
    ])
    const pending = projectHydrationReads.current.get(projectId) ?? new Set()
    pending.add(reads)
    projectHydrationReads.current.set(projectId, pending)
    try {
      const [nextMemory, nextSpecs, nextSkills, nextInstincts] = await reads
      if (controller.signal.aborted || currentProjectIdRef.current !== projectId) return
      setMemories(nextMemory)
      setSpecs(nextSpecs)
      setSkills(nextSkills)
      setInstincts(nextInstincts)
    } catch (error) {
      if (!controller.signal.aborted && currentProjectIdRef.current === projectId)
        setProjectTabsError(error instanceof Error ? error.message : String(error))
    } finally {
      pending.delete(reads)
      if (pending.size === 0) projectHydrationReads.current.delete(projectId)
      controllers.delete(controller)
      if (controllers.size === 0) projectHydrationControllers.current.delete(projectId)
      if (currentProjectIdRef.current === projectId) setProjectTabsLoading(false)
    }
  }, [])

  // biome-ignore lint/correctness/useExhaustiveDependencies: cambiar de modo refresca Memory, Specs, Skills e Instincts.
  useEffect(() => {
    if (currentProjectId) void refreshProjectTabs(currentProjectId)
    else {
      setMemories([])
      setSpecs([])
      setSkills([])
      setInstincts([])
    }
  }, [mode, currentProjectId, refreshProjectTabs])

  const refreshUsage = useCallback(async () => {
    if (!currentProjectId) return
    usageAbortRef.current?.abort()
    const controller = new AbortController()
    usageAbortRef.current = controller
    setRefreshingUsage(true)
    try {
      const response = await fetch('/api/session/status', {
        headers: { 'x-orchestos-project-id': currentProjectId },
        signal: controller.signal,
      })
      if (!response.ok) throw new Error(String(response.status))
      const nextStatus = (await response.json()) as SessionStatus
      setSessionStatus(nextStatus)
      try {
        localStorage.setItem('orchestos-session-status', JSON.stringify(nextStatus))
      } catch {
        // Storage is an optimization only; the live response remains authoritative.
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setSessionStatus(null)
    } finally {
      if (usageAbortRef.current === controller) {
        usageAbortRef.current = null
        setRefreshingUsage(false)
      }
    }
  }, [currentProjectId])

  useEffect(() => {
    if (!currentProjectId) return
    void refreshUsage()
    const timer = window.setInterval(() => void refreshUsage(), 60_000)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void refreshUsage()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      usageAbortRef.current?.abort()
    }
  }, [currentProjectId, refreshUsage])

  // Mode change handler that tracks previous mode
  const handleModeChange = (newMode: AppMode) => {
    if (mode !== 'settings') {
      setPreviousMode(mode)
    }
    if (newMode === 'dev' && currentProject && !activeDevTabs.tabs.length) {
      let lastId: string | undefined
      try {
        const last = JSON.parse(localStorage.getItem('orchestos-last-dev') || 'null')
        if (last?.projectId === currentProject.id) lastId = last.sessionId
      } catch {
        /* Storage unavailable. */
      }
      updateDevTabs(currentProject.id, (tabs) =>
        restoreSessionTabs(
          tabs,
          currentProject.agents.map((agent) => agent.id),
          lastId,
        ),
      )
    }
    setMode(newMode)
  }

  const handleOpenSettings = (section?: SettingsSection, tab: ProjectSubTab = 'general') => {
    setSettingsSearchSignal(0)
    setPreviousMode(mode === 'settings' ? 'dev' : mode)
    setSettingsSection(section || (currentProject ? `project_${currentProject.id}` : 'general'))
    setSettingsProjectTab(tab)
    setMode('settings')
  }

  const handleOpenProjectSettings = (projectId: string) => {
    setActiveProjectId(projectId)
    handleOpenSettings(`project_${projectId}`, 'general')
  }

  // Agent selection and launch in Dev mode
  const handleSelectAgent = async (agentId: string, projectId: string) => {
    setActiveProjectId(projectId)
    updateDevTabs(projectId, (tabs) => openSessionTab(tabs, agentId))
    localStorage.setItem(
      'orchestos-last-dev',
      JSON.stringify({ kind: 'session', projectId, sessionId: agentId }),
    )
    const session = (await listSessions(projectId)).find((item) => item.id === agentId)
    if (session) {
      const hydrated = {
        ...session,
        messages: await loadThreadMessages(agentId, session.projectId),
      }
      setThreads((current) => [...current.filter((item) => item.id !== agentId), hydrated])
      setActiveThreadId(agentId)
    }
    setMode('dev')
  }

  useAttentionNotifications({
    ready:
      attentionSessionsProject === (currentProject?.id ?? null) &&
      attentionTasksProject === currentProject?.id,
    threads,
    runningIds: runningSessionIds,
    failedIds: failedSessionIds.current,
    projectId: currentProject?.id ?? null,
    taskSources: [
      { projectId: currentProject?.id, tasks },
      ...(threadTasks && threadTasks.projectId !== currentProject?.id ? [threadTasks] : []),
    ],
    approvals,
    onSessions: (sessions) => {
      // Un turno retomado tras recargar puede terminar sin que lo vea el timeline: recargar sus mensajes aquí.
      for (const thread of threadsRef.current) {
        const session = sessions.find((item) => item.id === thread.id)
        if (
          thread.running &&
          session &&
          !session.running &&
          !locallyRunningSessionIds.current.has(thread.id)
        )
          void settleChatTurn(thread.id, thread.projectId).catch(() => {})
      }
      setThreads((current) =>
        current.map((thread) => {
          const session = sessions.find((item) => item.id === thread.id)
          return session
            ? { ...thread, running: session.running, updatedAt: session.updatedAt }
            : thread
        }),
      )
      setRunningSessionIds((current) => {
        const next = new Set(current)
        for (const session of sessions) {
          if (session.running) next.add(session.id)
          else if (!locallyRunningSessionIds.current.has(session.id)) next.delete(session.id)
        }
        return next
      })
    },
    onOpen: (thread) => {
      if (
        thread.projectId &&
        devTabs[thread.projectId]?.tabs.some(
          (tab) => tab.type === 'session' && tab.id === thread.id,
        )
      ) {
        void handleSelectAgent(thread.id, thread.projectId)
      } else {
        if (thread.projectId) setActiveProjectId(thread.projectId)
        setActiveThreadId(thread.id)
        setMode('chat')
      }
    },
  })

  // Restore session from history to sidebar
  // Project creation
  const [showCloneProject, setShowCloneProject] = useState(false)
  const handleNewProject = async (action: ProjectAddAction) => {
    if (action === 'clone') {
      setShowCloneProject(true)
      return
    }
    setProjectError(null)
    try {
      const project = await chooseProject()
      if (!project) return
      const loaded = await listProjects()
      setProjects(loaded)
      setActiveProjectId(project.id)
    } catch (error) {
      setProjectError(error instanceof Error ? error.message : 'Could not choose a project folder.')
    }
  }

  const [confirmation, setConfirmation] = useState<{
    kind: 'delete' | 'archive'
    action: () => unknown
  } | null>(null)
  const confirmThen = (kind: 'delete' | 'archive', action: () => unknown) => {
    const settings = readChatSettings()
    if (kind === 'delete' ? settings.confirmDelete : settings.confirmArchive)
      setConfirmation({ kind, action })
    else void action()
  }

  const handleCloseAgent = (agentId: string, projectId?: string) =>
    confirmThen('archive', async () => {
      try {
        await archiveSession(agentId, projectId ?? projectForSession(agentId))
        setDevTabs((current) =>
          Object.fromEntries(
            Object.entries(current).map(([projectId, tabs]) => [
              projectId,
              closeSessionTab(tabs, agentId),
            ]),
          ),
        )
        setProjects(await listProjects())
        await reloadHistory()
      } catch {
        // Keep the agent visible when the archive request fails.
      }
    })

  const handleRestoreAgent = async (session: HistorySession) => {
    try {
      await restoreSession(session.id, session.projectId === 'workspace' ? null : session.projectId)
      setProjects(await listProjects())
      await reloadHistory()
    } catch {
      // Keep the history entry visible when the restore request fails.
    }
  }

  const handleDeleteHistorySession = (sessionId: string, projectId?: string | null) =>
    confirmThen('delete', async () => {
      try {
        await deleteSession(sessionId, projectId ?? projectForSession(sessionId))
        discardChatQueue(sessionId)
        await reloadHistory()
      } catch {
        // Keep the history entry visible when the delete request fails.
      }
    })

  const handleDeleteProject = async (projectId: string) => {
    purgingProjectIds.current.add(projectId)
    // Desmontar primero: el cleanup cancela también las lecturas propias de Chat/Dev.
    flushSync(() => setDeletingProjectIds((current) => new Set(current).add(projectId)))
    await abortProjectHydrations(projectId)
    try {
      await deleteProject(projectId)
      const loaded = await listProjects()
      setProjects(loaded)
      setActiveProjectId((current) =>
        current === projectId || !loaded.some((project) => project.id === current)
          ? loaded[0]?.id || ''
          : current,
      )
      setThreads((current) => current.filter((thread) => thread.projectId !== projectId))
      setActiveThreadId((current) =>
        threads.some((thread) => thread.id === current && thread.projectId === projectId)
          ? ''
          : current,
      )
      updateDevTabs(projectId, () => emptySessionTabs())
      await reloadHistory()
    } catch {
      // Keep the project visible when the delete request fails.
    } finally {
      purgingProjectIds.current.delete(projectId)
      setDeletingProjectIds((current) => {
        const next = new Set(current)
        next.delete(projectId)
        return next
      })
    }
  }

  // Purge all project telemetry data (Danger Zone in Project Settings)
  const handlePurgeProjectData = async (projectId: string) => {
    purgingProjectIds.current.add(projectId)
    flushSync(() => setDeletingProjectIds((current) => new Set(current).add(projectId)))
    await abortProjectHydrations(projectId)
    try {
      await purgeProjectData(projectId)
      const loaded = await listProjects()
      setProjects(loaded)
      setActiveProjectId((current) => (current === projectId ? loaded[0]?.id || '' : current))
      updateDevTabs(projectId, () => emptySessionTabs())
      setRuns([])
      setThreads((current) => current.filter((thread) => thread.projectId !== projectId))
      setMode(previousMode || 'dev')
      await reloadHistory()
    } catch {
      // Keep the project settings visible when the purge request fails.
    } finally {
      purgingProjectIds.current.delete(projectId)
      setDeletingProjectIds((current) => {
        const next = new Set(current)
        next.delete(projectId)
        return next
      })
    }
  }

  // Danger Zone - Reset OrchestOS
  const handleResetOrchestos = () => {
    setRuns([])
    setInstincts((prev) => prev.filter((i) => i.verified))
    setTasks((prev) =>
      prev.map((t) => ({ ...t, status: 'pending', retryCount: 0, qaVerdict: undefined })),
    )
  }

  // Create new agent in project (triggered by Plus on project row)
  const handleCreateAgentInProject = (
    projectId: string,
    cliId: string,
    model: string,
    title: string,
  ) => {
    setProjectTabsError(null)
    void createSession({ agent: cliId, projectId, title })
      .then(async (thread) => {
        setActiveProjectId(projectId)
        updateDevTabs(projectId, (tabs) => openSessionTab(tabs, thread.id))
        localStorage.setItem(
          'orchestos-last-dev',
          JSON.stringify({ kind: 'session', projectId, sessionId: thread.id }),
        )
        threadsRef.current = [...threadsRef.current.filter((item) => item.id !== thread.id), thread]
        setThreads((current) => [...current.filter((item) => item.id !== thread.id), thread])
        setActiveThreadId(thread.id)
        setProjects(await listProjects())
        setMode('dev')
      })
      .catch((error) => setProjectTabsError(error instanceof Error ? error.message : String(error)))
  }

  // Chat actions
  const handleNewChat = async (
    cliId?: string,
    _model?: string,
    title?: string,
    selectedProjectId?: string | null,
  ) => {
    const creating = createSession({
      ...(cliId ? { agent: cliId } : {}),
      projectId: newChatProjectId(currentProject?.id, selectedProjectId),
      title,
    })
    pendingNewChat.current = creating.catch(() => null)
    try {
      const newThread = await creating
      threadsRef.current = [newThread, ...threadsRef.current]
      setThreads((prev) => [newThread, ...prev])
      setActiveThreadId(newThread.id)
    } catch {
      return
    } finally {
      pendingNewChat.current = null
    }
    setMode('chat')
  }

  const handleDeleteChat = (id: string) =>
    confirmThen('delete', async () => {
      try {
        await deleteSession(id, projectForSession(id))
        discardChatQueue(id)
        setThreads((prev) => {
          const remaining = prev.filter((thread) => thread.id !== id)
          if (activeThreadId === id) setActiveThreadId(remaining[0]?.id || '')
          return remaining
        })
      } catch {
        // Keep the server-backed row visible when the API rejects the mutation.
      }
    })

  const handleRenameChat = async (id: string) => {
    const thread = threads.find((item) => item.id === id)
    const title = window.prompt('Rename conversation', thread?.title || '')
    if (!title?.trim()) return
    try {
      const updated = await renameSession(id, title.trim(), projectForSession(id))
      setThreads((prev) =>
        prev.map((item) => (item.id === id ? { ...item, title: updated.title } : item)),
      )
    } catch {
      // Keep the current title when validation or the request fails.
    }
  }

  const handleSlashCommand = async (command: string, argument?: string) => {
    const id = mode === 'dev' ? activeAgentId : activeThreadId
    if (!id) return
    if (command === '/rename') {
      const title = argument?.trim() || window.prompt('Rename conversation', '')
      if (title?.trim()) {
        const updated = await renameSession(id, title.trim(), projectForSession(id))
        setThreads((prev) =>
          prev.map((item) => (item.id === id ? { ...item, title: updated.title } : item)),
        )
        setHistorySessions((prev) =>
          prev.map((item) => (item.id === id ? { ...item, title: updated.title } : item)),
        )
        setProjects(await listProjects())
      }
    } else if (command === '/usage') {
      handleOpenSettings('usage', 'tasks')
    } else if (command === '/archive') {
      await handleCloseAgent(id)
    }
  }

  const devSendLock = useRef(false)
  const handleDevSendMessage: typeof handleSendMessage = async (
    content,
    attachments,
    agent,
    model,
    effort,
    approvalMode,
  ) => {
    if (devSendLock.current || !currentProject) return false
    devSendLock.current = true
    try {
      let thread = threadsRef.current.find((item) => item.id === activeAgentId)
      if (!activeAgentId) {
        thread = await createSession({ ...(agent ? { agent } : {}), projectId: currentProject.id })
        threadsRef.current = [thread, ...threadsRef.current]
        setThreads((current) => [thread!, ...current])
        setActiveThreadId(thread.id)
        updateDevTabs(currentProject.id, (tabs) =>
          convertNewTab(tabs, activeDevTab?.id ?? null, thread!.id),
        )
        localStorage.setItem(
          'orchestos-last-dev',
          JSON.stringify({ projectId: currentProject.id, sessionId: thread.id }),
        )
        setProjects(await listProjects())
      }
      if (!thread) return false
      return await handleSendMessage(
        content,
        attachments,
        agent,
        model,
        effort,
        approvalMode,
        thread,
      )
    } catch {
      return false
    } finally {
      devSendLock.current = false
    }
  }

  const handleSendMessage = async (
    content: string,
    attachments?: ChatAttachment[],
    agent?: string,
    model?: string,
    effort?: string,
    approvalMode?: import('./types/orchestos').ApprovalMode,
    devThread?: ChatThread,
  ): Promise<boolean> => {
    let threadId = devThread?.id ?? activeThreadId
    let thread = devThread ?? threads.find((item) => item.id === threadId)
    // El composer del estado vacío ya es visible mientras New chat crea el hilo: se espera ese hilo
    // en vez de abrir una sesión general aparte y mandarle el mensaje sin proyecto.
    const pendingThread = await threadPendingForSend(threadId, pendingNewChat.current)
    if (pendingThread) {
      thread = pendingThread
      threadId = pendingThread.id
      agent = pendingThread.agent
      model = undefined
      effort = undefined
    }
    if (!threadId) {
      try {
        thread = await createSession({ ...(agent ? { agent } : {}), projectId: null })
        threadId = thread.id
        threadsRef.current = [thread, ...threadsRef.current]
        setThreads((prev) => [thread!, ...prev])
        setActiveThreadId(thread.id)
      } catch {
        return false
      }
    }
    const activeModel = model || undefined
    const optimistic = {
      id: `pending_${Date.now()}`,
      role: 'user' as const,
      content,
      timestamp: 'Just now',
      attachments,
      model: activeModel,
      effort,
    }
    if (attachments?.length) {
      const sent = sentAttachments.current.get(threadId) ?? []
      sentAttachments.current.set(threadId, [...sent, { content, attachments }])
    }
    setThreads((prev) =>
      prev.map((thread) =>
        thread.id === threadId ? { ...thread, messages: [...thread.messages, optimistic] } : thread,
      ),
    )
    failedSessionIds.current.delete(threadId)
    locallyRunningSessionIds.current.add(threadId)
    localSendGeneration.current.set(threadId, (localSendGeneration.current.get(threadId) ?? 0) + 1)
    setRunningSessionIds((current) => new Set(current).add(threadId))
    return sendMessage({
      sessionId: threadId,
      projectId: thread?.projectId ?? null,
      message: content,
      agent: agent || thread?.agent,
      model,
      effort,
      attachments,
      approvalMode,
    })
      .then(async () => {
        const firstMessageTitle = thread?.messages.length === 0 ? content.slice(0, 40) : undefined
        const reload = async () => {
          const messages = await loadThreadMessages(threadId, thread?.projectId)
          setThreads((prev) =>
            prev.map((item) =>
              item.id === threadId
                ? { ...item, messages, running: false, title: firstMessageTitle || item.title }
                : item,
            ),
          )
        }
        try {
          await reload()
        } catch {
          window.setTimeout(() => void reload().catch(() => {}), 1000)
        }
        if (firstMessageTitle) {
          void renameSession(threadId, firstMessageTitle, thread?.projectId ?? null).catch(
            () => undefined,
          )
          void listProjects()
            .then(setProjects)
            .catch(() => undefined)
        }
        void refreshUsage()
        return true
      })
      .catch(async (error) => {
        failedSessionIds.current.add(threadId)
        if (error.notice) {
          const messages = await loadThreadMessages(threadId, thread?.projectId)
          if (
            messages.some((message) =>
              message.notices?.some((notice) => notice.message === error.notice.message),
            )
          ) {
            setThreads((prev) =>
              prev.map((item) => (item.id === threadId ? { ...item, messages } : item)),
            )
            void refreshUsage()
            return false
          }
        }
        if (attachments?.length) {
          sentAttachments.current.set(
            threadId,
            (sentAttachments.current.get(threadId) ?? []).filter(
              (entry) => entry.attachments !== attachments,
            ),
          )
        }
        setThreads((prev) =>
          prev.map((item) =>
            item.id === threadId
              ? {
                  ...item,
                  messages: item.messages.filter((message) => message.id !== optimistic.id),
                }
              : item,
          ),
        )
        void refreshUsage()
        throw error
      })
      .finally(() => {
        locallyRunningSessionIds.current.delete(threadId)
        setRunningSessionIds((current) => {
          const next = new Set(current)
          next.delete(threadId)
          return next
        })
      })
  }

  const handleApproveHeldTask = (taskId: string) =>
    launchThreadTask(taskId, (thread, onStarted) =>
      runProjectTask(taskId, thread.projectId, onStarted, thread.id),
    )

  // ERP.4.13 — "Commit & Run" del reporte de árbol sucio: mismo ciclo que aprobar, otro endpoint.
  const handleCommitRunTask = (taskId: string, files: string[]) =>
    launchThreadTask(taskId, (thread, onStarted) =>
      commitAndRunProjectTask(taskId, files, thread.projectId, onStarted, thread.id),
    )

  const launchThreadTask = async (
    taskId: string,
    launch: (thread: ChatThread, onStarted: () => void) => Promise<void>,
  ) => {
    const thread = activeThread
    if (!thread) return
    try {
      const runKey = `${thread.id}:${taskId}`
      for (const key of [...reportedTaskIds.current]) {
        if (key.startsWith(`${runKey}:`)) reportedTaskIds.current.delete(key)
      }
      seenRunningTaskIds.current.add(runKey)
      await launch(thread, () => {
        setThreads((prev) =>
          prev.map((item) =>
            item.id === thread.id
              ? {
                  ...item,
                  messages: item.messages.map((message) =>
                    message.proposedTask?.id === taskId
                      ? { ...message, taskHeld: false, proposedTask: undefined }
                      : message,
                  ),
                }
              : item,
          ),
        )
      })
    } finally {
      if (thread.projectId === currentProject?.id) {
        await listRuns(thread.projectId)
          .then(setRuns)
          .catch(() => undefined)
      }
      const messages = await loadThreadMessages(thread.id, thread.projectId).catch(() => null)
      if (messages) {
        setThreads((prev) =>
          prev.map((item) => (item.id === thread.id ? { ...item, messages } : item)),
        )
      }
      await refreshUsage()
    }
  }

  const handleRunTask = async (taskId: string) => {
    if (!currentProject || runningTaskId) return
    const projectId = currentProject.id
    const isCurrentProject = () => currentProjectIdRef.current === projectId
    setTaskRunError(null)
    setRunningTaskId(taskId)
    try {
      await runTask(taskId, projectId, (loaded) => {
        if (!isCurrentProject()) return
        setTasks(loaded)
        setTaskError(null)
      })
      if (isCurrentProject()) await refreshProjectTabs(projectId)
    } catch (error) {
      if (!isCurrentProject()) return
      setTaskRunError({
        message: error instanceof Error ? error.message : String(error),
        code: error instanceof TaskRunError ? error.code : undefined,
      })
      await listTasks(projectId)
        .then((result) => {
          if (!isCurrentProject()) return
          setTasks(result.tasks)
          setTaskError(result.error || null)
        })
        .catch(() => undefined)
    } finally {
      setRunningTaskId(null)
      await listRuns(projectId)
        .then((result) => {
          if (isCurrentProject()) setRuns(result)
        })
        .catch(() => undefined)
      if (isCurrentProject()) await refreshUsage()
    }
  }

  const handleRunNextTask = async () => {
    const nextTask = getRunnableTask(tasks)
    if (nextTask) await handleRunTask(nextTask.id)
  }

  const handleRejectHeldTask = async (taskId: string) => {
    const thread = activeThread
    if (!thread) return
    // Hide it immediately after the DELETE succeeds; the reload is only for
    // persisted state and must use the session's project context.
    await deleteProjectTask(taskId, thread.projectId)
    setThreads((prev) =>
      prev.map((item) =>
        item.id === thread.id
          ? {
              ...item,
              messages: item.messages.map((message) =>
                message.proposedTask?.id === taskId
                  ? { ...message, taskHeld: false, proposedTask: undefined, taskDeleted: true }
                  : message,
              ),
            }
          : item,
      ),
    )
    const messages = await loadThreadMessages(thread.id, thread.projectId)
    setThreads((prev) => prev.map((item) => (item.id === thread.id ? { ...item, messages } : item)))
  }

  const reloadTabs = () =>
    currentProject ? refreshProjectTabs(currentProject.id) : Promise.resolve()
  const handleApproveSpec = async (id: string) => {
    if (currentProject) {
      await approveSpec(currentProject.id, id)
      await reloadTabs()
    }
  }
  const handleDraftSpec = async (id: string) => {
    if (currentProject) {
      await draftSpec(
        currentProject.id,
        id,
        tasks.find((task) => task.id === id)?.description ?? id,
      )
      await reloadTabs()
    }
  }
  const handleLintSpec = async (id: string) => {
    if (currentProject) {
      await lintSpec(currentProject.id, id)
      await reloadTabs()
    }
  }
  const handleResolveConflict = async (id: string, content: string) => {
    if (currentProject) {
      await resolveMemoryConflict(currentProject.id, id, content)
      await reloadTabs()
    }
  }
  const handleAddLibrarySkill = async (url: string) => {
    if (!currentProject) throw new Error('Select a project')
    const result = await addLibrarySkill(currentProject.id, url)
    await reloadTabs()
    return result
  }
  const handleEnableLibrarySkill = async (id: string, enabled: boolean) => {
    if (!currentProject) throw new Error('Select a project')
    await enableLibrarySkill(currentProject.id, id, enabled)
    await reloadTabs()
  }
  const handleSetLibrarySkillPhases = async (id: string, phases: TaskClass[]) => {
    if (!currentProject) throw new Error('Select a project')
    await setLibrarySkillPhases(currentProject.id, id, phases)
    await reloadTabs()
  }
  const handleCompileSkill = async (id: string) => {
    if (currentProject) {
      const result = await compileSkill(currentProject.id, id)
      await reloadTabs()
      return result
    }
    return { paths: [] }
  }
  const handleApproveInstinct = async (id: string) => {
    if (currentProject) {
      await approveInstinct(currentProject.id, id)
      await reloadTabs()
    }
  }
  const handleRejectInstinct = async (id: string) => {
    if (currentProject) {
      await rejectInstinct(currentProject.id, id)
      await reloadTabs()
    }
  }
  const handleSetInstinctStatus = async (id: string, status: 'active' | 'retired') => {
    if (!currentProject) return
    await setInstinctStatus(currentProject.id, id, status)
    await reloadTabs()
  }
  const handlePreviewGraduation = async (id: string) => {
    if (!currentProject) throw new Error('project required')
    return previewGraduation(currentProject.id, id)
  }
  const handleGraduateInstinct = async (id: string) => {
    if (!currentProject) throw new Error('project required')
    const result = await graduateInstinct(currentProject.id, id)
    await reloadTabs()
    return result
  }
  const handleUpdateInstinct = async (
    id: string,
    fields: { trigger: string; action: string; why: string },
  ) => {
    if (!currentProject) return
    await updateInstinct(currentProject.id, id, fields)
    await reloadTabs()
  }
  const handleAddInstinct = async (trigger: string, action: string) => {
    if (currentProject) {
      await addInstinct(currentProject.id, trigger, action)
      await reloadTabs()
    }
  }
  const handleExplainTask = async (id: string) => {
    if (!currentProject) return {}
    return explainTask(currentProject.id, id)
  }

  // Command Palette Handlers (Requirement 9)
  const handleCommandPaletteSelectTab = (tab: NavigationTab) => {
    if (tab === 'threads') {
      setMode('chat')
    } else {
      // Map navigation tab to Settings -> Projects subtab
      const validSubTabs: Record<string, ProjectSubTab> = {
        plan: 'plan',
        runs: 'runs',
        specs: 'specs',
        instincts: 'instincts',
        memory: 'memory',
        skills: 'skills',
        context: 'graph',
      }
      const targetTab = validSubTabs[tab] || 'tasks'
      handleOpenSettings(currentProject ? `project_${currentProject.id}` : 'general', targetTab)
    }
  }

  const selectDevTab = (id: string) => {
    const tab = activeDevTabs.tabs.find((tab) => tab.id === id)
    if (tab?.type === 'session') void handleSelectAgent(id, activeProjectId)
    else updateDevTabs(activeProjectId, (tabs) => ({ ...tabs, activeId: id }))
  }

  const executeCommand = (id: CommandId): boolean => {
    const binding = KEYBINDINGS.find((binding) => binding.id === id)!
    if (binding.when === 'Dev' && (mode !== 'dev' || !currentProject)) return false
    switch (id) {
      case 'zoom-in':
      case 'zoom-out':
        writeAppearanceSettings({
          uiScale: stepScale(readAppearanceSettings().uiScale, id === 'zoom-in' ? 1 : -1),
        })
        break
      case 'zoom-reset':
        writeAppearanceSettings({ uiScale: resetScale() })
        break
      case 'command-palette':
        setIsCommandPaletteOpen(true)
        break
      case 'settings-search':
        if (mode !== 'settings') handleOpenSettings()
        setSettingsSearchSignal((value) => value + 1)
        break
      case 'go-to-file':
        if (!currentProject) return false
        setIsGoToFileOpen(true)
        break
      case 'open-settings':
        handleOpenSettings()
        break
      case 'mode-chat':
        handleModeChange('chat')
        break
      case 'mode-dev':
        handleModeChange('dev')
        break
      case 'new-chat':
        if (mode !== 'chat') handleModeChange('chat')
        setIsLeftSidebarOpen(true)
        setNewChatSignal((value) => value + 1)
        break
      case 'toggle-sidebar':
        if (mode === 'settings') return false
        setIsLeftSidebarOpen((open) => !open)
        break
      case 'toggle-right-panel':
        if (mode !== 'dev') return false
        setIsRightInspectorOpen((open) => !open)
        break
      case 'new-terminal':
        handleOpenTerminal()
        break
      case 'close-tab':
        if (!activeDevTab) return false
        closeDevTab(activeProjectId, activeDevTab.id)
        break
      case 'next-tab':
      case 'previous-tab': {
        const { tabs, activeId } = activeDevTabs
        if (!tabs.length) return false
        const index = tabs.findIndex((tab) => tab.id === activeId)
        selectDevTab(tabs[(index + (id === 'next-tab' ? 1 : -1) + tabs.length) % tabs.length].id)
        break
      }
      case 'stop-turn':
        return mode !== 'settings' && stopActiveChatTurn()
    }
    return true
  }

  // Bubble after local menus and inputs have had the opportunity to consume the key.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) return
      const modal = '[role="dialog"], [aria-modal="true"], dialog[open]'
      if (
        document.querySelector(modal) ||
        event.composedPath().some((node) => node instanceof Element && node.matches(modal))
      )
        return
      const target = event.target instanceof Element ? event.target : null
      const terminal = !!target?.closest('.xterm')
      for (const binding of KEYBINDINGS) {
        if (binding.id === 'command-palette' && mode === 'settings') continue
        if (binding.id === 'settings-search' && mode !== 'settings') continue
        if (!binding.match(event)) continue
        if (terminal && !reachesAppFromTerminal(binding, event)) return
        if (binding.id === 'stop-turn') {
          const menu = '[role="menu"], [role="listbox"]'
          if (
            document.querySelector(menu) ||
            event.composedPath().some((node) => node instanceof Element && node.matches(menu))
          )
            return
          const input = target?.closest('input, textarea, [contenteditable="true"]')
          const text =
            input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement
              ? input.value
              : input?.textContent
          if (terminal || text) return
        }
        if (executeCommand(binding.id)) event.preventDefault()
        return
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  return (
    <div
      data-theme={theme}
      style={{ width: `calc(100vw / ${uiScale})`, height: `calc(100vh / ${uiScale})` }}
      className="h-screen w-screen flex flex-col bg-app-bg text-app font-sans overflow-hidden select-none"
    >
      {confirmation && (
        <ConfirmDialog
          title={confirmation.kind === 'delete' ? 'Delete this chat?' : 'Archive this agent?'}
          body={
            confirmation.kind === 'archive' ? 'It moves to History; you can restore it.' : undefined
          }
          confirmLabel={confirmation.kind === 'delete' ? 'Delete' : 'Archive'}
          onCancel={() => setConfirmation(null)}
          onConfirm={(dontAskAgain) => {
            if (dontAskAgain)
              writeChatSettings(
                confirmation.kind === 'delete'
                  ? { confirmDelete: false }
                  : { confirmArchive: false },
              )
            setConfirmation(null)
            void confirmation.action()
          }}
        />
      )}
      {closeRunning && (
        <ConfirmDialog
          title="Stop this agent?"
          body="It's still working. Keep it running and find it in the sidebar."
          confirmLabel="Stop and close"
          secondaryLabel="Keep running"
          onCancel={() => setCloseRunning(null)}
          onConfirm={(dontAskAgain) => {
            if (dontAskAgain) writeChatSettings({ closeRunningTab: 'stop' })
            void stopActiveChatSession(closeRunning.id, closeRunning.projectId)
            updateDevTabs(closeRunning.projectId, (tabs) => closeSessionTab(tabs, closeRunning.id))
            setCloseRunning(null)
          }}
          onSecondary={(dontAskAgain) => {
            if (dontAskAgain) writeChatSettings({ closeRunningTab: 'keep' })
            updateDevTabs(closeRunning.projectId, (tabs) => closeSessionTab(tabs, closeRunning.id))
            setCloseRunning(null)
          }}
        />
      )}
      {projectError && (
        <div
          role="alert"
          className="fixed right-4 top-12 z-[60] max-w-sm rounded-control border border-app-error/60 bg-app-surface px-3 py-2 text-xs text-app shadow-2xl"
        >
          {projectError}
        </div>
      )}
      {/* Top Shell Header */}
      <ShellHeader
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onToggleLeftSidebar={
          mode !== 'settings' ? () => setIsLeftSidebarOpen(!isLeftSidebarOpen) : undefined
        }
        onToggleRightInspector={
          mode === 'dev' ? () => setIsRightInspectorOpen(!isRightInspectorOpen) : undefined
        }
        isRightInspectorOpen={isRightInspectorOpen}
      />

      {/* Main App Workspace Layout */}
      <div data-shell-workspace className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: ONLY shown in Chat and Dev modes (Hidden in Settings for full-screen mode, Requirement 7) */}
        <div className={mode !== 'settings' && isLeftSidebarOpen ? 'flex shrink-0' : 'hidden'}>
          <ShellSidebar
            newChatSignal={newChatSignal}
            mode={mode}
            onChangeMode={handleModeChange}
            threads={threadsWithApprovals(threads, [
              { projectId: currentProject?.id, tasks },
              { projectId: activeThread?.projectId, tasks: activeThreadTasks },
            ])}
            activeThreadId={activeThreadId}
            onSelectThread={setActiveThreadId}
            onNewChat={handleNewChat}
            onDeleteChat={handleDeleteChat}
            projects={projectsWithApprovals(
              projects.map((project) => ({
                ...project,
                agents: project.agents.map((agent) =>
                  project.id === currentProject?.id
                    ? {
                        ...agent,
                        status: runningSessionIds.has(agent.id)
                          ? 'active'
                          : agent.status === 'active'
                            ? 'completed'
                            : agent.status,
                      }
                    : agent,
                ),
              })),
              currentProject?.id,
              tasks,
            )}
            activeProjectId={activeProjectId}
            onSelectProject={handleSelectProject}
            onNewProject={(action) => {
              void handleNewProject(action)
            }}
            onOpenSettings={() => handleOpenSettings(undefined, 'tasks')}
            onOpenProjectSettings={handleOpenProjectSettings}
            activeAgentId={activeAgentId}
            onSelectAgent={handleSelectAgent}
            onCloseAgent={handleCloseAgent}
            onDeleteProject={handleDeleteProject}
            onCreateAgentInProject={handleCreateAgentInProject}
          />
        </div>

        {/* Panel: everything right of the sidebar, a lighter surface under the header */}
        <div
          className={`flex-1 flex overflow-hidden ${
            mode === 'settings' ? '' : 'bg-app-surface rounded-tl-[10px]'
          }`}
        >
          {/* Center Canvas / Views */}
          <div className="flex-1 min-w-[360px] flex overflow-hidden">
            {/* VIEW 1: CHAT */}
            {mode === 'chat' &&
              (!activeThread?.projectId || !deletingProjectIds.has(activeThread.projectId)) && (
                <OrchestChatView
                  thread={activeThread}
                  tasks={activeThreadTasks}
                  approvals={
                    approvals?.projectId === activeThread?.projectId ? approvals?.byRun : undefined
                  }
                  projectName={
                    projects.find((project) => project.id === activeThread?.projectId)?.name
                  }
                  projectExists={
                    !activeThread?.projectId ||
                    (!deletingProjectIds.has(activeThread.projectId) &&
                      projects.some((project) => project.id === activeThread.projectId))
                  }
                  onTurnSettled={() => {
                    if (activeThread)
                      void settleChatTurn(activeThread.id, activeThread.projectId).catch(() => {})
                  }}
                  onSendMessage={handleSendMessage}
                  onApproveHeldTask={handleApproveHeldTask}
                  onViewEvidence={async (runId) => {
                    if (!activeThread?.projectId) return
                    const evidence = await getRun(runId, activeThread.projectId)
                    setRuns((current) => [evidence, ...current.filter((run) => run.id !== runId)])
                    setEvidenceRunId(runId)
                    handleOpenSettings(`project_${activeThread.projectId}`, 'runs')
                  }}
                  onRetryTask={handleApproveHeldTask}
                  onCommitRunTask={handleCommitRunTask}
                  onRejectHeldTask={handleRejectHeldTask}
                  sessionStatus={sessionStatus}
                  onSlashCommand={handleSlashCommand}
                  onOpenRouting={() => handleOpenSettings('model_routing')}
                />
              )}

            {/* VIEW 2: DEV WORKSPACE */}
            {mode === 'dev' && (
              <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
                <DevSessionTabs
                  agents={currentProject?.agents ?? []}
                  state={activeDevTabs}
                  runningSessionIds={runningSessionIds}
                  dirtyFileTabs={dirtyFileTabs}
                  projectId={activeProjectId}
                  onSelect={selectDevTab}
                  onPin={(request) =>
                    updateDevTabs(activeProjectId, (tabs) => openPathTab(tabs, request))
                  }
                  onClose={(id) => closeDevTab(activeProjectId, id)}
                  onNew={(action) => {
                    if (action.kind === 'create-session') {
                      handleCreateAgentInProject(activeProjectId, action.agent, '', 'OpenCode')
                    } else {
                      updateDevTabs(activeProjectId, (tabs) =>
                        openNewTab(tabs, undefined, action.agent),
                      )
                    }
                  }}
                />
                {activeDevTab?.type === 'diff' ? (
                  <DevDiffPanel
                    key={`${activeProjectId}:${activeDevTab.path}`}
                    projectId={activeProjectId}
                    path={activeDevTab.path}
                    revision={diffRevision}
                    onOpenFile={handleOpenFile}
                  />
                ) : activeDevTab?.type === 'file' ? (
                  <DevFilePanel
                    key={activeProjectId}
                    projectId={activeProjectId}
                    path={activeDevTab.path}
                    onClose={(path) => closeDevTab(activeProjectId, `file:${path}`)}
                  />
                ) : activeDevTab &&
                  activeDevTab.type !== 'terminal' &&
                  activeAgent?.agent !== 'opencode' &&
                  currentProject &&
                  !deletingProjectIds.has(currentProject.id) ? (
                  <OrchestDevWorkspace
                    key={activeDevTab?.id ?? activeProjectId}
                    activeProject={currentProject}
                    activeAgent={activeAgent}
                    newSessionAgent={activeDevTab.type === 'new' ? activeDevTab.agent : undefined}
                    onCloseAgent={handleCloseAgent}
                    onSendMessage={handleDevSendMessage}
                    onTimelinePending={handleDevTimelinePending}
                    onRunCommand={handleRunCommand}
                    sessionStatus={sessionStatus}
                    onSlashCommand={handleSlashCommand}
                  />
                ) : null}
                {currentProject &&
                  activeDevTabs.tabs.map((tab) => {
                    const isShell = tab.type === 'terminal'
                    if (
                      !isShell &&
                      !(
                        tab.type === 'session' &&
                        currentProject.agents.some(
                          (agent) => agent.id === tab.id && agent.agent === 'opencode',
                        )
                      )
                    )
                      return null
                    return (
                      <div
                        key={tab.id}
                        hidden={tab.id !== activeDevTabs.activeId}
                        data-dev-terminal={isShell ? '' : undefined}
                        className="flex-1 min-h-0 min-w-0 overflow-hidden"
                      >
                        <OpenCodeTerminal
                          projectId={currentProject.id}
                          kind={isShell ? 'shell' : 'opencode'}
                          pendingInput={
                            isShell
                              ? terminalInputs.filter(
                                  (input) => input.projectId === currentProject.id,
                                )
                              : undefined
                          }
                          onInputConsumed={(id) =>
                            setTerminalInputs((pending) =>
                              pending.filter((input) => input.id !== id),
                            )
                          }
                        />
                      </div>
                    )
                  })}
              </div>
            )}

            {/* VIEW 3: SETTINGS (Full screen mode without sidebar, hosts project tasks, runs, specs, etc.) */}
            {mode === 'settings' && (
              <OrchestSettingsView
                key={`${settingsSection}:${settingsProjectTab}`}
                settingsSearchSignal={settingsSearchSignal}
                onBackToApp={() => setMode(previousMode || 'dev')}
                projects={projects}
                onProjectUpdated={(updated) =>
                  setProjects((rows) =>
                    rows.map((project) =>
                      project.id === updated.id
                        ? { ...project, ...updated, agents: project.agents }
                        : project,
                    ),
                  )
                }
                activeProjectId={activeProjectId}
                onSelectProject={handleSelectProject}
                onAddProject={(action) => {
                  void handleNewProject(action)
                }}
                currentTheme={theme}
                onSelectTheme={setTheme}
                language={language}
                onSelectLanguage={setLanguage}
                initialSection={settingsSection}
                initialProjectTab={settingsProjectTab}
                initialRunId={evidenceRunId}
                tasks={tasks}
                taskError={taskRunError?.message || taskError}
                onOpenTaskRouting={
                  taskRunError?.code === 'role_unassigned'
                    ? () => handleOpenSettings('model_routing')
                    : undefined
                }
                runs={runs}
                projectContext={projectContext}
                specs={specs}
                memories={memories}
                skills={skills}
                instincts={instincts}
                onApproveSpec={handleApproveSpec}
                onDraftSpec={handleDraftSpec}
                onLintSpec={handleLintSpec}
                onResolveConflict={handleResolveConflict}
                onCompileSkill={handleCompileSkill}
                onAddLibrarySkill={handleAddLibrarySkill}
                onEnableLibrarySkill={handleEnableLibrarySkill}
                onSetLibrarySkillPhases={handleSetLibrarySkillPhases}
                onApproveInstinct={handleApproveInstinct}
                onRejectInstinct={handleRejectInstinct}
                onSetInstinctStatus={handleSetInstinctStatus}
                onPreviewGraduation={handlePreviewGraduation}
                onGraduateInstinct={handleGraduateInstinct}
                onAddInstinct={handleAddInstinct}
                onUpdateInstinct={handleUpdateInstinct}
                onRunTask={(id) => void handleRunTask(id)}
                onExplainTask={handleExplainTask}
                projectTabsLoading={projectTabsLoading}
                projectTabsError={projectTabsError}
                onPurgeProjectData={handlePurgeProjectData}
                onResetOrchestos={handleResetOrchestos}
                onOpenChat={() => setMode('chat')}
                onRunNextTask={() => void handleRunNextTask()}
                canRunNextTask={Boolean(getRunnableTask(tasks)) && !runningTaskId}
                taskRunBusy={Boolean(runningTaskId)}
              />
            )}
          </div>

          {/* Right Inspector: ONLY available in Dev mode, toggleable via top header button */}
          {mode === 'dev' && isRightInspectorOpen && currentProject && (
            <OrcaRightInspector
              currentProject={currentProject}
              projects={projects}
              activeFilePath={activeDevTab?.type === 'file' ? activeDevTab.path : null}
              activeDiffPath={activeDevTab?.type === 'diff' ? activeDevTab.path : null}
              onOpenDiff={(request) =>
                updateDevTabs(activeProjectId, (tabs) => openPathTab(tabs, request))
              }
              onDiffRefresh={() => setDiffRevision((value) => value + 1)}
              onOpenFile={handleOpenFile}
              historySessions={historySessions}
              onRestoreAgentToSidebar={handleRestoreAgent}
              onDeleteHistorySession={handleDeleteHistorySession}
            />
          )}
        </div>
      </div>
      <ShellStatusBar
        status={sessionStatus}
        refreshing={refreshingUsage}
        onRefresh={() => void refreshUsage()}
        onToggleTerminal={mode === 'dev' ? handleOpenTerminal : undefined}
        terminalOpen={activeDevTab?.type === 'terminal'}
      />
      {showCloneProject && (
        <CloneProjectDialog
          projectPath={currentProject?.path}
          onClose={() => setShowCloneProject(false)}
          onCloned={async (project) => {
            setProjects(await listProjects())
            setActiveProjectId(project.id)
          }}
        />
      )}
      <DiscardChangesModal
        isOpen={!!discardTab}
        fileName={discardTab?.path.split('/').pop() ?? ''}
        onClose={() => setDiscardTab(null)}
        onConfirm={() => {
          if (!discardTab) return
          drop(discardTab.projectId, discardTab.path)
          updateDevTabs(discardTab.projectId, (tabs) =>
            closeSessionTab(tabs, `file:${discardTab.path}`),
          )
        }}
      />
      {isGoToFileOpen && currentProject && (
        <GoToFileDialog
          projectId={currentProject.id}
          onClose={() => setIsGoToFileOpen(false)}
          onOpenFile={(path) => {
            // Entering Dev must not restore tabs over the selected file.
            handleModeChange('dev')
            handleOpenFile(path, { pin: true })
            setIsGoToFileOpen(false)
          }}
        />
      )}
      {/* Global Command Palette (⌘K) with fully functional handlers */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        isSettings={mode === 'settings'}
        onClose={() => setIsCommandPaletteOpen(false)}
        onCommand={executeCommand}
        onSelectTab={handleCommandPaletteSelectTab}
        onRunNextTask={() => {
          handleOpenSettings(currentProject ? `project_${currentProject.id}` : 'general', 'tasks')
          void handleRunNextTask()
        }}
      />
    </div>
  )
}
