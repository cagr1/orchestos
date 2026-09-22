import React, { useState } from 'react';
import {
  MessageSquare,
  Code2,
  Plus,
  Search,
  Settings,
  FolderClosed,
  ChevronDown,
  ChevronRight,
  Ellipsis,
  Loader2,
  Check,
  X,
  Trash2,
} from 'lucide-react';
import { AppMode, ChatThread, ProjectItem } from '../../types/orchestos';
import { ProviderLogo } from '../common/ProviderLogos';
import { AddProjectModal } from './AddProjectModal';
import { NewAgentSelectorModal } from './NewAgentSelectorModal';
import { DeleteProjectModal } from './DeleteProjectModal';

interface ShellSidebarProps {
  mode: AppMode;
  onChangeMode: (mode: AppMode) => void;
  threads: ChatThread[];
  activeThreadId: string;
  onSelectThread: (id: string) => void;
  onNewChat: (cliId?: string, model?: string, title?: string) => void;
  onDeleteChat?: (id: string) => void;
  onRenameChat?: (id: string) => void;
  projects: ProjectItem[];
  activeProjectId: string;
  onSelectProject: (id: string) => void;
  onNewProject?: (name: string, branch?: string) => void;
  onOpenSettings?: () => void;
  onOpenProjectSettings?: (projectId: string) => void;
  onDeleteProject?: (projectId: string) => void;
  activeAgentId?: string | null;
  onSelectAgent?: (agentId: string, projectId: string) => void;
  onCloseAgent?: (agentId: string, projectId: string) => void;
  onCreateAgentInProject?: (projectId: string, cliId: string, model: string, title: string) => void;
}

