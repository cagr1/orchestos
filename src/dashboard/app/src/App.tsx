import React, { useState } from 'react';
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
import { OrcaRightInspector, HistorySession } from './components/dev/OrcaRightInspector';
import {
  initialMockTasks,
  initialMockRuns,
  initialMockSpecs,
  initialMockInstincts,
  initialMockMemories,
  initialMockThreads,
  initialMockSkills,
} from './data/mockOrchestosData';
import { INITIAL_PROJECTS } from './data/orcaProjectData';
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

const INITIAL_HISTORY: HistorySession[] = [
  {
    id: 'hist_1',
    projectId: 'orchestos',
    projectName: 'orchestos',
    title: 'AST worktree sandbox isolation check',
    lastMessage: 'Verified 0 boundary violations across 48 module imports.',
    cliId: 'claude',
    model: 'Claude 3.7 Sonnet',
    messageCount: 14,
    timeAgo: '18m ago',
    logs: [
      '[contract] Initialized worktree refs/orchestos/sandbox-t3',
      '[ast] Parsed dependency graph: 142 source files',
      '[qa] Deterministic check: tsc && vitest passed',
    ],
  },
  {
    id: 'hist_2',
    projectId: 'orchestos',
    projectName: 'orchestos',
    title: 'Refactor tasks.yaml acceptance criteria schema',
    lastMessage: 'Exported JSONSchema validator with dual approval gates.',
    cliId: 'codex',
    model: 'gpt-5.6-codex',
    messageCount: 8,
    timeAgo: '2h ago',
    logs: [
      '[exec] Updated tasks/tasks.yaml with WHEN/THEN syntax',
      '[runner] vitest run test/schema.test.ts: 5 passed',
    ],
  },
  {
    id: 'hist_3',
    projectId: 'memories_md',
    projectName: 'memories_md',
    title: 'Vector embedding sync for semantic instincts',
    lastMessage: 'Generated 256-dim embeddings via local sqlite-vss.',
    cliId: 'gemini',
    model: 'Gemini 2.5 Pro',
    messageCount: 22,
    timeAgo: '1d ago',
    logs: [
      '[embed] Processed 14 instinct rules',
      '[db] Synced vector tables in SQLite',
    ],
  },
];

