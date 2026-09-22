import React, { useEffect, useState } from 'react';
import { ShellHeader } from './components/layout/ShellHeader';
import { ShellSidebar } from './components/layout/ShellSidebar';
import { CommandPalette } from './components/common/CommandPalette';
import { OrchestChatView } from './components/chat/OrchestChatView';
import { OrchestDevWorkspace } from './components/dev/OrchestDevWorkspace';
import {
  OrchestSettingsView,
  SettingsSection,
  ProjectSubTab,
} from './components/settings/OrchestSettingsView';
import { HistorySession, OrcaRightInspector } from './components/dev/OrcaRightInspector';
import {
  initialMockTasks,
  initialMockSpecs,
  initialMockInstincts,
  initialMockMemories,
  initialMockSkills,
} from './data/mockOrchestosData';
import {
  createSession,
  deleteSession,
  getSessionMessages,
  listSessions,
  mapMessage,
  listArchivedSessions,
  archiveSession,
  restoreSession,
  renameSession,
  sendMessage,
} from './api/chat';
import { SessionStatusBar } from './components/layout/SessionStatusBar';
import { deleteProject, listProjects, chooseProject } from './api/projects';
import { listRuns } from './api/runs';
import {
  TaskItem,
  RunItem,
  SpecItem,
  InstinctItem,
  MemoryItem,
  ChatThread,
  SkillItem,
  AppMode,
  ProjectItem,
  ChatAttachment,
  NavigationTab,
} from './types/orchestos';

