import React, { useState, useRef, useEffect } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  ArrowUp,
  Paperclip,
  FileText,
  FileCode,
  X,
  ChevronDown,
  Sparkles,
  Bot,
  AlertCircle,
  Check,
  Cpu,
  Layers,
  Terminal,
} from 'lucide-react';
import { ChatThread, ChatMessage, ChatAttachment } from '../../types/orchestos';
import { ProviderLogo } from '../common/ProviderLogos';

interface OrchestChatViewProps {
  thread?: ChatThread;
  onSendMessage: (
    content: string,
    attachments?: ChatAttachment[],
    agent?: string,
    model?: string,
    effort?: string
  ) => void;
  onApproveHeldTask?: (taskId: string) => void;
  onRejectHeldTask?: (taskId: string) => void;
}

export type AgentType = 'claude' | 'codex' | 'opencode' | 'api';

const AGENT_MODELS: Record<
  AgentType,
  { name: string; provider: string; desc: string }[]
> = {
  claude: [
    { name: 'Claude 3.7 Sonnet', provider: 'claude', desc: 'Extended reasoning & planning' },
    { name: 'Claude 3.5 Haiku', provider: 'claude', desc: 'High speed code review' },
  ],
  codex: [
    { name: 'gpt-5.6-codex', provider: 'codex', desc: 'Code synthesis specialist' },
    { name: 'gpt-4o', provider: 'openai', desc: 'Versatile multimodal engine' },
  ],
  opencode: [
    { name: 'deepseek-v3', provider: 'opencode', desc: 'Local high throughput executor' },
    { name: 'qwen-2.5-coder-32b', provider: 'opencode', desc: 'Optimized local coding model' },
  ],
  api: [
    { name: 'Gemini 2.5 Pro', provider: 'gemini', desc: '1M token deep context' },
    { name: 'DeepSeek V4 Flash', provider: 'deepseek', desc: 'Ultra-fast inference' },
    { name: 'Claude 3.7 Sonnet', provider: 'claude', desc: 'API gateway integration' },
  ],
};

