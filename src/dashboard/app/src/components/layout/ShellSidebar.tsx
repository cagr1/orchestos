import {
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Code2,
  Ellipsis,
  FolderClosed,
  Loader2,
  MessageSquare,
  Plus,
  Search,
  Settings,
  Trash2,
  X,
} from 'lucide-react'
import type React from 'react'
import { useState } from 'react'
import type { AppMode, ChatThread, ProjectItem } from '../../types/orchestos'
import { ProviderLogo } from '../common/ProviderLogos'
import { ResizableAside } from '../common/ResizableAside'
import { DeleteProjectModal } from './DeleteProjectModal'
import { NewAgentSelectorModal } from './NewAgentSelectorModal'

interface ShellSidebarProps {
  mode: AppMode
  onChangeMode: (mode: AppMode) => void
  threads: ChatThread[]
  activeThreadId: string
  onSelectThread: (id: string) => void
  onNewChat: (cliId?: string, model?: string, title?: string, projectId?: string | null) => void
  onDeleteChat?: (id: string) => void
  projects: ProjectItem[]
  activeProjectId: string
  onSelectProject: (id: string) => void
  onNewProject?: () => void
  onOpenSettings?: () => void
  onOpenProjectSettings?: (projectId: string) => void
  onDeleteProject?: (projectId: string) => void
  activeAgentId?: string | null
  onSelectAgent?: (agentId: string, projectId: string) => void
  onCloseAgent?: (agentId: string, projectId: string) => void
  onCreateAgentInProject?: (projectId: string, cliId: string, model: string, title: string) => void
}

