import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  CornerDownLeft,
  Cpu,
  DollarSign,
  FileCode,
  GitBranch,
  Layers,
  MessageSquareCode,
  Paperclip,
  Send,
  ShieldCheck,
  Sparkles,
  Terminal,
  X,
} from 'lucide-react'
import type React from 'react'
import { useState } from 'react'
import { ChatMessage, type ChatThread, ToolExecution } from '../../types/orchestos'

interface ThreadsViewProps {
  threads: ChatThread[]
  activeThreadId: string
  onSelectThread: (id: string) => void
  onSendMessage: (threadId: string, content: string) => void
  onApproveHeldTask: (threadId: string, taskId: string) => void
  onRejectHeldTask: (threadId: string, taskId: string) => void
  activeModel: string
}

export const ThreadsView: React.FC<ThreadsViewProps> = ({
  threads,
  activeThreadId,
  onSelectThread,
  onSendMessage,
  onApproveHeldTask,
  onRejectHeldTask,
  activeModel,
}) => {
  const [inputMessage, setInputMessage] = useState('')
  const [filter, setFilter] = useState<'all' | 'active' | 'waiting_approval'>('all')
  const [expandedReasoning, setExpandedReasoning] = useState<Record<string, boolean>>({})

  const activeThread = threads.find((t) => t.id === activeThreadId) || threads[0]

  const filteredThreads = threads.filter((t) => {
    if (filter === 'active') return t.status === 'active'
    if (filter === 'waiting_approval') return t.status === 'waiting_approval'
    return true
  })

  const toggleReasoning = (msgId: string) => {
    setExpandedReasoning((prev) => ({
      ...prev,
      [msgId]: !prev[msgId],
    }))
  }

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputMessage.trim()) return
    onSendMessage(activeThread.id, inputMessage.trim())
    setInputMessage('')
  }

  const quickPrompts = [
    'Run next task t3 in queue with QA validator',
    'Explain dry-run execution plan for t4',
    'Diagnose failure root cause in run_5510ab',
    'Draft WHEN/THEN acceptance criteria for memory spec',
  ]

  return (
    <div className="flex-1 flex overflow-hidden bg-zinc-950">
      {/* Left Column: Threads Master List (Lightdash AI Threads style) */}
      <div className="w-80 border-r border-zinc-800/80 bg-zinc-950/70 flex flex-col flex-shrink-0">
        {/* Threads List Header */}
        <div className="p-3.5 border-b border-zinc-800/80 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquareCode className="w-4 h-4 text-indigo-400" />
              <span className="font-semibold text-xs text-zinc-100 tracking-wide uppercase">
                Agent Threads
              </span>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              {threads.length} total
            </span>
          </div>

          {/* Filter tabs */}
          <div className="flex items-center p-0.5 bg-zinc-900 rounded-lg text-xs font-medium border border-zinc-800">
            <button
              onClick={() => setFilter('all')}
              className={`flex-1 py-1 rounded-md transition-all text-center ${
                filter === 'all'
                  ? 'bg-zinc-800 text-white font-semibold shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('active')}
              className={`flex-1 py-1 rounded-md transition-all text-center ${
                filter === 'active'
                  ? 'bg-zinc-800 text-white font-semibold shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Active
            </button>
            <button
              onClick={() => setFilter('waiting_approval')}
              className={`flex-1 py-1 rounded-md transition-all text-center ${
                filter === 'waiting_approval'
                  ? 'bg-zinc-800 text-white font-semibold shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Held
            </button>
          </div>
        </div>

        {/* Threads List Items */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
          {filteredThreads.map((thread) => {
            const isSelected = thread.id === activeThread.id
            return (
              <button
                key={thread.id}
                onClick={() => onSelectThread(thread.id)}
                className={`w-full p-3 rounded-xl text-left transition-all border ${
                  isSelected
                    ? 'bg-zinc-900/90 border-indigo-500/50 shadow-lg shadow-indigo-950/20'
                    : 'bg-zinc-900/40 hover:bg-zinc-900/70 border-zinc-800/80 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <span
                    className={`font-semibold text-xs line-clamp-1 ${
                      isSelected ? 'text-white' : 'text-zinc-200'
                    }`}
                  >
                    {thread.title}
                  </span>
                  <span
                    className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${
                      thread.status === 'active'
                        ? 'bg-emerald-400 animate-pulse'
                        : thread.status === 'waiting_approval'
                          ? 'bg-amber-400'
                          : 'bg-zinc-600'
                    }`}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-2">
                  <span className="flex items-center gap-1 font-mono text-zinc-500">
                    <Cpu className="w-3 h-3 text-indigo-400" />
                    {thread.agent}
                  </span>
                  <span className="font-mono text-zinc-400">${thread.costUsd.toFixed(3)}</span>
                </div>

                <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-1 border-t border-zinc-800/50">
                  <span>{thread.messages.length} messages</span>
                  <span className="font-mono">{(thread.tokenCount / 1000).toFixed(1)}k tokens</span>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Right Area: Active Thread Messages & Agent Trace */}
      <div className="flex-1 flex flex-col overflow-hidden bg-zinc-950">
        {/* Thread Top Bar */}
        <div className="h-14 border-b border-zinc-800/80 px-6 flex items-center justify-between bg-zinc-950/80">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white tracking-tight">
                {activeThread.title}
              </h2>
              <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                <span>
                  Agent: <strong className="text-zinc-300 font-medium">{activeThread.agent}</strong>
                </span>
                <span>·</span>
                <span className="font-mono text-indigo-400">{activeModel}</span>
                <span>·</span>
                <span className="flex items-center gap-1 text-emerald-400 font-mono">
                  <GitBranch className="w-3 h-3" /> sandbox active
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <div className="px-2.5 py-1 rounded-md bg-zinc-900 border border-zinc-800 font-mono text-zinc-300 flex items-center gap-1.5">
              <DollarSign className="w-3 h-3 text-emerald-400" />
              <span>${activeThread.costUsd.toFixed(4)}</span>
            </div>
            <div className="px-2.5 py-1 rounded-md bg-zinc-900 border border-zinc-800 font-mono text-zinc-300">
              {activeThread.tokenCount.toLocaleString()} tokens
            </div>
          </div>
        </div>

        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {activeThread.messages.map((message) => {
            const isUser = message.role === 'user'
            const showReasoning = expandedReasoning[message.id] ?? true

            return (
              <div
                key={message.id}
                className={`flex gap-3 max-w-4xl mx-auto ${
                  isUser ? 'justify-end' : 'justify-start'
                }`}
              >
                {!isUser && (
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center flex-shrink-0 text-white font-bold text-xs shadow-md shadow-indigo-500/20 mt-0.5">
                    OS
                  </div>
                )}

                <div className={`space-y-3 flex-1 ${isUser ? 'max-w-xl' : 'max-w-3xl'}`}>
                  {/* User message */}
                  {isUser ? (
                    <div className="bg-indigo-600 text-white p-3.5 rounded-2xl rounded-tr-sm text-xs leading-relaxed shadow-sm font-normal">
                      {message.content}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Chain of Thought reasoning block */}
                      {message.reasoning && message.reasoning.length > 0 && (
                        <div className="rounded-xl border border-zinc-800/90 bg-zinc-900/60 overflow-hidden text-xs">
                          <button
                            onClick={() => toggleReasoning(message.id)}
                            className="w-full px-3 py-2 flex items-center justify-between text-zinc-400 hover:text-zinc-200 bg-zinc-900/90 font-medium transition-colors border-b border-zinc-800/60"
                          >
                            <span className="flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                              Reasoning ({message.reasoning.length} steps)
                            </span>
                            {showReasoning ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </button>

                          {showReasoning && (
                            <div className="p-3 space-y-1.5 font-mono text-[11px] text-zinc-300">
                              {message.reasoning.map((step, idx) => (
                                <div key={idx} className="flex items-start gap-2">
                                  <span className="text-indigo-400 select-none">›</span>
                                  <span className="text-zinc-300">{step}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Tool Calls Execution Trace */}
                      {message.toolCalls && message.toolCalls.length > 0 && (
                        <div className="space-y-1.5">
                          <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider px-1">
                            Tool executions
                          </div>
                          <div className="space-y-1">
                            {message.toolCalls.map((tool, idx) => (
                              <div
                                key={idx}
                                className="p-2.5 rounded-lg bg-zinc-900/70 border border-zinc-800 flex items-center justify-between text-xs"
                              >
                                <div className="flex items-center gap-2 overflow-hidden">
                                  <div className="w-2 h-2 rounded-full bg-emerald-400" />
                                  <span className="font-mono text-indigo-300 font-medium">
                                    {tool.name}
                                  </span>
                                  <span className="text-zinc-500 text-[11px] truncate max-w-md">
                                    {JSON.stringify(tool.args)}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  {tool.durationMs && (
                                    <span className="font-mono text-[10px] text-zinc-500">
                                      {tool.durationMs}ms
                                    </span>
                                  )}
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                    {tool.status}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Contract Verification Banner */}
                      {message.taskContract && (
                        <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800 flex items-start gap-2.5 text-xs">
                          <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <div className="font-semibold text-zinc-200">
                              Contract Barrier Enforced
                            </div>
                            <div className="text-zinc-400 text-[11px] mt-0.5">
                              Declared output files authorized for sandbox modification:
                            </div>
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {message.taskContract.output.map((file) => (
                                <span
                                  key={file}
                                  className="px-2 py-0.5 rounded font-mono text-[11px] bg-zinc-950 text-indigo-300 border border-zinc-700/80 flex items-center gap-1"
                                >
                                  <FileCode className="w-3 h-3 text-zinc-500" />
                                  {file}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Main Assistant Content */}
                      <div className="bg-zinc-900/90 border border-zinc-800 text-zinc-200 p-4 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap">
                        {message.content}
                      </div>

                      {/* Task Held / Inline Confirmation Box */}
                      {message.taskHeld && message.proposedTask && (
                        <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-950/40 via-zinc-900 to-zinc-900 border border-indigo-500/40 shadow-xl space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                              <span className="font-bold text-xs text-white">
                                Task ready to run
                              </span>
                            </div>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                              {message.proposedTask.id}
                            </span>
                          </div>

                          <p className="text-xs text-zinc-300">
                            {message.proposedTask.description}
                          </p>

                          <div className="flex items-center gap-2 pt-1">
                            <button
                              onClick={() =>
                                onApproveHeldTask(activeThread.id, message.proposedTask!.id)
                              }
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/20 transition-all active:scale-95"
                            >
                              <Check className="w-3.5 h-3.5" />
                              Approve & Run
                            </button>
                            <button
                              onClick={() =>
                                onRejectHeldTask(activeThread.id, message.proposedTask!.id)
                              }
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium border border-zinc-700 transition-all"
                            >
                              <X className="w-3.5 h-3.5" />
                              Reject task
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="text-[10px] font-mono text-zinc-500 px-1">
                    {message.timestamp}
                  </div>
                </div>

                {isUser && (
                  <div className="w-8 h-8 rounded-xl bg-zinc-800 flex items-center justify-center flex-shrink-0 text-zinc-300 font-bold text-xs mt-0.5">
                    ME
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Quick Suggestion Chips */}
        <div className="px-6 py-2 border-t border-zinc-850 flex items-center gap-2 overflow-x-auto bg-zinc-950/90 select-none">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex-shrink-0">
            Quick Runs:
          </span>
          {quickPrompts.map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => onSendMessage(activeThread.id, prompt)}
              className="text-[11px] px-2.5 py-1 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 hover:border-zinc-700 whitespace-nowrap transition-colors"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Bottom Input Area */}
        <div className="p-4 border-t border-zinc-800/80 bg-zinc-950">
          <form
            onSubmit={handleSend}
            className="max-w-4xl mx-auto rounded-2xl border border-zinc-700/80 bg-zinc-900/90 p-2 shadow-2xl focus-within:border-indigo-500/80 transition-all"
          >
            <textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend(e)
                }
              }}
              rows={2}
              placeholder="Ask OrchestOS agent to scaffold a task, inspect runs, or run middleware checks (Enter to send)..."
              className="w-full bg-transparent text-xs text-zinc-100 placeholder-zinc-500 resize-none focus:outline-none p-2"
            />

            <div className="flex items-center justify-between pt-2 border-t border-zinc-800/80 px-1">
              <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono text-[10px] border border-zinc-700">
                  {activeModel}
                </span>
                <span className="text-zinc-500 hidden sm:inline">Contract sandbox: active</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={!inputMessage.trim()}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white text-xs font-semibold transition-all shadow-md shadow-indigo-600/20 active:scale-95"
                >
                  <span>Dispatch</span>
                  <CornerDownLeft className="w-3 h-3" />
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