export const ShellSidebar: React.FC<ShellSidebarProps> = ({
  mode,
  onChangeMode,
  threads,
  activeThreadId,
  onSelectThread,
  onNewChat,
  onDeleteChat,
  onRenameChat,
  projects,
  activeProjectId,
  onSelectProject,
  onNewProject,
  onOpenSettings,
  onOpenProjectSettings,
  onDeleteProject,
  activeAgentId,
  onSelectAgent,
  onCloseAgent,
  onCreateAgentInProject,
}) => {
  const [chatSearch, setChatSearch] = useState('');
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({
    orchestos: true,
    memories_md: true,
    sala_despecho: true,
  });

  // Modals state
  const [isAddProjectModalOpen, setIsAddProjectModalOpen] = useState(false);
  const [projectForNewAgent, setProjectForNewAgent] = useState<ProjectItem | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<ProjectItem | null>(null);
  const [activeMenuProjectId, setActiveMenuProjectId] = useState<string | null>(null);
  const [isNewChatAgentModalOpen, setIsNewChatAgentModalOpen] = useState(false);

  const toggleProjectExpand = (id: string) => {
    setExpandedProjects((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredThreads = threads.filter((t) =>
    t.title.toLowerCase().includes(chatSearch.toLowerCase())
  );

  return (
    <aside className="w-64 flex-shrink-0 bg-app-bg border-r border-app flex flex-col justify-between select-none text-app flex-shrink-0 z-10">
      {/* Top Segmented Controls: [ Chat ] vs [ </> Dev ] */}
      <div className="p-3 border-b border-app">
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-app-surface rounded-control border border-app">
          <button
            type="button"
            onClick={() => onChangeMode('chat')}
            className={`flex items-center justify-center gap-2 py-1.5 px-3 rounded-control text-xs font-medium transition-all ${
              mode === 'chat'
                ? 'bg-app-elevated text-app shadow-xs border border-app font-semibold'
                : 'text-app-muted hover:text-app hover:bg-app-surface/60'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 text-app-accent" />
            <span>Chat</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeMode('dev')}
            className={`flex items-center justify-center gap-2 py-1.5 px-3 rounded-control text-xs font-medium transition-all ${
              mode === 'dev'
                ? 'bg-app-elevated text-app shadow-xs border border-app font-semibold'
                : 'text-app-muted hover:text-app hover:bg-app-surface/60'
            }`}
          >
            <Code2 className="w-3.5 h-3.5 text-app-accent" />
            <span>Dev</span>
          </button>
        </div>
      </div>

      {/* MODE 1: CHAT MODE SIDEBAR */}
      {mode === 'chat' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* New Chat Button */}
          <div className="p-3 pb-2">
            <button
              type="button"
              onClick={() => setIsNewChatAgentModalOpen(true)}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-control text-app hover:bg-app-surface border border-app transition-all shadow-xs"
            >
              <Plus className="w-4 h-4 text-app-accent" />
              <span>New chat</span>
            </button>
          </div>

          {/* CHATS Header + Search Input */}
          <div className="px-3 pt-2 pb-1.5">
            <div className="text-xs font-bold text-app-muted tracking-wider mb-2">
              CHATS
            </div>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-app-muted absolute left-2.5 top-2" />
              <input
                type="text"
                value={chatSearch}
                onChange={(e) => setChatSearch(e.target.value)}
                placeholder="Search chats"
                className="w-full pl-8 pr-2.5 py-1 text-xs bg-app-surface border border-app rounded-control focus:border-app-accent focus:outline-hidden text-app placeholder:text-app-muted"
              />
            </div>
          </div>

          {/* Chat List */}
          <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5">
            {filteredThreads.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-app-muted">
                No conversations yet
              </div>
            ) : (
              filteredThreads.map((thread) => {
                const isActive = thread.id === activeThreadId;
                return (
                  <div
                    key={thread.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelectThread(thread.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelectThread(thread.id);
                      }
                    }}
                    className={`w-full group relative flex items-center justify-between px-3 py-2 rounded-control text-xs text-left cursor-pointer transition-colors ${
                      isActive
                        ? 'bg-app-surface text-app font-medium border border-app shadow-xs'
                        : 'text-app-muted hover:text-app hover:bg-app-surface/50'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <MessageSquare
                        className={`w-3.5 h-3.5 flex-shrink-0 ${
                          isActive ? 'text-app-accent' : 'text-app-muted'
                        }`}
                      />
                      <span className="truncate" title={thread.title}>
                        {thread.title}
                      </span>
                    </div>

                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                      {onRenameChat && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onRenameChat(thread.id); }}
                          className="text-app-muted hover:text-app p-0.5"
                          title="Rename chat"
                          aria-label="Rename chat"
                        >
                          <Ellipsis className="w-3 h-3" />
                        </button>
                      )}
                      {onDeleteChat && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onDeleteChat(thread.id); }}
                          className="text-app-muted hover:text-rose-400 p-0.5"
                          title="Delete chat"
                          aria-label="Delete chat"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* MODE 2: DEV MODE SIDEBAR */}
      {mode === 'dev' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-3 pt-3 pb-2 flex items-center justify-between">
            <span className="text-xs font-bold text-app-muted tracking-wider">
              PROJECTS
            </span>
            <button
              type="button"
              onClick={() => setIsAddProjectModalOpen(true)}
              className="p-1 rounded-control text-app-muted hover:text-app hover:bg-app-surface transition-colors"
              title="Add or Upload Project"
              aria-label="Add or Upload Project"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-2 py-1 space-y-1">
            {projects.map((proj) => {
              const isExpanded = !!expandedProjects[proj.id];
              const isMenuOpen = activeMenuProjectId === proj.id;

              return (
                <div key={proj.id} className="space-y-0.5 relative">
                  {/* Project Row Button: Click only toggles expand/collapse */}
                  <div
                    className="group relative flex items-center justify-between px-2.5 py-1.5 rounded-control text-xs text-app transition-colors hover:bg-app-surface/60 border border-transparent hover:border-app"
                  >
                    <button
                      type="button"
                      onClick={() => toggleProjectExpand(proj.id)}
                      className="flex items-center gap-2 min-w-0 flex-1 text-left"
                      title={`Toggle ${proj.name} agents`}
                    >
                      <FolderClosed className="w-4 h-4 flex-shrink-0 text-app-accent" />
                      <span className="truncate font-medium text-app" title={proj.name}>
                        {proj.name}
                      </span>
                    </button>

                    {/* Right side: Chip on normal, Action icons on hover */}
                    <div className="flex items-center relative ml-2">
                      {/* Chip with agent count (visible without hover) */}
                      <span className="px-1.5 py-0.5 rounded-pill bg-app-surface border border-app text-xs font-mono text-app-muted flex items-center justify-center group-hover:hidden transition-all">
                        {proj.agents.length}
                      </span>

                      {/* 3 icons on hover: Chevron, Ellipsis, Plus */}
                      <div className="hidden group-hover:flex items-center gap-0.5">
                        {/* Chevron expand toggle */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleProjectExpand(proj.id);
                          }}
                          className="p-1 rounded-control text-app-muted hover:text-app hover:bg-app-elevated transition-colors"
                          title={isExpanded ? 'Collapse agents' : 'Expand agents'}
                          aria-label={isExpanded ? 'Collapse agents' : 'Expand agents'}
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-3 h-3" />
                          ) : (
                            <ChevronRight className="w-3 h-3" />
                          )}
                        </button>

                        {/* Ellipsis menu button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuProjectId(isMenuOpen ? null : proj.id);
                          }}
                          className="p-1 rounded-control text-app-muted hover:text-app hover:bg-app-elevated transition-colors"
                          title="Project actions"
                          aria-label="Project actions"
                        >
                          <Ellipsis className="w-3 h-3" />
                        </button>

                        {/* Plus button to create new agent in this project */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setProjectForNewAgent(proj);
                          }}
                          className="p-1 rounded-control text-app-muted hover:text-app-accent hover:bg-app-elevated transition-colors"
                          title="Launch new agent"
                          aria-label="Launch new agent"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Ellipsis Menu Dropdown: only Project Settings & Delete Project */}
                  {isMenuOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-30"
                        onClick={() => setActiveMenuProjectId(null)}
                      />
                      <div className="absolute right-2 top-8 z-40 w-44 rounded-card bg-app-surface border border-app shadow-xl p-1 text-xs space-y-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveMenuProjectId(null);
                            if (onOpenProjectSettings) {
                              onOpenProjectSettings(proj.id);
                            }
                          }}
                          className="w-full text-left px-2.5 py-1.5 rounded-control text-app hover:bg-app-elevated flex items-center gap-2"
                        >
                          <Settings className="w-3.5 h-3.5 text-app-muted" />
                          <span>Project settings</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setActiveMenuProjectId(null);
                            setProjectToDelete(proj);
                          }}
                          className="w-full text-left px-2.5 py-1.5 rounded-control text-rose-400 hover:bg-rose-950/40 flex items-center gap-2"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                          <span>Delete project</span>
                        </button>
                      </div>
                    </>
                  )}

                  {/* Sub-agents if expanded: nested list with vertical line on the left */}
                  {isExpanded && proj.agents.length > 0 && (
                    <div className="ml-3 pl-3 border-l border-app/80 py-0.5 space-y-0.5">
                      {proj.agents.map((ag) => {
                        const isAgentActive = activeAgentId === ag.id;
                        const isWorking = ag.status === 'active';

                        return (
                          <div
                            key={ag.id}
                            className={`group relative flex items-center justify-between py-1 px-2 rounded-control text-xs cursor-pointer transition-colors ${
                              isAgentActive
                                ? 'bg-app-surface text-app font-medium border border-app'
                                : 'text-app-muted hover:text-app hover:bg-app-surface/40'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                if (onSelectAgent) {
                                  onSelectAgent(ag.id, proj.id);
                                }
                              }}
                              className="flex items-center gap-1.5 min-w-0 flex-1 text-left"
                              title={ag.name}
                            >
                              {/* Left icon: Loader while working, green check when done, or CLI brand icon */}
                              {isWorking ? (
                                <Loader2 className="w-3 h-3 text-amber-400 animate-spin flex-shrink-0" />
                              ) : ag.status === 'completed' ? (
                                <Check className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                              ) : (
                                <ProviderLogo
                                  id={ag.model || 'claude'}
                                  className="w-3 h-3 flex-shrink-0"
                                />
                              )}

                              <span className="truncate">{ag.name}</span>
                            </button>

                            {/* Relative time & Close button */}
                            <div className="flex items-center gap-1 ml-1 flex-shrink-0">
                              <span className="font-mono text-app-muted group-hover:hidden">
                                {ag.duration}
                              </span>

                              {/* Close agent button on hover (moves to history) */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (onCloseAgent) {
                                    onCloseAgent(ag.id, proj.id);
                                  }
                                }}
                                className="hidden group-hover:flex p-0.5 text-app-muted hover:text-app rounded-control"
                                title="Close agent (archive to History)"
                                aria-label="Close agent"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Bottom Footer: Settings & Quota Progress Bars */}
      <div className="p-3 border-t border-app bg-app-surface/40 space-y-3 flex-shrink-0">
        {/* Settings button */}
        <button
          type="button"
          onClick={onOpenSettings}
          className="flex items-center gap-2 text-xs text-app-muted hover:text-app transition-colors"
        >
          <Settings className="w-4 h-4 text-app-muted" />
          <span>Settings</span>
        </button>

      </div>

      {/* Add Project Modal */}
      <AddProjectModal
        isOpen={isAddProjectModalOpen}
        onClose={() => setIsAddProjectModalOpen(false)}
        onCreate={(name, branch) => {
          if (onNewProject) onNewProject(name, branch);
        }}
      />

      {/* New Chat Agent Selector Modal */}
      {isNewChatAgentModalOpen && (
        <NewAgentSelectorModal
          isOpen={isNewChatAgentModalOpen}
          isChatMode={true}
          onClose={() => setIsNewChatAgentModalOpen(false)}
          onCreateAgent={(cliId, model, title) => {
            onNewChat(cliId, model, title);
            setIsNewChatAgentModalOpen(false);
          }}
        />
      )}

      {/* New Agent Selector Modal */}
      {projectForNewAgent && (
        <NewAgentSelectorModal
          isOpen={!!projectForNewAgent}
          projectName={projectForNewAgent.name}
          onClose={() => setProjectForNewAgent(null)}
          onCreateAgent={(cliId, model, title) => {
            if (onCreateAgentInProject) {
              onCreateAgentInProject(projectForNewAgent.id, cliId, model, title);
            }
          }}
        />
      )}

      {/* Delete Project Confirmation Modal */}
      {projectToDelete && (
        <DeleteProjectModal
          isOpen={!!projectToDelete}
          projectName={projectToDelete.name}
          onClose={() => setProjectToDelete(null)}
          onConfirm={() => {
            if (onDeleteProject) {
              onDeleteProject(projectToDelete.id);
            }
          }}
        />
      )}
    </aside>
  );
};