export const ShellSidebar: React.FC<ShellSidebarProps> = ({
  mode,
  onChangeMode,
  threads,
  activeThreadId,
  onSelectThread,
  onNewChat,
  onDeleteChat,
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
  const [chatSearch, setChatSearch] = useState('')
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({
    orchestos: true,
    memories_md: true,
    sala_despecho: true,
  })

  // Modals state
  const [projectForNewAgent, setProjectForNewAgent] = useState<ProjectItem | null>(null)
  const [projectToDelete, setProjectToDelete] = useState<ProjectItem | null>(null)
  const [activeMenuProjectId, setActiveMenuProjectId] = useState<string | null>(null)
  const [isNewChatAgentModalOpen, setIsNewChatAgentModalOpen] = useState(false)

  const toggleProjectExpand = (id: string) => {
    setExpandedProjects((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const filteredThreads = threads.filter((t) =>
    t.title.toLowerCase().includes(chatSearch.toLowerCase()),
  )

  return (
    <ResizableAside
      side="left"
      className="flex-shrink-0 border-r border-app bg-app-bg flex flex-col justify-between select-none text-app z-10"
    >
      {/* Top Segmented Controls: [ Chat ] vs [ </> Dev ] */}
      <div className="p-3">
        <div className="grid grid-cols-2 gap-0.5 rounded-control bg-app-surface p-0.5">
          <button
            type="button"
            onClick={() => onChangeMode('chat')}
            className={`flex items-center justify-center gap-2 rounded-control px-3 py-1 text-xs font-medium outline-none transition-colors ${
              mode === 'chat' ? 'bg-app-elevated text-app' : 'text-app-muted hover:text-app'
            }`}
          >
            <MessageSquare className="w-4 h-4 text-app-muted" />
            <span>Chat</span>
          </button>

          <button
            type="button"
            onClick={() => onChangeMode('dev')}
            className={`flex items-center justify-center gap-2 rounded-control px-3 py-1 text-xs font-medium outline-none transition-colors ${
              mode === 'dev' ? 'bg-app-elevated text-app' : 'text-app-muted hover:text-app'
            }`}
          >
            <Code2 className="w-4 h-4 text-app-muted" />
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
              className="w-full flex h-7 items-center gap-2 px-2 rounded-control text-[12.5px] font-medium text-app-muted hover:bg-app-surface hover:text-app transition-colors"
            >
              <Plus className="w-4 h-4 text-app-muted" />
              <span>New chat</span>
            </button>
          </div>

          {/* CHATS Header + Search Input */}
          <div className="px-3 pt-2 pb-1.5">
            <div className="px-2 text-[11px] font-semibold text-app-muted mb-2">Chats</div>
            <div className="relative">
              <Search className="w-4 h-4 text-app-muted absolute left-2 top-1.5" />
              <input
                type="text"
                value={chatSearch}
                onChange={(e) => setChatSearch(e.target.value)}
                placeholder="Search chats"
                className="h-7 w-full rounded-control bg-app-surface pl-8 pr-2.5 text-[12.5px] text-app outline-none placeholder:text-app-muted"
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
                const isActive = thread.id === activeThreadId
                return (
                  <div
                    key={thread.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelectThread(thread.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onSelectThread(thread.id)
                      }
                    }}
                    className={`w-full group relative flex h-7 items-center justify-between gap-2 px-2 rounded-control text-[12.5px] font-medium text-left cursor-pointer transition-colors ${
                      isActive
                        ? 'bg-app-surface text-app'
                        : 'text-app-muted hover:text-app hover:bg-app-surface'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <ProviderLogo id={thread.agent} className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate" title={thread.title}>
                        {thread.title}
                      </span>
                    </div>

                    {thread.status === 'waiting_approval' && (
                      <span className="text-xs text-app-warning" title="Waiting for your approval">
                        Approval
                      </span>
                    )}
                    {onDeleteChat && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          onDeleteChat(thread.id)
                        }}
                        className="opacity-0 group-hover:opacity-100 text-app-muted hover:text-app-error p-0.5 transition-opacity"
                        title="Delete chat"
                        aria-label="Delete chat"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {/* MODE 2: DEV MODE SIDEBAR */}
      {mode === 'dev' && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-3 pt-3 pb-2 flex items-center justify-between">
            <span className="px-2 text-[11px] font-semibold text-app-muted">Projects</span>
            <button
              type="button"
              onClick={() => onNewProject?.()}
              className="p-1 rounded-control text-app-muted hover:text-app hover:bg-app-surface transition-colors"
              title="Add or Upload Project"
              aria-label="Add or Upload Project"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-2 py-1 space-y-1">
            {projects.map((proj) => {
              const isExpanded = !!expandedProjects[proj.id]
              const isMenuOpen = activeMenuProjectId === proj.id

              return (
                <div key={proj.id} className="space-y-0.5 relative">
                  {/* Project Row Button: Click only toggles expand/collapse */}
                  <div className="group relative flex h-7 items-center justify-between px-2 rounded-control text-[12.5px] font-medium text-app-muted transition-colors hover:bg-app-surface hover:text-app">
                    <button
                      type="button"
                      onClick={() => {
                        onSelectProject(proj.id)
                        toggleProjectExpand(proj.id)
                      }}
                      className="flex items-center gap-2 min-w-0 flex-1 text-left"
                      title={`Toggle ${proj.name} agents`}
                    >
                      <FolderClosed className="w-4 h-4 flex-shrink-0 text-app-muted" />
                      <span className="truncate" title={proj.name}>
                        {proj.name}
                      </span>
                    </button>

                    {/* Right side: Chip on normal, Action icons on hover */}
                    <div className="flex items-center relative ml-2">
                      {/* Chip with agent count (visible without hover) */}
                      <span className="text-[11px] tabular-nums text-app-muted flex items-center justify-center group-hover:hidden">
                        {proj.agents.length}
                      </span>

                      {/* 3 icons on hover: Chevron, Ellipsis, Plus */}
                      <div className="hidden group-hover:flex items-center gap-0.5">
                        {/* Chevron expand toggle */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleProjectExpand(proj.id)
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
                            e.stopPropagation()
                            setActiveMenuProjectId(isMenuOpen ? null : proj.id)
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
                            e.stopPropagation()
                            setProjectForNewAgent(proj)
                          }}
                          className="p-1 rounded-control text-app-muted hover:text-app hover:bg-app-elevated transition-colors"
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
                      <div className="absolute right-2 top-8 z-40 w-44 rounded-card bg-app-elevated shadow-xl p-1 text-xs space-y-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveMenuProjectId(null)
                            if (onOpenProjectSettings) {
                              onOpenProjectSettings(proj.id)
                            }
                          }}
                          className="w-full text-left px-2.5 py-1.5 rounded-control text-app hover:bg-app-elevated flex items-center gap-2"
                        >
                          <Settings className="w-4 h-4 text-app-muted" />
                          <span>Project settings</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setActiveMenuProjectId(null)
                            setProjectToDelete(proj)
                          }}
                          className="w-full text-left px-2.5 py-1.5 rounded-control text-app-error hover:bg-app-surface flex items-center gap-2"
                        >
                          <Trash2 className="w-4 h-4 text-app-error" />
                          <span>Delete project</span>
                        </button>
                      </div>
                    </>
                  )}

                  {/* Sub-agents if expanded: nested list with vertical line on the left */}
                  {isExpanded && proj.agents.length > 0 && (
                    <div className="ml-3 pl-3 py-0.5 space-y-0.5">
                      {proj.agents.map((ag) => {
                        const isAgentActive = activeAgentId === ag.id
                        const isWorking = ag.status === 'active'

                        return (
                          <div
                            key={ag.id}
                            className={`group relative flex h-7 items-center justify-between gap-2 px-2 rounded-control text-[12.5px] font-medium cursor-pointer transition-colors ${
                              isAgentActive
                                ? 'bg-app-surface text-app'
                                : 'text-app-muted hover:text-app hover:bg-app-surface'
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => {
                                if (onSelectAgent) {
                                  onSelectAgent(ag.id, proj.id)
                                }
                              }}
                              className="flex items-center gap-2 min-w-0 flex-1 text-left"
                              title={ag.name}
                            >
                              <ProviderLogo
                                id={ag.model || 'claude'}
                                className="w-4 h-4 flex-shrink-0"
                              />

                              <span className="truncate">{ag.name}</span>
                            </button>

                            {/* Relative time & Close button */}
                            <div className="flex items-center gap-1 ml-1 flex-shrink-0">
                              {ag.status === 'waiting_approval' ? (
                                <CircleAlert
                                  className="w-3 h-3 text-app-warning"
                                  aria-label="Waiting for your approval"
                                />
                              ) : isWorking ? (
                                <Loader2
                                  className="w-3 h-3 text-app-muted animate-spin"
                                  aria-label="Working"
                                />
                              ) : ag.status === 'completed' ? (
                                <Check className="w-3 h-3 text-app-muted" aria-label="Completed" />
                              ) : null}
                              <span className="text-[11px] tabular-nums text-app-muted group-hover:hidden">
                                {ag.duration}
                              </span>

                              {/* Close agent button on hover (moves to history) */}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  if (onCloseAgent) {
                                    onCloseAgent(ag.id, proj.id)
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
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Bottom Footer: Just Settings */}
      <div className="p-3 flex-shrink-0">
        {/* Settings button */}
        <button
          type="button"
          onClick={onOpenSettings}
          className="flex h-7 w-full items-center gap-2 px-2 rounded-control text-[12.5px] font-medium text-app-muted hover:bg-app-surface hover:text-app transition-colors"
        >
          <Settings className="w-4 h-4 text-app-muted" />
          <span>Settings</span>
        </button>
      </div>

      {/* New Chat Agent Selector Modal */}
      {isNewChatAgentModalOpen && (
        <NewAgentSelectorModal
          isOpen={isNewChatAgentModalOpen}
          isChatMode={true}
          projectOptions={projects.map((project) => ({ id: project.id, name: project.name }))}
          selectedProjectId={activeProjectId || projects[0]?.id || null}
          onClose={() => setIsNewChatAgentModalOpen(false)}
          onCreateAgent={(cliId, model, title, projectId) => {
            onNewChat(cliId, model, title, projectId)
            setIsNewChatAgentModalOpen(false)
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
              onCreateAgentInProject(projectForNewAgent.id, cliId, model, title)
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
              onDeleteProject(projectToDelete.id)
            }
          }}
        />
      )}
    </ResizableAside>
  )
}
