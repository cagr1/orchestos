import React, { useEffect, useRef, useState } from 'react'
import {
  archiveSession,
  attachTurnDetails,
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
  renameSession,
  restoreSession,
  runProjectTask,
  sendMessage,
} from './api/chat'
import { getProjectContext } from './api/project'
import { chooseProject, deleteProject, listProjects } from './api/projects'
import { listRuns } from './api/runs'
import { getRunnableTask, listTasks, runTask } from './api/tasks'
import { OrchestChatView } from './components/chat/OrchestChatView'
import { CommandPalette } from './components/common/CommandPalette'
import { type HistorySession, OrcaRightInspector } from './components/dev/OrcaRightInspector'
import { OrchestDevWorkspace } from './components/dev/OrchestDevWorkspace'
import { ShellHeader } from './components/layout/ShellHeader'
import { ShellSidebar } from './components/layout/ShellSidebar'
import { ShellStatusBar } from './components/layout/ShellStatusBar'
import {
  OrchestSettingsView,
  type ProjectSubTab,
  type SettingsSection,
} from './components/settings/OrchestSettingsView'
import {
  initialMockInstincts,
  initialMockMemories,
  initialMockSkills,
  initialMockSpecs,
} from './data/mockOrchestosData'
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
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState<boolean>(true)
  const [isRightInspectorOpen, setIsRightInspectorOpen] = useState<boolean>(true)

  // Projects state
  const [projects, setProjects] = useState<ProjectItem[]>([])
  const [activeProjectId, setActiveProjectId] = useState<string>('')
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null)
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
  const [taskError, setTaskError] = useState<string | null>(null)
  const [taskRunError, setTaskRunError] = useState<string | null>(null)
  const [runningTaskId, setRunningTaskId] = useState<string | null>(null)
  const [runs, setRuns] = useState<RunItem[]>([])
  const [projectContext, setProjectContext] = useState<ProjectContext | null>(null)
  const [refreshingGraph, setRefreshingGraph] = useState(false)
  const [specs, setSpecs] = useState<SpecItem[]>(initialMockSpecs)
  const [instincts, setInstincts] = useState<InstinctItem[]>(initialMockInstincts)
  const [memories, setMemories] = useState<MemoryItem[]>(initialMockMemories)
  const [threads, setThreads] = useState<ChatThread[]>([])
  const [skills, setSkills] = useState<SkillItem[]>(initialMockSkills)
  const [activeThreadId, setActiveThreadId] = useState<string>('')

  const loadThreadMessages = async (sessionId: string, projectId?: string | null) => {
    const [messagesResult, timelineResult, tasksResult] = await Promise.allSettled([
      getSessionMessages(sessionId),
      getTimeline(sessionId),
      getProjectTasks(projectId),
    ])
    if (messagesResult.status !== 'fulfilled') throw messagesResult.reason
    const rows = messagesResult.value
    const baseMessages = rows.map(mapMessage)
    if (timelineResult.status !== 'fulfilled' || tasksResult.status !== 'fulfilled')
      return baseMessages
    const detailed = attachTurnDetails(baseMessages, rows, timelineResult.value)
    const pendingTasks = new Map(
      tasksResult.value.filter((task) => task.status === 'pending').map((task) => [task.id, task]),
    )
    return detailed.map((message) => {
      const row = rows.find((candidate) => String(candidate.id) === message.id)
      if (!message.taskHeld || !row?.taskId) return message
      const task = pendingTasks.get(row.taskId)
      if (!task) return { ...message, taskHeld: false, proposedTask: undefined }
      return {
        ...message,
        proposedTask: {
          id: task.id,
          description: task.description,
          output: row.existingFiles,
        },
      }
    })
  }

  useEffect(() => {
    let disposed = false
    const visibleProjectId = activeProjectId || projects[0]?.id || null
    void listSessions(visibleProjectId)
      .then(async (loaded) => {
        if (disposed) return
        setThreads(loaded)
        setActiveThreadId(loaded[0]?.id || '')
        const hydrated = await Promise.all(
          loaded.map(async (thread) => ({
            ...thread,
            messages: await loadThreadMessages(thread.id, thread.projectId).catch(() => []),
          })),
        )
        if (!disposed) setThreads(hydrated)
      })
      .catch(() => {
        if (!disposed) setThreads([])
      })
    return () => {
      disposed = true
    }
  }, [activeProjectId, projects, mode])

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
          setActiveAgentId(rememberedAgent.id)
          setMode('dev')
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
  }, [])

  const currentProject = projects.find((p) => p.id === activeProjectId) || projects[0]
  const activeThread = threads.find((t) => t.id === activeThreadId)
  const activeAgent = currentProject?.agents.find((a) => a.id === activeAgentId) || null

  const handleSelectProject = (projectId: string) => {
    setActiveProjectId(projectId)
    localStorage.setItem('orchestos-last-project', projectId)
  }

  const reloadHistory = async () => {
    const archived = await listArchivedSessions()
    const projectNames = new Map(projects.map((project) => [project.id, project.name]))
    const loaded = await Promise.all(
      archived.map(async (session) => {
        const messages = await loadThreadMessages(session.id, session.projectId).catch(() => [])
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
  }

  useEffect(() => {
    if (projects.length) void reloadHistory().catch(() => setHistorySessions([]))
  }, [projects])

  useEffect(() => {
    if (!currentProject) {
      setRuns([])
      return
    }
    let disposed = false
    void listRuns(currentProject.id)
      .then((loaded) => {
        if (!disposed) setRuns(loaded)
      })
      .catch(() => {
        if (!disposed) setRuns([])
      })
    return () => {
      disposed = true
    }
  }, [currentProject?.id])

  useEffect(() => {
    if (!currentProject) {
      setProjectContext(null)
      return
    }
    let disposed = false
    setProjectContext(null)
    void getProjectContext(currentProject.id)
      .then((context) => {
        if (!disposed) setProjectContext(context)
      })
      .catch(() => {
        if (!disposed) setProjectContext(null)
      })
    return () => {
      disposed = true
    }
  }, [currentProject?.id])

  const refreshGraph = async () => {
    if (!currentProject || refreshingGraph) return
    setRefreshingGraph(true)
    try {
      const response = await fetch('/api/project/index', {
        method: 'POST',
        headers: { 'x-orchestos-project-id': currentProject.id },
      })
      if (!response.ok) throw new Error(`Request failed (${response.status})`)
      setProjectContext(await getProjectContext(currentProject.id))
    } finally {
      setRefreshingGraph(false)
    }
  }

  useEffect(() => {
    if (!currentProject) {
      setTasks([])
      setTaskError(null)
      return
    }
    let disposed = false
    void listTasks(currentProject.id)
      .then((result) => {
        if (disposed) return
        setTasks(result.tasks)
        setTaskError(result.error || null)
      })
      .catch((error) => {
        if (!disposed) {
          setTasks([])
          setTaskError(error instanceof Error ? error.message : String(error))
        }
      })
    return () => {
      disposed = true
    }
  }, [mode, currentProject?.id])

  const refreshUsage = async () => {
    if (!currentProject) return
    usageAbortRef.current?.abort()
    const controller = new AbortController()
    usageAbortRef.current = controller
    setRefreshingUsage(true)
    try {
      const response = await fetch('/api/session/status', {
        headers: { 'x-orchestos-project-id': currentProject.id },
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
  }

  useEffect(() => {
    if (!currentProject) return
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
  }, [currentProject?.id])

  // Mode change handler that tracks previous mode
  const handleModeChange = (newMode: AppMode) => {
    if (mode !== 'settings') {
      setPreviousMode(mode)
    }
    setMode(newMode)
  }

  const handleOpenSettings = (section?: SettingsSection, tab: ProjectSubTab = 'tasks') => {
    setPreviousMode(mode === 'settings' ? 'dev' : mode)
    setSettingsSection(section || (currentProject ? `project_${currentProject.id}` : 'general'))
    setSettingsProjectTab(tab)
    setMode('settings')
  }

  const handleOpenProjectSettings = (projectId: string) => {
    setActiveProjectId(projectId)
    handleOpenSettings(`project_${projectId}`, 'tasks')
  }

  // Agent selection and launch in Dev mode
  const handleSelectAgent = async (agentId: string, projectId: string) => {
    setActiveProjectId(projectId)
    setActiveAgentId(agentId)
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

  // Restore session from history to sidebar
  // Project creation
  const handleNewProject = async () => {
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

  const handleCloseAgent = async (agentId: string) => {
    try {
      await archiveSession(agentId)
      if (activeAgentId === agentId) setActiveAgentId(null)
      setProjects(await listProjects())
      await reloadHistory()
    } catch {
      // Keep the agent visible when the archive request fails.
    }
  }

  const handleRestoreAgent = async (session: HistorySession) => {
    try {
      await restoreSession(session.id)
      setProjects(await listProjects())
      await reloadHistory()
    } catch {
      // Keep the history entry visible when the restore request fails.
    }
  }

  const handleDeleteHistorySession = async (sessionId: string) => {
    try {
      await deleteSession(sessionId)
      await reloadHistory()
    } catch {
      // Keep the history entry visible when the delete request fails.
    }
  }

  const handleDeleteProject = async (projectId: string) => {
    try {
      await deleteProject(projectId)
      const loaded = await listProjects()
      setProjects(loaded)
      setActiveProjectId((current) => (current === projectId ? loaded[0]?.id || '' : current))
      setActiveAgentId(null)
      await reloadHistory()
    } catch {
      // Keep the project visible when the delete request fails.
    }
  }

  // Purge all project telemetry data (Danger Zone in Project Settings)
  const handlePurgeProjectData = (projectId: string) => {
    setRuns((prev) => prev.filter((r) => r.taskId && !r.taskId.startsWith(projectId)))
    setMemories((prev) => prev.filter((m) => m.scope !== 'project'))
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
    void createSession({ agent: cliId, projectId, title })
      .then(async (thread) => {
        setActiveProjectId(projectId)
        setActiveAgentId(thread.id)
        localStorage.setItem(
          'orchestos-last-dev',
          JSON.stringify({ kind: 'session', projectId, sessionId: thread.id }),
        )
        setThreads((current) => [...current.filter((item) => item.id !== thread.id), thread])
        setActiveThreadId(thread.id)
        setProjects(await listProjects())
        setMode('dev')
      })
      .catch(() => undefined)
  }

  // Chat actions
  const handleNewChat = async (
    cliId?: string,
    _model?: string,
    title?: string,
    selectedProjectId?: string | null,
  ) => {
    const agent =
      cliId === 'local' || cliId === 'claude' || cliId === 'codex' || cliId === 'opencode'
        ? cliId
        : 'api'
    try {
      const newThread = await createSession({
        agent,
        projectId: newChatProjectId(currentProject?.id, selectedProjectId),
        title,
      })
      setThreads((prev) => [newThread, ...prev])
      setActiveThreadId(newThread.id)
    } catch {
      return
    }
    setMode('chat')
  }

  const handleDeleteChat = async (id: string) => {
    try {
      await deleteSession(id)
      setThreads((prev) => {
        const remaining = prev.filter((thread) => thread.id !== id)
        if (activeThreadId === id) setActiveThreadId(remaining[0]?.id || '')
        return remaining
      })
    } catch {
      // Keep the server-backed row visible when the API rejects the mutation.
    }
  }

  const handleRenameChat = async (id: string) => {
    const thread = threads.find((item) => item.id === id)
    const title = window.prompt('Rename conversation', thread?.title || '')
    if (!title?.trim()) return
    try {
      const updated = await renameSession(id, title.trim())
      setThreads((prev) =>
        prev.map((item) => (item.id === id ? { ...item, title: updated.title } : item)),
      )
    } catch {
      // Keep the current title when validation or the request fails.
    }
  }

  const handleSlashCommand = async (command: string, argument?: string) => {
    const id = activeThreadId
    if (!id) return
    if (command === '/rename') {
      const title = argument?.trim() || window.prompt('Rename conversation', '')
      if (title?.trim()) {
        const updated = await renameSession(id, title.trim())
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

  const handleSendMessage = async (
    content: string,
    attachments?: ChatAttachment[],
    agent?: string,
    model?: string,
    effort?: string,
  ) => {
    let threadId = activeThreadId
    let thread = threads.find((item) => item.id === threadId)
    if (!threadId) {
      try {
        thread = await createSession({ agent: 'api', projectId: null })
        threadId = thread.id
        setThreads((prev) => [thread!, ...prev])
        setActiveThreadId(thread.id)
      } catch {
        return
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
    setThreads((prev) =>
      prev.map((thread) =>
        thread.id === threadId ? { ...thread, messages: [...thread.messages, optimistic] } : thread,
      ),
    )
    void sendMessage({
      sessionId: threadId,
      message: content,
      agent: agent || thread?.agent,
      model,
      effort,
      attachments,
    })
      .then(async () => {
        const messages = await loadThreadMessages(threadId, thread?.projectId)
        const firstMessageTitle =
          thread?.messages.length === 0
            ? `${agent === 'claude' ? 'Claude' : agent === 'codex' ? 'Codex' : agent === 'opencode' ? 'OpenCode' : 'ChatGPT'}: ${content.slice(0, 40)}`
            : undefined
        if (firstMessageTitle)
          await renameSession(threadId, firstMessageTitle).catch(() => undefined)
        if (firstMessageTitle) setProjects(await listProjects())
        setThreads((prev) =>
          prev.map((thread) =>
            thread.id === threadId
              ? {
                  ...thread,
                  messages,
                  title: firstMessageTitle || thread.title,
                }
              : thread,
          ),
        )
      })
      .catch(() => undefined)
  }

  const handleApproveHeldTask = async (taskId: string) => {
    const thread = activeThread
    if (!thread) return
    await runProjectTask(taskId, thread.projectId, () => {
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
    if (thread) {
      const messages = await loadThreadMessages(thread.id, thread.projectId)
      setThreads((prev) =>
        prev.map((item) => (item.id === thread.id ? { ...item, messages } : item)),
      )
    }
  }

  const handleRunNextTask = async () => {
    if (!currentProject || runningTaskId) return
    const nextTask = getRunnableTask(tasks)
    if (!nextTask) return
    setTaskRunError(null)
    setRunningTaskId(nextTask.id)
    try {
      await runTask(nextTask.id, currentProject.id, (loaded) => {
        setTasks(loaded)
        setTaskError(null)
      })
      setRuns(await listRuns(currentProject.id))
    } catch (error) {
      setTaskRunError(error instanceof Error ? error.message : String(error))
      await listTasks(currentProject.id)
        .then((result) => {
          setTasks(result.tasks)
          setTaskError(result.error || null)
        })
        .catch(() => undefined)
    } finally {
      setRunningTaskId(null)
    }
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
                  ? { ...message, taskHeld: false, proposedTask: undefined }
                  : message,
              ),
            }
          : item,
      ),
    )
    const messages = await loadThreadMessages(thread.id, thread.projectId)
    setThreads((prev) => prev.map((item) => (item.id === thread.id ? { ...item, messages } : item)))
  }

  // Spec handlers
  const handleApproveSpec = (specId: string) => {
    setSpecs((prev) =>
      prev.map((s) => (s.id === specId ? { ...s, status: 'approved' as const } : s)),
    )
  }

  const handleDraftSpec = (taskId: string) => {
    const newSpec: SpecItem = {
      id: `spec_${Date.now()}`,
      taskId,
      title: `Drafted Specification for ${taskId}`,
      status: 'draft',
      clarify: 'none',
      lintStatus: 'pass',
      lintFindings: 0,
      deltaIssues: 0,
      criteria: [
        { when: 'Task execution begins', then: 'Sandbox worktree isolation is active' },
        { when: 'Build tests are triggered', then: 'All deterministic checks exit with 0' },
      ],
      createdAt: 'Just now',
    }
    setSpecs((prev) => [newSpec, ...prev])
  }

  // Memory handlers
  const handleForgetMemory = (id: string) => {
    setMemories((prev) => prev.filter((m) => m.id !== id))
  }

  const handleRecordMemory = (content: string, type: 'semantic' | 'procedural' | 'episodic') => {
    const newMem: MemoryItem = {
      id: `mem_${Date.now()}`,
      topicKey: `user_${type}_note`,
      scope: 'project',
      content,
      updatedAt: 'Just now',
    }
    setMemories((prev) => [newMem, ...prev])
  }

  // Skill handlers
  const handleToggleSkill = (id: string) => {
    setSkills((prev) => prev.map((s) => (s.id === id ? { ...s, usageRuns: s.usageRuns + 1 } : s)))
  }

  // Instinct handlers
  const handleTeachInstinct = (when: string, then: string) => {
    const newInstinct: InstinctItem = {
      id: `inst_${Date.now()}`,
      trigger: when,
      action: then,
      confidence: 0.95,
      source: 'manual',
      verified: true,
      usagesCount: 1,
      createdAt: 'Just now',
    }
    setInstincts((prev) => [newInstinct, ...prev])
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
      handleOpenSettings('projects', targetTab)
    }
  }

  const handleCommandPaletteSelectModel = (modelName: string) => {
    // Apply selected model across active chat thread
    setThreads((prev) =>
      prev.map((t) => (t.id === activeThreadId ? { ...t, agent: modelName } : t)),
    )
  }

  return (
    <div
      data-theme={theme}
      className="h-screen w-screen flex flex-col bg-app-bg text-app font-sans overflow-hidden select-none"
    >
      {projectError && (
        <div
          role="alert"
          className="fixed right-4 top-12 z-[60] max-w-sm rounded-control border border-app-error/60 bg-app-surface px-3 py-2 text-xs text-app shadow-2xl"
        >
          {projectError}
        </div>
      )}
      {/* Top Shell Header with single panel toggle and clean breadcrumb (status pill removed as requested) */}
      <ShellHeader
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onToggleLeftSidebar={
          mode !== 'settings' ? () => setIsLeftSidebarOpen(!isLeftSidebarOpen) : undefined
        }
        onToggleRightInspector={
          mode === 'dev' ? () => setIsRightInspectorOpen(!isRightInspectorOpen) : undefined
        }
        isRightInspectorOpen={isRightInspectorOpen}
        activeProjectName={currentProject?.name}
        activeBranch={currentProject?.branch}
      />

      {/* Main App Workspace Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: ONLY shown in Chat and Dev modes (Hidden in Settings for full-screen mode, Requirement 7) */}
        {mode !== 'settings' && isLeftSidebarOpen && (
          <ShellSidebar
            mode={mode}
            onChangeMode={handleModeChange}
            threads={threads}
            activeThreadId={activeThreadId}
            onSelectThread={setActiveThreadId}
            onNewChat={handleNewChat}
            onDeleteChat={handleDeleteChat}
            projects={projects}
            activeProjectId={activeProjectId}
            onSelectProject={handleSelectProject}
            onNewProject={() => {
              void handleNewProject()
            }}
            onOpenSettings={() => handleOpenSettings(undefined, 'tasks')}
            onOpenProjectSettings={handleOpenProjectSettings}
            activeAgentId={activeAgentId}
            onSelectAgent={handleSelectAgent}
            onCloseAgent={handleCloseAgent}
            onDeleteProject={handleDeleteProject}
            onCreateAgentInProject={handleCreateAgentInProject}
          />
        )}

        {/* Center Canvas / Views */}
        <div className="flex-1 flex overflow-hidden">
          {/* VIEW 1: CHAT */}
          {mode === 'chat' && (
            <OrchestChatView
              thread={activeThread}
              onSendMessage={handleSendMessage}
              onApproveHeldTask={handleApproveHeldTask}
              onRejectHeldTask={handleRejectHeldTask}
              sessionStatus={sessionStatus}
              onSlashCommand={handleSlashCommand}
            />
          )}

          {/* VIEW 2: DEV WORKSPACE */}
          {mode === 'dev' && (
            <OrchestDevWorkspace
              activeProject={currentProject}
              activeAgent={activeAgent}
              onCloseAgent={handleCloseAgent}
              onSendMessage={handleSendMessage}
              sessionStatus={sessionStatus}
              onSlashCommand={handleSlashCommand}
            />
          )}

          {/* VIEW 3: SETTINGS (Full screen mode without sidebar, hosts project tasks, runs, specs, etc.) */}
          {mode === 'settings' && (
            <OrchestSettingsView
              onBackToApp={() => setMode(previousMode || 'dev')}
              projects={projects}
              activeProjectId={activeProjectId}
              onSelectProject={handleSelectProject}
              currentTheme={theme}
              onSelectTheme={setTheme}
              language={language}
              onSelectLanguage={setLanguage}
              initialSection={settingsSection}
              initialProjectTab={settingsProjectTab}
              tasks={tasks}
              taskError={taskError || taskRunError}
              runs={runs}
              projectContext={projectContext}
              onRefreshGraph={() => void refreshGraph()}
              graphRefreshing={refreshingGraph}
              specs={specs}
              memories={memories}
              skills={skills}
              instincts={instincts}
              onApproveSpec={handleApproveSpec}
              onDraftSpec={handleDraftSpec}
              onForgetMemory={handleForgetMemory}
              onRecordMemory={handleRecordMemory}
              onToggleSkill={handleToggleSkill}
              onTeachInstinct={handleTeachInstinct}
              onPurgeProjectData={handlePurgeProjectData}
              onResetOrchestos={handleResetOrchestos}
              onOpenChat={() => setMode('chat')}
              onRunNextTask={() => void handleRunNextTask()}
              canRunNextTask={Boolean(getRunnableTask(tasks)) && !runningTaskId}
            />
          )}
        </div>

        {/* Right Inspector: ONLY available in Dev mode, toggleable via top header button */}
        {mode === 'dev' && isRightInspectorOpen && currentProject && (
          <OrcaRightInspector
            currentProject={currentProject}
            projects={projects}
            recentRuns={runs}
            historySessions={historySessions}
            onRestoreAgentToSidebar={handleRestoreAgent}
            onDeleteHistorySession={handleDeleteHistorySession}
          />
        )}
      </div>
      <ShellStatusBar
        status={sessionStatus}
        refreshing={refreshingUsage}
        onRefresh={() => void refreshUsage()}
      />
      {/* Global Command Palette (⌘K) with fully functional handlers */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onSelectTab={handleCommandPaletteSelectTab}
        onSelectModel={handleCommandPaletteSelectModel}
        onRunNextTask={() => {
          handleOpenSettings('projects', 'tasks')
          void handleRunNextTask()
        }}
      />
    </div>
  )
}
