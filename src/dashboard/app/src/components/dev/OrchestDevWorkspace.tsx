import React from 'react';
import { AgentItem, ChatAttachment, ChatThread, ProjectItem } from '../../types/orchestos';
import { OrchestChatView } from '../chat/OrchestChatView';

interface OrchestDevWorkspaceProps {
  activeProject?: ProjectItem;
  activeAgent?: AgentItem | null;
  thread?: ChatThread;
  onSendMessage: (content: string, attachments?: ChatAttachment[], agent?: string, model?: string, effort?: string) => void;
}

export const OrchestDevWorkspace: React.FC<OrchestDevWorkspaceProps> = ({ activeProject, activeAgent, thread, onSendMessage }) => {
  if (!activeAgent || !thread) {
    return <main className="flex-1 flex flex-col items-center justify-center p-8 bg-app-bg text-app select-none overflow-hidden"><div className="flex flex-col items-center max-w-sm text-center space-y-4 opacity-70"><div className="w-16 h-16 rounded-card bg-app-surface border border-app flex items-center justify-center text-app-accent shadow-lg"><span className="text-2xl font-black tracking-tighter">O</span><span className="text-xl font-black text-app">S</span></div><div className="space-y-1.5"><h1 className="text-xl font-bold text-app tracking-tight">{activeProject?.name || 'Workspace'} Dev</h1><p className="text-xs text-app-muted leading-relaxed">Select an agent from the sidebar to open its real chat session.</p></div></div></main>;
  }
  return <main className="flex-1 flex flex-col bg-app-bg text-app overflow-hidden"><div className="h-12 border-b border-app bg-app-surface/60 px-4 flex items-center justify-between flex-shrink-0"><div className="min-w-0"><div className="font-semibold text-xs truncate">{activeAgent.name}</div><div className="text-xs font-mono text-app-muted">{activeProject?.name || 'Workspace'} · {activeAgent.model}</div></div></div><OrchestChatView thread={thread} onSendMessage={onSendMessage} /></main>;
};
