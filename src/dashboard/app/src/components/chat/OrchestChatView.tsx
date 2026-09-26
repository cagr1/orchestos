import {
  Bot,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  FileText,
  Loader2,
  Sparkles,
  User,
  X,
} from 'lucide-react'
import type React from 'react'
import { useEffect, useRef, useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { getConfig } from '../../api/settings'
import type { ChatAttachment, ChatThread, SessionStatus } from '../../types/orchestos'
import { AgentComposer, type CliId } from '../common/AgentComposer'
import { ContextRing } from '../common/ContextRing'
import { ProviderLogo } from '../common/ProviderLogos'

interface OrchestChatViewProps {
  thread?: ChatThread
  projectExists?: boolean
  onSendMessage: (
    content: string,
    attachments?: ChatAttachment[],
    agent?: string,
    model?: string,
    effort?: string,
  ) => unknown
  onApproveHeldTask?: (taskId: string) => void | Promise<void>
  onRejectHeldTask?: (taskId: string) => void | Promise<void>
  sessionStatus?: SessionStatus | null
  onSlashCommand?: (command: string, argument?: string) => void
  onOpenRouting?: () => void
}

export const OrchestChatView: React.FC<OrchestChatViewProps> = ({
  thread,
  projectExists = true,
  onSendMessage,
  onApproveHeldTask,
  onRejectHeldTask,
  sessionStatus,
  onSlashCommand,
  onOpenRouting,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)
  const [isWorking, setIsWorking] = useState(false)
  const sendLock = useRef(false)
  const [expandedReasoning, setExpandedReasoning] = useState<Record<string, boolean>>({})
  const [taskActionErrors, setTaskActionErrors] = useState<Record<string, string>>({})
  const [sendError, setSendError] = useState<string | null>(null)
  const [orchestrator, setOrchestrator] = useState<{
    agent: string
    model: string
    effort?: string
  } | null>(null)

  useEffect(() => {
    let disposed = false
    const projectId = thread?.projectId
    if (projectId && !projectExists) {
      setOrchestrator(null)
      return
    }
    const controller = new AbortController()
    void getConfig(projectId ?? undefined, controller.signal)
      .then((config) => {
        if (!disposed) setOrchestrator(config.roleAssignments?.orchestrator ?? null)
      })
      .catch(() => {
        if (!disposed) setOrchestrator(null)
      })
    return () => {
      disposed = true
      controller.abort()
    }
  }, [thread?.projectId, projectExists])

  const messages = thread?.messages || []
  const cliId = (
    thread?.agent === 'claude' ||
    thread?.agent === 'codex' ||
    thread?.agent === 'opencode' ||
    thread?.agent === 'api'
      ? thread.agent
      : 'api'
  ) as CliId
  const cliName =
    cliId === 'api'
      ? 'ChatGPT'
      : cliId === 'claude'
        ? 'Claude'
        : cliId === 'codex'
          ? 'Codex'
          : cliId === 'opencode'
            ? 'OpenCode'
            : cliId === 'deepseek'
              ? 'DeepSeek'
              : 'Gemini'
  const context = sessionStatus?.clis.find((cli) => cli.id === cliId)?.context
  const lastAssistant = [...messages].reverse().find((message) => message.role === 'assistant')
  const lastModel = lastAssistant?.model
    ?.replace(/\s+via\s+.+$/i, '')
    .replace(/\s*\(effort: [^)]+\)/i, '')
  const lastEffort = lastAssistant?.model?.match(/\(effort: ([^)]+)\)/i)?.[1]
  const sessionUsesOrchestrator = Boolean(orchestrator && thread?.agent === orchestrator.agent)
  const initialModel = sessionUsesOrchestrator
    ? orchestrator?.model
    : cliId === 'api'
      ? lastModel
      : undefined
  const initialEffort = sessionUsesOrchestrator
    ? orchestrator?.effort
    : cliId === 'api'
      ? lastEffort
      : undefined

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    if (messages.some((message) => message.role === 'assistant')) setIsWorking(false)
  }, [messages])

  const copyMessage = async (id: string, content: string) => {
    await navigator.clipboard.writeText(content)
    setCopiedMessageId(id)
    window.setTimeout(
      () => setCopiedMessageId((current) => (current === id ? null : current)),
      1500,
    )
  }

  const handleSendFromComposer = async (
    text: string,
    attachments?: ChatAttachment[],
    cli?: string,
    model?: string,
    effort?: string,
  ) => {
    if (sendLock.current) return false
    sendLock.current = true
    setSendError(null)
    setIsWorking(true)
    try {
      const accepted = await onSendMessage(text, attachments, cli, model, effort)
      return accepted !== false
    } catch (error) {
      setSendError(error instanceof Error ? error.message : String(error))
      return false
    } finally {
      sendLock.current = false
      setIsWorking(false)
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-app-bg text-app overflow-hidden relative select-none">
      {/* 40px Session Header (Shared format with Dev) */}
      <header className="h-10 border-b border-app bg-app-bg px-3.5 flex items-center justify-between flex-shrink-0 z-20">
        {/* Left: CLI Product Logo (tooltip = name) + Title */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div title={cliName} className="flex-shrink-0 cursor-default">
            <ProviderLogo id={cliId} size={16} className="w-4 h-4" />
          </div>
          <span className="font-semibold text-xs text-app truncate max-w-sm">
            {thread?.title || 'Interactive Session'}
          </span>
        </div>

        {/* Context is rendered only when the selected session has real token telemetry. */}
        <div className="flex items-center flex-shrink-0">
          <ContextRing
            percent={context?.pct}
            model={context?.model ?? undefined}
            usedTokens={context ? `${context.used}` : undefined}
            maxTokens={context ? `${context.window}` : undefined}
          />
        </div>
      </header>

      {/* Scrollable messages container */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        {messages.length === 0 ? (
          <div className="max-w-3xl mx-auto pt-16 text-left space-y-2">
            <h1 className="text-lg font-bold text-app tracking-tight">Chat</h1>
            <p className="text-xs text-app-muted">
              Interactive session with {cliName}. Ask questions, run commands, or review
              architecture.
            </p>
          </div>
        ) : (
          <div className="max-w-3xl lg:max-w-4xl mx-auto space-y-5">
            {messages.map((msg) => {
              const isUser = msg.role === 'user'

              if (isUser) {
                // Human avatar stays on the right, after the message bubble.
                return (
                  <div key={msg.id} className="flex items-end justify-end gap-2 group">
                    <div className="relative max-w-2xl px-4 py-2.5 rounded-card bg-app-surface text-app border border-app text-xs leading-relaxed shadow-2xs">
                      {msg.timestamp && (
                        <span className="absolute right-0 bottom-full mb-1 text-[10px] font-mono text-app-muted opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          {msg.timestamp}
                        </span>
                      )}

                      {/* Attachments if any */}
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {msg.attachments.map((att) => (
                            <div
                              key={att.id}
                              className="flex items-center gap-1.5 px-2 py-0.5 rounded-control bg-app-bg border border-app text-[11px] text-app font-mono"
                            >
                              <FileText className="w-3 h-3 text-app-accent" />
                              <span>{att.name}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div>{msg.content}</div>
                      <button
                        type="button"
                        onClick={() => void copyMessage(msg.id, msg.content)}
                        className="absolute left-0 top-full mt-1 p-1 rounded-control text-app-muted opacity-0 group-hover:opacity-100 hover:text-app hover:bg-app-surface transition-colors"
                        title="Copy"
                        aria-label="Copy"
                      >
                        {copiedMessageId === msg.id ? (
                          <Check className="w-3 h-3" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>
                    <User className="mb-2 h-4 w-4 shrink-0 text-app-muted" aria-hidden="true" />
                  </div>
                )
              }

              // Assistant message
              return (
                <div key={msg.id} className="flex items-start gap-2">
                  <Bot className="mt-4 h-4 w-4 shrink-0 text-app-accent" aria-hidden="true" />
                  <div className="relative max-w-3xl rounded-card p-4 text-xs leading-relaxed bg-app-surface/60 text-app border border-app/60 shadow-2xs select-text w-full group">
                    {msg.reasoning && msg.reasoning.length > 0 && (
                      <div className="rounded-xl border border-zinc-800/90 bg-zinc-900/60 overflow-hidden text-xs mb-3">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedReasoning((prev) => ({
                              ...prev,
                              [msg.id]: !(prev[msg.id] ?? true),
                            }))
                          }
                          className="w-full px-3 py-2 flex items-center justify-between text-zinc-400 hover:text-zinc-200 bg-zinc-900/90 font-medium transition-colors border-b border-zinc-800/60"
                        >
                          <span className="flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                            Reasoning ({msg.reasoning.length} steps)
                          </span>
                          {(expandedReasoning[msg.id] ?? true) ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </button>
                        {(expandedReasoning[msg.id] ?? true) && (
                          <div className="p-3 space-y-1.5 font-mono text-[11px] text-zinc-300">
                            {msg.reasoning.map((step, idx) => (
                              <div key={idx} className="flex items-start gap-2">
                                <span className="text-indigo-400 select-none">›</span>
                                <span className="text-zinc-300">{step}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {msg.toolCalls && msg.toolCalls.length > 0 && (
                      <div className="space-y-1.5 mb-3">
                        <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider px-1">
                          Tool executions
                        </div>
                        <div className="space-y-1">
                          {msg.toolCalls.map((tool, idx) => (
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
                              )
                            }
                            return <input type={type} defaultChecked={checked} readOnly />
                          },
                        }}
                      >
                        {msg.content}
                      </Markdown>
                    </div>
                    {msg.taskHeld && msg.proposedTask && (
                      <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-950/40 via-zinc-900 to-zinc-900 border border-indigo-500/40 shadow-xl space-y-3 mt-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                            <span className="font-bold text-xs text-white">Task ready to run</span>
                          </div>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                            {msg.proposedTask.id}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-300">{msg.proposedTask.description}</p>
                        {taskActionErrors[msg.proposedTask.id] && (
                          <div role="alert" className="text-xs text-red-300">
                            {taskActionErrors[msg.proposedTask.id]}
                          </div>
                        )}
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              void Promise.resolve(onApproveHeldTask?.(msg.proposedTask!.id)).catch(
                                (error: unknown) =>
                                  setTaskActionErrors((prev) => ({
                                    ...prev,
                                    [msg.proposedTask!.id]:
                                      error instanceof Error ? error.message : String(error),
                                  })),
                              )
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/20 transition-all active:scale-95"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Approve & Run
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              void Promise.resolve(onRejectHeldTask?.(msg.proposedTask!.id)).catch(
                                (error: unknown) =>
                                  setTaskActionErrors((prev) => ({
                                    ...prev,
                                    [msg.proposedTask!.id]:
                                      error instanceof Error ? error.message : String(error),
                                  })),
                              )
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium border border-zinc-700 transition-all"
                          >
                            <X className="w-3.5 h-3.5" />
                            Reject
                          </button>
                        </div>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => void copyMessage(msg.id, msg.content)}
                      className="absolute right-2 top-2 p-1 rounded-control text-app-muted opacity-0 group-hover:opacity-100 hover:text-app hover:bg-app-elevated transition-colors"
                      title="Copy"
                      aria-label="Copy"
                    >
                      {copiedMessageId === msg.id ? (
                        <Check className="w-3 h-3" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                </div>
              )
            })}
            {isWorking && (
              <div className="flex items-center gap-2 text-xs text-app-muted" aria-live="polite">
                <Loader2 className="w-3.5 h-3.5 text-app-accent animate-spin" />
                <span className="animate-pulse">…</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
        {sendError && (
          <div className="mx-auto max-w-3xl text-xs text-red-400" role="alert">
            {sendError}
          </div>
        )}
      </div>

      {/* Shared Composer (Nothing under composer: no status line) */}
      <div className="p-3 border-t border-app bg-app-bg flex-shrink-0">
        <div className="max-w-3xl lg:max-w-4xl mx-auto">
          <AgentComposer
            onSendMessage={handleSendFromComposer}
            defaultModel={initialModel}
            defaultEffort={initialEffort}
            defaultCli={cliId}
            orchestratorAssigned={!!orchestrator}
            busy={isWorking}
            onOpenRouting={onOpenRouting}
            onSlashCommand={onSlashCommand}
          />
        </div>
      </div>
    </div>
  )
}
