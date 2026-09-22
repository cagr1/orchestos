import React, { useEffect, useState } from 'react';
import { Bot, X, Plus } from 'lucide-react';
import { ProviderLogo } from '../common/ProviderLogos';
import { DEFAULT_CHAT_MODEL, getChatModels } from '../../api/chat';

interface ExecutorMode {
  id: string;
  label: string;
  detected: boolean;
}

interface NewAgentSelectorModalProps {
  isOpen: boolean;
  projectName?: string;
  isChatMode?: boolean;
  onClose: () => void;
  onCreateAgent: (cliId: string, modelName: string, title: string) => void;
}

export const NewAgentSelectorModal: React.FC<NewAgentSelectorModalProps> = ({
  isOpen,
  projectName = 'Workspace',
  isChatMode = false,
  onClose,
  onCreateAgent,
}) => {
  const [selectedCli, setSelectedCli] = useState('claude');
  const [agentTitle, setAgentTitle] = useState('');
  const [modes, setModes] = useState<ExecutorMode[]>([]);
  const [models, setModels] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    let disposed = false;
    const modesPromise = fetch('/api/system/executor-modes').then((response) => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json() as Promise<{ modes: ExecutorMode[] }>;
    });
    void modesPromise.then((executorModes) => {
      if (disposed) return;
      const available = executorModes.modes.filter((mode) => mode.detected);
      setModes(available);
      setSelectedCli((current) => available.some((mode) => mode.id === current)
        ? current
        : available[0]?.id || '');
    }).catch(() => { if (!disposed) setModes([]); });
    void getChatModels()
      .then((chatModels) => {
        if (!disposed) setModels(chatModels.map((model) => ({ id: model.id, name: model.name || model.id })));
      })
      .catch(() => { if (!disposed) setModels([]); });
    return () => { disposed = true; };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const opt = modes.find((o) => o.id === selectedCli);
    if (!opt) return;
    const defaultTitle = isChatMode
      ? `Chat with ${opt.label}`
      : `Agent: ${opt.label} on ${projectName}`;
    const finalTitle = agentTitle.trim() || defaultTitle;
    const defaultModel = models.find((model) => model.id === DEFAULT_CHAT_MODEL)?.id || models[0]?.id || '';
    onCreateAgent(opt.id, defaultModel, finalTitle);
    setAgentTitle('');
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-agent-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs"
    >
      <div className="w-full max-w-md rounded-card bg-app-surface border border-app p-5 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-app pb-3">
          <div className="flex items-center gap-2 text-app font-semibold text-sm">
            <Bot className="w-4 h-4 text-app-accent" />
            <h2 id="new-agent-title">
              {isChatMode ? 'Start New Chat with Agent' : `Launch Agent in ${projectName}`}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-app-muted hover:text-app rounded-control"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block text-app-muted mb-1 font-medium">
              {isChatMode ? 'Conversation Topic or Title (Optional)' : 'Session / Task Objective'}
            </label>
            <input
              type="text"
              autoFocus
              value={agentTitle}
              onChange={(e) => setAgentTitle(e.target.value)}
              placeholder={
                isChatMode
                  ? 'e.g. Discuss microservice design or ask a question'
                  : 'e.g. Implement payment webhook verification or AST gate'
              }
              className="w-full px-3 py-1.5 rounded-control bg-app-bg border border-app text-app focus:outline-hidden focus:border-app-accent text-xs"
            />
          </div>

          <div>
            <label className="block text-app-muted mb-1.5 font-medium">Select Agent / Engine</label>
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {modes.map((opt) => {
                const isSelected = selectedCli === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSelectedCli(opt.id)}
                    className={`w-full text-left p-2.5 rounded-card border transition-all flex items-start gap-2.5 ${
                      isSelected
                        ? 'bg-app-elevated border-app-accent text-app shadow-xs'
                        : 'bg-app-bg border-app text-app-muted hover:border-app hover:text-app'
                    }`}
                  >
                    <div className="mt-0.5">
                      <ProviderLogo id={opt.id} className="w-4 h-4 text-app-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-app">{opt.label}</span>
                        <span className="text-xs font-mono text-app-muted">
                          {opt.id === 'api' ? (models.length ? `${models.length} models` : 'Models unavailable') : opt.label}
                        </span>
                      </div>
                      <p className="text-xs text-app-muted mt-0.5 truncate">
                        {opt.id === 'api' ? 'Models from the configured API catalog' : 'Detected CLI available for new sessions'}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-app">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-control text-app-muted hover:text-app hover:bg-app-elevated transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!selectedCli}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-app-accent text-zinc-950 font-semibold hover:opacity-90 transition-opacity"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isChatMode ? 'Start Chat' : 'Launch Agent'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