export const OrchestChatView: React.FC<OrchestChatViewProps> = ({
  thread,
  onSendMessage,
  onApproveHeldTask,
  onRejectHeldTask,
}) => {
  const [inputText, setInputText] = useState('');
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<AgentType>('claude');
  const [selectedModel, setSelectedModel] = useState('Claude 3.7 Sonnet');
  const [selectedEffort, setSelectedEffort] = useState('Medium');
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [showUploadMenu, setShowUploadMenu] = useState(false);
  const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const effortLevels = ['Low', 'Medium', 'High', 'Reasoning'];

  // Keep selected model in sync when agent changes
  const handleSelectAgent = (agent: AgentType) => {
    setSelectedAgent(agent);
    const available = AGENT_MODELS[agent];
    if (available && available.length > 0) {
      setSelectedModel(available[0].name);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [thread?.messages]);

  const handleSend = () => {
    if (!inputText.trim() && attachments.length === 0) return;
    onSendMessage(
      inputText.trim(),
      attachments.length > 0 ? attachments : undefined,
      selectedAgent,
      selectedModel,
      selectedEffort
    );
    setInputText('');
    setAttachments([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    const newAttachments: ChatAttachment[] = files.map((f) => ({
      id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: f.name,
      size: `${(f.size / 1024).toFixed(1)} KB`,
      type: f.name.endsWith('.pdf') ? 'pdf' : 'file',
    }));
    setAttachments((prev) => [...prev, ...newAttachments]);
    setShowUploadMenu(false);
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  const toggleToolExpand = (key: string) => {
    setExpandedTools((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const messages = thread?.messages || [];
  const currentAgentModels = AGENT_MODELS[selectedAgent] || AGENT_MODELS.claude;

  return (
    <div className="flex-1 flex flex-col h-full bg-app-bg text-app overflow-hidden relative select-none">
      {/* Scrollable messages container */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        {messages.length === 0 ? (
          <div className="max-w-3xl mx-auto pt-16 text-left space-y-3">
            <h1 className="text-xl font-bold text-app tracking-tight">Chat</h1>
            <p className="text-xs text-app-muted">
              Ask questions or get a quick answer — no task required. Choose your agent and model below.
            </p>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-6">
            {messages.map((msg) => {
              const isUser = msg.role === 'user';

              return (
                <div
                  key={msg.id}
                  className={`flex gap-3.5 ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  {!isUser && (
                    <div className="w-8 h-8 rounded-control bg-app-surface border border-app flex items-center justify-center text-app-accent flex-shrink-0 mt-1">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}

                  <div
                    className={`max-w-2xl rounded-card p-4 text-xs leading-relaxed select-text ${
                      isUser
                        ? 'bg-app-elevated text-app border border-app'
                        : 'bg-app-surface text-app border border-app shadow-xs'
                    }`}
                  >
                    {/* Header line for message */}
                    <div className="flex items-center justify-between gap-4 mb-2 pb-1.5 border-b border-app/60 text-xs text-app-muted font-mono">
                      <span>{isUser ? 'You' : msg.model || 'OrchestOS Agent'}</span>
                      <span>{msg.timestamp}</span>
                    </div>

                    {/* Attached files preview if any */}
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-3">
                        {msg.attachments.map((att) => (
                          <div
                            key={att.id}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-control bg-app-bg border border-app text-xs text-app font-mono"
                          >
                            <FileText className="w-3.5 h-3.5 text-app-accent" />
                            <span>{att.name}</span>
                            <span className="text-app-muted text-xs">({att.size})</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Message content with Markdown rendering + GFM task list checkboxes */}
                    <div className="prose prose-invert max-w-none text-xs leading-relaxed [&>p]:mb-2 [&>ul]:list-disc [&>ul]:pl-4 [&>ol]:list-decimal [&>ol]:pl-4 [&>pre]:bg-app-bg [&>pre]:p-2.5 [&>pre]:rounded-control [&>pre]:border [&>pre]:border-app [&>pre]:font-mono [&>code]:bg-app-bg [&>code]:px-1 [&>code]:py-0.5 [&>code]:rounded-control [&>code]:border [&>code]:border-app [&>code]:font-mono [&>strong]:font-bold [&>strong]:text-app">
                      <Markdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          input: ({ checked, type }) => {
                            if (type === 'checkbox') {
                              return (
                                <span className="inline-flex items-center justify-center w-3.5 h-3.5 mr-1.5 align-middle rounded-[3px] border border-app bg-app-elevated text-app-accent">
                                  {checked ? <Check className="w-2.5 h-2.5 stroke-[3]" /> : null}
                                </span>
                              );
                            }
                            return <input type={type} defaultChecked={checked} readOnly />;
                          },
                        }}
                      >
                        {msg.content}
                      </Markdown>
                    </div>

                    {/* Reasoning steps if present */}
                    {msg.reasoning && msg.reasoning.length > 0 && (
                      <div className="mt-3 p-3 rounded-card bg-app-bg border border-app text-xs font-mono space-y-1 text-app-muted">
                        <div className="text-xs uppercase font-bold text-app-accent tracking-wider flex items-center gap-1.5">
                          <Sparkles className="w-3 h-3" />
                          <span>Chain-of-Thought Reasoning</span>
                        </div>
                        {msg.reasoning.map((step, idx) => (
                          <div key={idx} className="text-app-muted text-xs pl-2 border-l border-app">
                            • {step}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Tool executions (fixed: single line name + arguments truncated, right-aligned status badge) */}
                    {msg.toolCalls && msg.toolCalls.length > 0 && (
                      <div className="mt-3 space-y-1 font-mono text-xs">
                        {msg.toolCalls.map((tool, idx) => {
                          const toolKey = `${msg.id}_tool_${idx}`;
                          const isExpanded = !!expandedTools[toolKey];
                          const argsStr = JSON.stringify(tool.args);

                          return (
                            <div
                              key={idx}
                              onClick={() => toggleToolExpand(toolKey)}
                              className="p-2 rounded-control bg-app-bg border border-app text-xs cursor-pointer hover:border-app-accent/80 transition-colors"
                              title="Click to view full arguments"
                            >
                              <div className="flex items-center justify-between gap-3 min-w-0">
                                <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                                  <span className="text-app-accent font-semibold flex-shrink-0">
                                    ⚡ {tool.name}
                                  </span>
                                  <span
                                    className={`text-app-muted text-xs ${
                                      isExpanded ? 'break-all' : 'truncate'
                                    }`}
                                    title={argsStr}
                                  >
                                    {argsStr}
                                  </span>
                                </div>
                                <span className="flex-shrink-0 px-2 py-0.5 rounded-pill text-[10px] font-semibold uppercase bg-emerald-950/40 text-emerald-400 border border-emerald-800/40">
                                  {tool.status}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Card: Task Held for Human Approval */}
                    {msg.heldTask && (
                      <div className="mt-4 p-4 rounded-card bg-amber-950/20 border border-amber-800/40 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-amber-400" />
                            <span className="font-semibold text-xs text-amber-200">
                              Task Held for Human Approval
                            </span>
                          </div>
                          <span className="text-xs font-mono px-2 py-0.5 rounded-pill bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            {msg.heldTask.taskId}
                          </span>
                        </div>

                        <p className="text-xs text-zinc-300">
                          {msg.heldTask.taskDescription}
                        </p>

                        <div className="text-xs text-amber-300/90 font-mono">
                          Action required: {msg.heldTask.actionRequired}
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-amber-800/40">
                          <button
                            type="button"
                            onClick={() => onRejectHeldTask && onRejectHeldTask(msg.heldTask!.taskId)}
                            className="px-3 py-1.5 rounded-control text-xs font-semibold text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                          >
                            Reject & Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => onApproveHeldTask && onApproveHeldTask(msg.heldTask!.taskId)}
                            className="px-3 py-1.5 rounded-control text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-zinc-950 transition-colors"
                          >
                            Approve & Execute
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Composer Container */}
      <div className="p-4 border-t border-app bg-app-surface/40 flex-shrink-0">
        <div className="max-w-4xl mx-auto rounded-card bg-app-surface border border-app p-3 shadow-lg space-y-2">
          {/* Attached Files as Chips inside the composer */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pb-1">
              {attachments.map((att) => (
                <div
                  key={att.id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-pill bg-app-elevated border border-app text-xs font-mono text-app"
                >
                  <Paperclip className="w-3 h-3 text-app-accent flex-shrink-0" />
                  <span className="truncate max-w-[140px]">{att.name}</span>
                  <span className="text-app-muted text-xs">({att.size})</span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(att.id)}
                    className="text-app-muted hover:text-rose-400 p-0.5 rounded-control transition-colors"
                    title="Remove attachment"
                    aria-label={`Remove ${att.name}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Textarea */}
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message, ask questions, or press Enter to send..."
            rows={2}
            className="w-full bg-transparent text-xs text-app placeholder:text-app-muted focus:outline-hidden resize-none leading-relaxed"
          />

          {/* Action Row */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-app/60">
            <div className="flex flex-wrap items-center gap-2">
              {/* Attachment Picker */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowUploadMenu(!showUploadMenu)}
                  className="p-1.5 rounded-control text-app-muted hover:text-app hover:bg-app-elevated transition-colors"
                  title="Attach files or documentation"
                  aria-label="Attach files"
                >
                  <Paperclip className="w-4 h-4" />
                </button>

                {showUploadMenu && (
                  <div className="absolute left-0 bottom-9 w-48 rounded-card bg-app-surface border border-app shadow-2xl p-1.5 text-xs space-y-1 z-30">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full flex items-center gap-2 p-1.5 rounded-control text-app hover:bg-app-elevated text-left"
                    >
                      <FileCode className="w-3.5 h-3.5 text-app-accent" />
                      <span>Upload Code / Spec</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full flex items-center gap-2 p-1.5 rounded-control text-app hover:bg-app-elevated text-left"
                    >
                      <FileText className="w-3.5 h-3.5 text-rose-400" />
                      <span>Upload PDF Document</span>
                    </button>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </div>

              {/* Agent Selector Chips: Claude, Codex, OpenCode, API */}
              <div className="flex items-center p-0.5 bg-app-elevated rounded-control border border-app text-xs font-mono">
                {[
                  { id: 'claude', label: 'Claude', icon: 'claude' },
                  { id: 'codex', label: 'Codex', icon: 'codex' },
                  { id: 'opencode', label: 'OpenCode', icon: 'opencode' },
                  { id: 'api', label: 'API', icon: 'gemini' },
                ].map((ag) => {
                  const isSelected = selectedAgent === ag.id;
                  return (
                    <button
                      key={ag.id}
                      type="button"
                      onClick={() => handleSelectAgent(ag.id as AgentType)}
                      className={`flex items-center gap-1.5 px-2 py-0.5 rounded-control transition-colors ${
                        isSelected
                          ? 'bg-app-surface text-app font-semibold border border-app shadow-xs'
                          : 'text-app-muted hover:text-app'
                      }`}
                    >
                      <ProviderLogo id={ag.icon} className="w-3 h-3 flex-shrink-0" />
                      <span>{ag.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Model Picker (dependent on selected agent) */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowModelPicker(!showModelPicker)}
                  className="flex items-center gap-1.5 px-2 py-0.5 rounded-control bg-app-elevated border border-app text-xs text-app font-medium hover:border-app-accent transition-colors"
                  aria-label="Select model"
                >
                  <Cpu className="w-3.5 h-3.5 text-app-accent" />
                  <span className="truncate max-w-[130px]">{selectedModel}</span>
                  <ChevronDown className="w-3 h-3 text-app-muted" />
                </button>

                {showModelPicker && (
                  <div className="absolute left-0 bottom-9 w-64 rounded-card bg-app-surface border border-app shadow-2xl p-2 text-xs space-y-1 z-30">
                    <div className="text-[10px] font-bold text-app-muted uppercase tracking-wider px-1">
                      Models for {selectedAgent.toUpperCase()}
                    </div>
                    {currentAgentModels.map((m) => (
                      <button
                        key={m.name}
                        type="button"
                        onClick={() => {
                          setSelectedModel(m.name);
                          setShowModelPicker(false);
                        }}
                        className={`w-full flex items-center gap-2.5 p-2 rounded-control text-left transition-colors ${
                          selectedModel === m.name
                            ? 'bg-app-elevated border border-app-accent text-app'
                            : 'hover:bg-app-elevated text-app-muted hover:text-app'
                        }`}
                      >
                        <ProviderLogo id={m.provider} className="w-4 h-4 flex-shrink-0" />
                        <div>
                          <div className="font-semibold text-xs text-app">{m.name}</div>
                          <div className="text-xs text-app-muted truncate">{m.desc}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Reasoning Effort Selector */}
              <div className="hidden sm:flex items-center p-0.5 bg-app-elevated rounded-control border border-app text-xs font-mono">
                {effortLevels.map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setSelectedEffort(lvl)}
                    className={`px-2 py-0.5 rounded-control transition-colors ${
                      selectedEffort === lvl
                        ? 'bg-app-accent text-zinc-950 font-bold'
                        : 'text-app-muted hover:text-app'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>

            {/* Send Button */}
            <button
              type="button"
              onClick={handleSend}
              disabled={!inputText.trim() && attachments.length === 0}
              className="p-2 rounded-control bg-app-accent text-zinc-950 disabled:opacity-40 hover:opacity-90 transition-opacity flex-shrink-0"
              title="Send message (Enter)"
              aria-label="Send message"
            >
              <ArrowUp className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>
        </div>
      </div>

      {/* Fine Sticky Session Status Bar Pinned Below Chat (Requirement 6) */}
      <div className="flex-shrink-0 border-t border-app bg-app-surface/90 px-4 py-1.5 flex items-center justify-between gap-4 text-xs font-mono">
        <div className="flex items-center gap-5 overflow-x-auto min-w-0">
          <span className="text-app-muted uppercase tracking-wider text-[10px] flex-shrink-0">
            Session Context:
          </span>

          {/* Claude CLI Context */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <ProviderLogo id="claude" className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="text-app text-xs">Claude</span>
            <div className="w-14 h-1.5 rounded-pill bg-app-bg overflow-hidden border border-app/60">
              <div className="h-full bg-amber-500 rounded-pill" style={{ width: '38%' }} />
            </div>
            <span className="text-amber-400 text-xs font-semibold">38%</span>
          </div>

          {/* Codex CLI Context */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <ProviderLogo id="codex" className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="text-app text-xs">Codex</span>
            <div className="w-14 h-1.5 rounded-pill bg-app-bg overflow-hidden border border-app/60">
              <div className="h-full bg-emerald-500 rounded-pill" style={{ width: '22%' }} />
            </div>
            <span className="text-emerald-400 text-xs font-semibold">22%</span>
          </div>

          {/* OpenCode CLI Context */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <ProviderLogo id="opencode" className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="text-app text-xs">OpenCode</span>
            <div className="w-14 h-1.5 rounded-pill bg-app-bg overflow-hidden border border-app/60">
              <div className="h-full bg-sky-500 rounded-pill" style={{ width: '54%' }} />
            </div>
            <span className="text-sky-400 text-xs font-semibold">54%</span>
          </div>

          {/* API Gateway Context */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <ProviderLogo id="gemini" className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="text-app text-xs">API</span>
            <div className="w-14 h-1.5 rounded-pill bg-app-bg overflow-hidden border border-app/60">
              <div className="h-full bg-indigo-500 rounded-pill" style={{ width: '12%' }} />
            </div>
            <span className="text-indigo-400 text-xs font-semibold">12%</span>
          </div>
        </div>

        <div className="text-app-muted text-xs flex-shrink-0 hidden md:block">
          Tokens: <span className="text-app font-semibold">4.8k / 128k</span>
        </div>
      </div>
    </div>
  );
};