export default function App() {
  const [theme, setTheme] = useState<string>('orchestos');
  const [mode, setMode] = useState<AppMode>('chat');
  const [previousMode, setPreviousMode] = useState<AppMode>('chat');

  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState<boolean>(true);
  const [isRightInspectorOpen, setIsRightInspectorOpen] = useState<boolean>(true);

  // Projects state
  const [projects, setProjects] = useState<ProjectItem[]>(INITIAL_PROJECTS);
  const [activeProjectId, setActiveProjectId] = useState<string>('orchestos');
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null);

  // History state for Right Inspector
  const [historySessions, setHistorySessions] = useState<HistorySession[]>(INITIAL_HISTORY);

  // Settings deep-link state
  const [settingsSection, setSettingsSection] = useState<SettingsSection>('project_orchestos');
  const [settingsProjectTab, setSettingsProjectTab] = useState<ProjectSubTab>('tasks');
  const [language, setLanguage] = useState<'en' | 'es'>('en');

  // Core OrchestOS entities state
  const [tasks, setTasks] = useState<TaskItem[]>(initialMockTasks);
  const [runs, setRuns] = useState<RunItem[]>(initialMockRuns);
  const [specs, setSpecs] = useState<SpecItem[]>(initialMockSpecs);
  const [instincts, setInstincts] = useState<InstinctItem[]>(initialMockInstincts);
  const [memories, setMemories] = useState<MemoryItem[]>(initialMockMemories);
  const [threads, setThreads] = useState<ChatThread[]>(initialMockThreads);
  const [skills, setSkills] = useState<SkillItem[]>(initialMockSkills);
  const [activeThreadId, setActiveThreadId] = useState<string>(initialMockThreads[0].id);

  const currentProject = projects.find((p) => p.id === activeProjectId) || projects[0];
  const activeThread = threads.find((t) => t.id === activeThreadId) || threads[0];
  const activeAgent = currentProject.agents.find((a) => a.id === activeAgentId) || null;

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
  const handleSelectAgent = (agentId: string, projectId: string) => {
    setActiveProjectId(projectId);
    setActiveAgentId(agentId);
    setMode('dev');
  };

  // Close agent: remove from sidebar and archive to history (Requirement 4)
  const handleCloseAgent = (agentId: string, projectId: string) => {
    const proj = projects.find((p) => p.id === projectId);
    const agent = proj?.agents.find((a) => a.id === agentId);

    if (agent && proj) {
      const newHistoryItem: HistorySession = {
        id: `hist_${Date.now()}`,
        projectId: proj.id,
        projectName: proj.name,
        title: agent.name,
        lastMessage: agent.lastLog || 'Session closed and archived to history.',
        cliId: agent.model.includes('Claude') ? 'claude' : agent.model.includes('codex') ? 'codex' : 'gemini',
        model: agent.model,
        messageCount: agent.shellCommandsCount + 4,
        timeAgo: 'Just now',
        logs: [
          `[session] Archived agent ${agent.id} (${agent.name})`,
          `[status] Final status: ${agent.status}`,
          `[exec] Duration: ${agent.duration}`,
        ],
      };

      setHistorySessions((prev) => [newHistoryItem, ...prev]);

      // Remove from project agents
      setProjects((prev) =>
        prev.map((p) =>
          p.id === projectId
            ? { ...p, agents: p.agents.filter((a) => a.id !== agentId) }
            : p
        )
      );

      if (activeAgentId === agentId) {
        setActiveAgentId(null);
      }
    }
  };

  // Restore session from history to sidebar
  const handleRestoreAgentToSidebar = (session: HistorySession) => {
    setProjects((prev) =>
      prev.map((p) => {
        if (p.id === session.projectId) {
          const restoredAgent = {
            id: `ag_restored_${Date.now()}`,
            name: session.title,
            model: session.model,
            duration: '0m',
            status: 'idle' as const,
            shellCommandsCount: 0,
            filesCount: 1,
            lastLog: 'Restored from history.',
            branch: p.branch,
          };
          return { ...p, agents: [restoredAgent, ...p.agents] };
        }
        return p;
      })
    );
    setHistorySessions((prev) => prev.filter((h) => h.id !== session.id));
  };

  const handleDeleteHistorySession = (sessionId: string) => {
    setHistorySessions((prev) => prev.filter((h) => h.id !== sessionId));
  };

  // Project creation
  const handleNewProject = (name: string, branch = 'main') => {
    const newId = name.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    const newProject: ProjectItem = {
      id: newId,
      name: name,
      branch: branch,
      path: `~/workspace/${name}`,
      filesCount: 12,
      agents: [],
    };
    setProjects((prev) => [...prev, newProject]);
    setActiveProjectId(newId);
  };

  // Delete project from workspace (does not delete folder)
  const handleDeleteProject = (projectId: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== projectId));
    if (activeProjectId === projectId) {
      const remaining = projects.filter((p) => p.id !== projectId);
      setActiveProjectId(remaining[0]?.id || 'orchestos');
      setActiveAgentId(null);
    }
  };

  // Purge all project telemetry data (Danger Zone in Project Settings)
  const handlePurgeProjectData = (projectId: string) => {
    setRuns((prev) => prev.filter((r) => r.taskId && !r.taskId.startsWith(projectId)));
    setMemories((prev) => prev.filter((m) => m.scope !== 'project'));
    setHistorySessions((prev) => prev.filter((h) => h.projectId !== projectId));
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
    const newAgent = {
      id: `ag_${Date.now()}`,
      name: title,
      model: model,
      duration: '0m',
      status: 'active' as const,
      shellCommandsCount: 0,
      filesCount: 0,
      lastLog: `Agent started with ${model}`,
      branch: 'main',
    };

    setProjects((prev) =>
      prev.map((p) => (p.id === projectId ? { ...p, agents: [newAgent, ...p.agents] } : p))
    );
    setActiveProjectId(projectId);
    setActiveAgentId(newAgent.id);
    setMode('dev');
  };

  // Chat actions
  const handleNewChat = (cliId?: string, model?: string, title?: string) => {
    const newId = `thread_${Date.now()}`;
    const defaultModel =
      cliId === 'codex'
        ? 'gpt-5.6-codex'
        : cliId === 'opencode'
        ? 'deepseek-v3'
        : cliId === 'gemini'
        ? 'Gemini 2.5 Pro'
        : 'Claude 3.7 Sonnet';
    const chosenModel = model || defaultModel;
    const newThread: ChatThread = {
      id: newId,
      title: title || 'New conversation',
      agent: chosenModel,
      mode: 'orchestrator',
      status: 'active',
      createdAt: 'Just now',
      updatedAt: 'Just now',
      tokenCount: 0,
      costUsd: 0,
      messages: [],
    };
    setThreads((prev) => [newThread, ...prev]);
    setActiveThreadId(newId);
    setMode('chat');
  };

  const handleDeleteChat = (id: string) => {
    setThreads((prev) => prev.filter((t) => t.id !== id));
    if (activeThreadId === id) {
      const remaining = threads.filter((t) => t.id !== id);
      if (remaining.length > 0) {
        setActiveThreadId(remaining[0].id);
      }
    }
  };

  const handleSendMessage = (
    content: string,
    attachments?: ChatAttachment[],
    agent?: string,
    model?: string,
    effort?: string
  ) => {
    const activeModel = model || agent || 'Claude 3.7 Sonnet';
    const userMessage = {
      id: `msg_${Date.now()}`,
      role: 'user' as const,
      content,
      timestamp: 'Just now',
      attachments,
      model: activeModel,
      effort,
    };

    setThreads((prev) =>
      prev.map((t) => {
        if (t.id === activeThreadId) {
          const updatedMessages = [...t.messages, userMessage];
          const newTitle =
            t.messages.length === 0 ? content.slice(0, 32) + (content.length > 32 ? '...' : '') : t.title;
          return { ...t, title: newTitle, messages: updatedMessages };
        }
        return t;
      })
    );

    // Simulated agent response
    setTimeout(() => {
      const assistantMessage = {
        id: `msg_resp_${Date.now()}`,
        role: 'assistant' as const,
        content: `I've analyzed your instruction with **${activeModel}**.\n\nAll modifications respect the declared \`tasks.yaml\` contract boundaries.\n- Worktree: \`refs/orchestos/sandbox-t3\`\n- Code graph: AST validated\n- Exit code: \`0\``,
        timestamp: 'Just now',
        model: activeModel,
        reasoning: [
          'Evaluated requested prompt syntax against project invariants',
          'Checked AST boundaries: no circular imports detected',
          'Contract slice checked: within authorized file set',
        ],
        toolCalls: [
          { name: 'read_spec', args: { taskId: 't3_contract' }, status: 'success' as const },
          { name: 'ast_verify', args: { path: 'src/core' }, status: 'success' as const },
        ],
      };
      setThreads((prev) =>
        prev.map((t) => {
          if (t.id === activeThreadId) {
            return {
              ...t,
              messages: [...t.messages, assistantMessage],
              updatedAt: 'Just now',
            };
          }
          return t;
        })
      );
    }, 700);
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
        activeProjectName={currentProject.name}
        activeBranch={currentProject.branch}
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
            onNewProject={handleNewProject}
            onOpenSettings={() => handleOpenSettings('projects', 'tasks')}
            onOpenProjectSettings={handleOpenProjectSettings}
            onDeleteProject={handleDeleteProject}
            activeAgentId={activeAgentId}
            onSelectAgent={handleSelectAgent}
            onCloseAgent={handleCloseAgent}
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
              onCloseAgent={(id) => handleCloseAgent(id, currentProject.id)}
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
        {mode === 'dev' && isRightInspectorOpen && (
          <OrcaRightInspector
            currentProject={currentProject}
            projects={projects}
            recentRuns={runs}
            historySessions={historySessions}
            onRestoreAgentToSidebar={handleRestoreAgentToSidebar}
            onDeleteHistorySession={handleDeleteHistorySession}
          />
        )}
      </div>

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