export default function App() {
  const [theme, setTheme] = useState<string>(() => {
    try { return localStorage.getItem('orchestos-theme') || 'orchestos'; } catch { return 'orchestos'; }
  });
  const [mode, setMode] = useState<AppMode>('chat');
  const [previousMode, setPreviousMode] = useState<AppMode>('chat');

  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState<boolean>(true);
  const [isRightInspectorOpen, setIsRightInspectorOpen] = useState<boolean>(true);

  // Projects state
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string>('');
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null);
  const [historySessions, setHistorySessions] = useState<HistorySession[]>([]);

  // Settings deep-link state
  const [settingsSection, setSettingsSection] = useState<SettingsSection>('project_orchestos');
  const [settingsProjectTab, setSettingsProjectTab] = useState<ProjectSubTab>('tasks');
  const [language, setLanguage] = useState<'en' | 'es'>(() => {
    try { return (localStorage.getItem('orchestos-language') as 'en' | 'es' | null) || 'en'; } catch { return 'en'; }
  });

  useEffect(() => { localStorage.setItem('orchestos-theme', theme); }, [theme]);
  useEffect(() => { localStorage.setItem('orchestos-language', language); }, [language]);

  // Core OrchestOS entities state
  const [tasks, setTasks] = useState<TaskItem[]>(initialMockTasks);
  const [runs, setRuns] = useState<RunItem[]>([]);
  const [specs, setSpecs] = useState<SpecItem[]>(initialMockSpecs);
  const [instincts, setInstincts] = useState<InstinctItem[]>(initialMockInstincts);
  const [memories, setMemories] = useState<MemoryItem[]>(initialMockMemories);
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [skills, setSkills] = useState<SkillItem[]>(initialMockSkills);
  const [activeThreadId, setActiveThreadId] = useState<string>('');

  useEffect(() => {
    let disposed = false;
    void listSessions().then(async (loaded) => {
      if (disposed) return;
      setThreads(loaded);
      setActiveThreadId(loaded[0]?.id || '');
      const hydrated = await Promise.all(loaded.map(async (thread) => ({
        ...thread,
        messages: (await getSessionMessages(thread.id)).map(mapMessage),
      })));
      if (!disposed) setThreads(hydrated);
    }).catch(() => {
      if (!disposed) setThreads([]);
    });
    return () => { disposed = true; };
  }, []);

  useEffect(() => {
    let disposed = false;
    void listProjects().then((loaded) => {
      if (disposed) return;
      setProjects(loaded);
      const remembered = (() => {
        try { return JSON.parse(localStorage.getItem('orchestos-last-dev') || 'null') as { projectId?: string; sessionId?: string } | null; } catch { return null; }
      })();
      const rememberedProject = remembered?.projectId && loaded.find((project) => project.id === remembered.projectId);
      const rememberedAgent = rememberedProject?.agents.find((agent) => agent.id === remembered?.sessionId);
      setActiveProjectId((current) => current && loaded.some((project) => project.id === current) ? current : rememberedProject?.id || loaded[0]?.id || '');
      if (rememberedProject && rememberedAgent) {
        setActiveAgentId(rememberedAgent.id);
        setMode('dev');
        void listSessions(rememberedProject.id).then(async (sessions) => {
          const session = sessions.find((item) => item.id === rememberedAgent.id);
          if (!session) return;
          const hydrated = { ...session, messages: (await getSessionMessages(session.id)).map(mapMessage) };
          setThreads((current) => [...current.filter((item) => item.id !== hydrated.id), hydrated]);
        });
      }
    }).catch(() => { if (!disposed) setProjects([]); });
    return () => { disposed = true; };
  }, []);

  const currentProject = projects.find((p) => p.id === activeProjectId) || projects[0];
  const activeThread = threads.find((t) => t.id === activeThreadId);
  const activeAgent = currentProject?.agents.find((a) => a.id === activeAgentId) || null;

  const reloadHistory = async () => {
    const archived = await listArchivedSessions();
    const projectNames = new Map(projects.map((project) => [project.id, project.name]));
    const loaded = await Promise.all(archived.map(async (session) => {
      const messages = await getSessionMessages(session.id).catch(() => []);
      const last = messages[messages.length - 1];
      const elapsed = Math.max(0, Date.now() - Date.parse(session.updatedAt));
      const minutes = Math.floor(elapsed / 60000);
      const timeAgo = minutes < 60 ? `${minutes}m` : minutes < 2880 ? `${Math.floor(minutes / 60)}h` : `${Math.floor(minutes / 1440)}d`;
      return {
        id: session.id,
        projectId: session.projectId || 'workspace',
        projectName: session.projectId ? projectNames.get(session.projectId) || 'Unknown project' : 'Workspace',
        title: session.title,
        lastMessage: last?.content?.split(/\r?\n/).filter(Boolean).pop() || 'No messages',
        cliId: session.agent,
        model: last?.model || session.agent,
        messageCount: messages.length,
        timeAgo,
        logs: messages.map((message) => `${message.role}: ${message.content}`).slice(-8),
      } satisfies HistorySession;
    }));
    setHistorySessions(loaded);
  };

  useEffect(() => {
    if (projects.length) void reloadHistory().catch(() => setHistorySessions([]));
  }, [projects]);

  useEffect(() => {
    if (!currentProject) { setRuns([]); return; }
    let disposed = false;
    void listRuns(currentProject.id).then((loaded) => { if (!disposed) setRuns(loaded); }).catch(() => { if (!disposed) setRuns([]); });
    return () => { disposed = true; };
  }, [currentProject?.id]);

  // Mode change handler that tracks previous mode
  const handleModeChange = (newMode: AppMode) => {
    if (mode !== 'settings') {
      setPreviousMode(mode);
    }
    setMode(newMode);
  };

  const handleOpenSettings = (section: SettingsSection = 'project_orchestos', tab: ProjectSubTab = 'tasks') => {
    setPreviousMode(mode === 'settings' ? 'dev' : mode);
    setSettingsSection(section);
    setSettingsProjectTab(tab);
    setMode('settings');
  };

  const handleOpenProjectSettings = (projectId: string) => {
    setActiveProjectId(projectId);
    handleOpenSettings(`project_${projectId}`, 'tasks');
  };

  // Agent selection and launch in Dev mode
  const handleSelectAgent = async (agentId: string, projectId: string) => {
    setActiveProjectId(projectId);
    setActiveAgentId(agentId);
    localStorage.setItem('orchestos-last-dev', JSON.stringify({ kind: 'session', projectId, sessionId: agentId }));
    const session = (await listSessions(projectId)).find((item) => item.id === agentId);
    if (session) {
      const hydrated = { ...session, messages: (await getSessionMessages(agentId)).map(mapMessage) };
      setThreads((current) => [...current.filter((item) => item.id !== agentId), hydrated]);
      setActiveThreadId(agentId);
    }
    setMode('dev');
  };

  // Restore session from history to sidebar
  // Project creation
  const handleNewProject = async () => {
    try {
      const project = await chooseProject();
      if (!project) return;
      const loaded = await listProjects();
      setProjects(loaded);
      setActiveProjectId(project.id);
    } catch {
      // Native selector errors stay local to the selector; no fake project is added.
    }
  };

  const handleCloseAgent = async (agentId: string) => {
    try {
      await archiveSession(agentId);
      if (activeAgentId === agentId) setActiveAgentId(null);
      setProjects(await listProjects());
      await reloadHistory();
    } catch {
      // Keep the agent visible when the archive request fails.
    }
  };

  const handleRestoreAgent = async (session: HistorySession) => {
    try {
      await restoreSession(session.id);
      setProjects(await listProjects());
      await reloadHistory();
    } catch {
      // Keep the history entry visible when the restore request fails.
    }
  };

  const handleDeleteHistorySession = async (sessionId: string) => {
    try {
      await deleteSession(sessionId);
      await reloadHistory();
    } catch {
      // Keep the history entry visible when the delete request fails.
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    try {
      await deleteProject(projectId);
      const loaded = await listProjects();
      setProjects(loaded);
      setActiveProjectId((current) => current === projectId ? (loaded[0]?.id || '') : current);
      setActiveAgentId(null);
      await reloadHistory();
    } catch {
      // Keep the project visible when the delete request fails.
    }
  };

  // Purge all project telemetry data (Danger Zone in Project Settings)
  const handlePurgeProjectData = (projectId: string) => {
    setRuns((prev) => prev.filter((r) => r.taskId && !r.taskId.startsWith(projectId)));
    setMemories((prev) => prev.filter((m) => m.scope !== 'project'));
  };

  // Danger Zone - Reset OrchestOS
  const handleResetOrchestos = () => {
    setRuns([]);
    setInstincts((prev) => prev.filter((i) => i.verified));
    setTasks((prev) =>
      prev.map((t) => ({ ...t, status: 'pending', retryCount: 0, qaVerdict: undefined }))
    );
  };

  // Create new agent in project (triggered by Plus on project row)
  const handleCreateAgentInProject = (
    projectId: string,
    cliId: string,
    model: string,
    title: string
  ) => {
    void createSession({ agent: cliId, projectId, title }).then(async (thread) => {
      setActiveProjectId(projectId);
      setActiveAgentId(thread.id);
      localStorage.setItem('orchestos-last-dev', JSON.stringify({ kind: 'session', projectId, sessionId: thread.id }));
      setThreads((current) => [...current.filter((item) => item.id !== thread.id), thread]);
      setActiveThreadId(thread.id);
      setProjects(await listProjects());
      setMode('dev');
    }).catch(() => undefined);
  };

  // Chat actions
  const handleNewChat = async (cliId?: string, _model?: string, title?: string) => {
    const agent = cliId === 'local' || cliId === 'claude' || cliId === 'codex' || cliId === 'opencode' ? cliId : 'api';
    try {
      const newThread = await createSession({ agent, title });
      setThreads((prev) => [newThread, ...prev]);
      setActiveThreadId(newThread.id);
    } catch {
      return;
    }
    setMode('chat');
  };

  const handleDeleteChat = async (id: string) => {
    try {
      await deleteSession(id);
      setThreads((prev) => {
        const remaining = prev.filter((thread) => thread.id !== id);
        if (activeThreadId === id) setActiveThreadId(remaining[0]?.id || '');
        return remaining;
      });
    } catch {
      // Keep the server-backed row visible when the API rejects the mutation.
    }
  };

  const handleRenameChat = async (id: string) => {
    const thread = threads.find((item) => item.id === id);
    const title = window.prompt('Rename conversation', thread?.title || '');
    if (!title?.trim()) return;
    try {
      const updated = await renameSession(id, title.trim());
      setThreads((prev) => prev.map((item) => item.id === id ? { ...item, title: updated.title } : item));
    } catch {
      // Keep the current title when validation or the request fails.
    }
  };

  const handleSendMessage = async (
    content: string,
    attachments?: ChatAttachment[],
    agent?: string,
    model?: string,
    effort?: string
  ) => {
    let threadId = activeThreadId;
    let thread = threads.find((item) => item.id === threadId);
    if (!threadId) {
      try {
        thread = await createSession({ agent: 'api', projectId: null });
        threadId = thread.id;
        setThreads((prev) => [thread!, ...prev]);
        setActiveThreadId(thread.id);
      } catch {
        return;
      }
    }
    const activeModel = model || undefined;
    const optimistic = {
      id: `pending_${Date.now()}`,
      role: 'user' as const,
      content,
      timestamp: 'Just now',
      attachments,
      model: activeModel,
      effort,
    };
    setThreads((prev) => prev.map((thread) => thread.id === threadId
      ? { ...thread, messages: [...thread.messages, optimistic] }
      : thread));
    void sendMessage({ sessionId: threadId, message: content, agent: thread?.agent, model, effort, attachments })
      .then(async () => {
        const rows = await getSessionMessages(threadId);
        setThreads((prev) => prev.map((thread) => thread.id === threadId
          ? { ...thread, messages: rows.map(mapMessage), title: thread.messages.length === 0 ? content.slice(0, 32) : thread.title }
          : thread));
      })
      .catch(() => undefined);
  };

  const handleApproveHeldTask = (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: 'running' as const } : t))
    );
  };

  const handleRejectHeldTask = (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: 'blocked' as const } : t))
    );
  };

  // Spec handlers
  const handleApproveSpec = (specId: string) => {
    setSpecs((prev) =>
      prev.map((s) => (s.id === specId ? { ...s, status: 'approved' as const } : s))
    );
  };

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
    };
    setSpecs((prev) => [newSpec, ...prev]);
  };

  // Memory handlers
  const handleForgetMemory = (id: string) => {
    setMemories((prev) => prev.filter((m) => m.id !== id));
  };

  const handleRecordMemory = (content: string, type: 'semantic' | 'procedural' | 'episodic') => {
    const newMem: MemoryItem = {
      id: `mem_${Date.now()}`,
      topicKey: `user_${type}_note`,
      scope: 'project',
      content,
      updatedAt: 'Just now',
    };
    setMemories((prev) => [newMem, ...prev]);
  };

  // Skill handlers
  const handleToggleSkill = (id: string) => {
    setSkills((prev) =>
      prev.map((s) => (s.id === id ? { ...s, usageRuns: s.usageRuns + 1 } : s))
    );
  };

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
    };
    setInstincts((prev) => [newInstinct, ...prev]);
  };

  // Command Palette Handlers (Requirement 9)
  const handleCommandPaletteSelectTab = (tab: NavigationTab) => {
    if (tab === 'threads') {
      setMode('chat');
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
      };
      const targetTab = validSubTabs[tab] || 'tasks';
      handleOpenSettings('projects', targetTab);
    }
  };

  const handleCommandPaletteSelectModel = (modelName: string) => {
    // Apply selected model across active chat thread
    setThreads((prev) =>
      prev.map((t) => (t.id === activeThreadId ? { ...t, agent: modelName } : t))
    );
  };

  return (
    <div
      data-theme={theme}
      className="h-screen w-screen flex flex-col bg-app-bg text-app font-sans overflow-hidden select-none"
    >
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
            onSelectProject={setActiveProjectId}
            onNewProject={() => { void handleNewProject(); }}
            onOpenSettings={() => handleOpenSettings('projects', 'tasks')}
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
            />
          )}

          {/* VIEW 2: DEV WORKSPACE */}
          {mode === 'dev' && (
            <OrchestDevWorkspace
              activeProject={currentProject}
              activeAgent={activeAgent}
              onCloseAgent={handleCloseAgent}
            />
          )}

          {/* VIEW 3: SETTINGS (Full screen mode without sidebar, hosts project tasks, runs, specs, etc.) */}
          {mode === 'settings' && (
            <OrchestSettingsView
              onBackToApp={() => setMode(previousMode || 'dev')}
              projects={projects}
              activeProjectId={activeProjectId}
              onSelectProject={setActiveProjectId}
              currentTheme={theme}
              onSelectTheme={setTheme}
              language={language}
              onSelectLanguage={setLanguage}
              initialSection={settingsSection}
              initialProjectTab={settingsProjectTab}
              tasks={tasks}
              runs={runs}
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
      <SessionStatusBar />

      {/* Global Command Palette (⌘K) with fully functional handlers */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onSelectTab={handleCommandPaletteSelectTab}
        onSelectModel={handleCommandPaletteSelectModel}
        onRunNextTask={() => {
          const firstPending = tasks.find((t) => t.status === 'pending');
          if (firstPending) {
            handleOpenSettings('projects', 'tasks');
          }
        }}
      />
    </div>
  );
}
