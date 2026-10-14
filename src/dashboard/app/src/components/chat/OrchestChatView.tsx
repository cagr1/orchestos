import { Check, ChevronDown, ChevronUp, Copy, FileText, RotateCw, X } from 'lucide-react'
import type React from 'react'
import { useEffect, useRef, useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ChatMessage } from '@/components/ui/chat-message'
import {
  getSessionContext,
  getTimeline,
  type SessionContextResponse,
  type TimelineResponse,
} from '../../api/chat'
import { getConfig } from '../../api/settings'
import { useStickToBottom } from '../../hooks/useStickToBottom'
import type { ChatAttachment, ChatThread, SessionStatus } from '../../types/orchestos'
import { AgentComposer, type CliId } from '../common/AgentComposer'
import { ContextRing } from '../common/ContextRing'
import { ProviderLogo } from '../common/ProviderLogos'
import { ThreadThinking } from '../thread/ThreadThinking'
import { formatElapsed, livePhase } from '../thread/thinking'

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
  onRetryTask?: (taskId: string) => void | Promise<void>
  onCommitRunTask?: (taskId: string, files: string[]) => void | Promise<void>
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
  onRetryTask,
  onCommitRunTask,
  sessionStatus,
  onSlashCommand,
  onOpenRouting,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const { stickToBottom } = useStickToBottom(scrollContainerRef, contentRef)
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)
  const [isWorking, setIsWorking] = useState(false)
  const sendLock = useRef(false)
  const [taskActionErrors, setTaskActionErrors] = useState<Record<string, string>>({})
  const [reportActionErrors, setReportActionErrors] = useState<Record<string, string>>({})
  const [busyReportActions, setBusyReportActions] = useState<Record<string, boolean>>({})
  const [sendError, setSendError] = useState<string | null>(null)
  const [orchestrator, setOrchestrator] = useState<{
    agent: string
    model: string
    effort?: string
  } | null>(null)
  const [liveTimeline, setLiveTimeline] = useState<TimelineResponse | null>(null)
  const [composerModel, setComposerModel] = useState('')
  const [sessionContext, setSessionContext] = useState<SessionContextResponse | null>(null)

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
  // ERP.4.13 — la acción de un reporte vive solo en el último mensaje del hilo con ese taskId
  const lastMessageIdByTask = new Map<string, string>()
  for (const message of messages) {
    if (message.taskId) lastMessageIdByTask.set(message.taskId, message.id)
  }
  const runReportAction = (messageId: string, action: () => void | Promise<void> | undefined) => {
    setBusyReportActions((prev) => ({ ...prev, [messageId]: true }))
    setReportActionErrors((prev) => {
      const { [messageId]: _cleared, ...rest } = prev
      return rest
    })
    void Promise.resolve(action())
      .catch((error: unknown) =>
        setReportActionErrors((prev) => ({
          ...prev,
          [messageId]: error instanceof Error ? error.message : String(error),
        })),
      )
      .finally(() => setBusyReportActions((prev) => ({ ...prev, [messageId]: false })))
  }
  const sessionId = thread?.id
  useEffect(() => {
    if (!sessionId) {
      setSessionContext(null)
      return
    }
    let disposed = false
    const controller = new AbortController()
    void getSessionContext(sessionId, composerModel, thread?.projectId ?? null, controller.signal)
      .then((context) => {
        if (!disposed) setSessionContext(context)
      })
      .catch(() => {
        if (!disposed) setSessionContext(null)
      })
    return () => {
      disposed = true
      controller.abort()
    }
  }, [sessionId, composerModel, messages.length, thread?.projectId])
  // Abrir otra conversación siempre la muestra desde el último mensaje.
  // biome-ignore lint/correctness/useExhaustiveDependencies: solo al cambiar de sesión.
  useEffect(() => stickToBottom(), [sessionId, stickToBottom])

  useEffect(() => {
    if (!isWorking || !sessionId) {
      setLiveTimeline(null)
      return
    }
    let disposed = false
    let controller: AbortController | null = null
    const refresh = () => {
      controller?.abort()
      controller = new AbortController()
      void getTimeline(sessionId, thread?.projectId ?? null, controller.signal)
        .then((timeline) => {
          if (!disposed) setLiveTimeline(timeline)
        })
        .catch(() => {})
    }
    refresh()
    const timer = window.setInterval(refresh, 300)
    return () => {
      disposed = true
      controller?.abort()
      window.clearInterval(timer)
    }
  }, [isWorking, sessionId, thread?.projectId])
  const liveText = liveTimeline?.live?.text ?? ''
  const liveTurnId = liveTimeline?.live?.turnId
  const liveTurn = liveTimeline
    ? liveTurnId
      ? liveTimeline.turns.find((turn) => turn.id === liveTurnId)
      : [...liveTimeline.turns].reverse().find((turn) => turn.status === 'pending')
    : undefined
  const liveReasoning = (liveTurn?.steps ?? [])
    .filter((step) => step.type === 'reasoning' && step.detail)
    .sort((a, b) => a.seq - b.seq)
    .map((step) => (step.detail as string).replace(/^\*\*(.*?)\*\*$/s, '$1'))
  const [workStartedAt, setWorkStartedAt] = useState(0)
  const [nowMs, setNowMs] = useState(0)
  useEffect(() => {
    if (!isWorking) return
    const start = Date.now()
    setWorkStartedAt(start)
    setNowMs(start)
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [isWorking])
  const cliId = (
    thread?.agent === 'claude' || thread?.agent === 'codex' || thread?.agent === 'api'
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
          : cliId === 'deepseek'
            ? 'DeepSeek'
            : 'Gemini'
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
    if (messages.at(-1)?.role === 'assistant') setIsWorking(false)
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
    stickToBottom()
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
    <div className="flex-1 flex flex-col h-full text-app overflow-hidden relative select-none">
      {/* 40px Session Header (Shared format with Dev) */}
      <header
        data-chat-header
        className="h-10 px-3.5 flex items-center justify-between flex-shrink-0 z-20"
      >
        {/* Left: CLI Product Logo (tooltip = name) + Title */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div title={cliName} className="flex-shrink-0 cursor-default">
            <ProviderLogo id={cliId} size={16} className="w-4 h-4" />
          </div>
          <span className="font-semibold text-[13px] text-app truncate max-w-sm">
            {thread?.title || 'Interactive Session'}
          </span>
        </div>

        {/* Context is rendered only when the selected session has real token telemetry. */}
        <div className="flex items-center flex-shrink-0">
          <ContextRing
            percent={sessionContext?.pct ?? undefined}
            model={sessionContext?.model ?? undefined}
            usedTokens={sessionContext?.used == null ? undefined : `${sessionContext.used}`}
            maxTokens={sessionContext?.window == null ? undefined : `${sessionContext.window}`}
          />
        </div>
      </header>

      {/* Scrollable messages container */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
        <div ref={contentRef}>
          {messages.length === 0 ? (
            <div className="max-w-3xl mx-auto pt-16 text-left space-y-2">
              <h1 className="text-lg font-bold text-app tracking-tight">Chat</h1>
              <p className="text-sm text-app-muted">
                Interactive session with {cliName}. Ask questions, run commands, or review
                architecture.
              </p>
            </div>
          ) : (
            <div
              data-ff
              data-thread-root
              className="max-w-3xl lg:max-w-4xl mx-auto flex flex-col gap-2"
            >
              {messages.map((msg) => {
                const isUser = msg.role === 'user'

                if (isUser) {
                  return (
                    <ChatMessage
                      key={msg.id}
                      from="user"
                      time={msg.timestamp}
                      initial={false}
                      layout={false}
                      className="max-w-2xl select-text"
                      actions={
                        <button
                          type="button"
                          onClick={() => void copyMessage(msg.id, msg.content)}
                          className="p-1 rounded-control text-app-muted hover:text-app transition-colors"
                          title="Copy"
                          aria-label="Copy"
                        >
                          {copiedMessageId === msg.id ? (
                            <Check className="w-3 h-3" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      }
                    >
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

                      {msg.content}
                    </ChatMessage>
                  )
                }

                // Assistant message
                return (
                  <ChatMessage
                    key={msg.id}
                    from="assistant"
                    initial={false}
                    layout={false}
                    className="max-w-full w-full select-text"
                    actions={
                      <button
                        type="button"
                        onClick={() => void copyMessage(msg.id, msg.content)}
                        className="p-1 rounded-control text-app-muted hover:text-app transition-colors"
                        title="Copy"
                        aria-label="Copy"
                      >
                        {copiedMessageId === msg.id ? (
                          <Check className="w-3 h-3" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    }
                  >
                    {msg.reasoning && msg.reasoning.length > 0 && (
                      <div className="mb-3 whitespace-normal">
                        <ThreadThinking
                          active={false}
                          label={
                            msg.thoughtMs === undefined
                              ? 'Thought'
                              : `Thought for ${formatElapsed(msg.thoughtMs)}`
                          }
                          steps={msg.reasoning}
                        />
                      </div>
                    )}
                    {msg.toolCalls && msg.toolCalls.length > 0 && (
                      <div className="space-y-1.5 mb-3 whitespace-normal">
                        <div className="text-[10px] font-bold text-app-muted uppercase tracking-wider px-1">
                          Tool executions
                        </div>
                        <div className="space-y-1">
                          {msg.toolCalls.map((tool, idx) => (
                            <div
                              key={idx}
                              className="p-2.5 rounded-control bg-app-surface border border-app flex items-center justify-between text-xs"
                            >
                              <div className="flex items-center gap-2 overflow-hidden">
                                <div className="w-2 h-2 rounded-full bg-app-success" />
                                <span className="font-mono text-app font-medium">{tool.name}</span>
                                <span className="text-app-muted text-[11px] truncate max-w-md">
                                  {JSON.stringify(tool.args)}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                {tool.durationMs && (
                                  <span className="font-mono text-[10px] text-app-muted">
                                    {tool.durationMs}ms
                                  </span>
                                )}
                                <span className="px-1.5 py-0.5 rounded-control text-[10px] font-mono bg-app-bg text-app-muted border border-app">
                                  {tool.status}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className="prose prose-invert max-w-none whitespace-normal [&>p]:mb-2 [&>ul]:list-disc [&>ul]:pl-4 [&>ol]:list-decimal [&>ol]:pl-4 [&>pre]:bg-app-bg [&>pre]:p-2.5 [&>pre]:rounded-control [&>pre]:border [&>pre]:border-app [&>pre]:font-mono [&>code]:bg-app-bg [&>code]:px-1 [&>code]:py-0.5 [&>code]:rounded-control [&>code]:border [&>code]:border-app [&>code]:font-mono [&>strong]:font-bold [&>strong]:text-app">
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
                      <div className="p-4 rounded-card bg-app-surface border border-app space-y-3 mt-3 whitespace-normal">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-app-warning" />
                            <span className="font-semibold text-xs text-app">
                              Task ready to run
                            </span>
                          </div>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-control bg-app-bg text-app-muted border border-app">
                            {msg.proposedTask.id}
                          </span>
                        </div>
                        <p className="text-xs text-app-muted">{msg.proposedTask.description}</p>
                        {taskActionErrors[msg.proposedTask.id] && (
                          <div role="alert" className="text-xs text-app-error">
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
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-app-accent hover:bg-app-accent-hover text-white text-xs font-semibold transition-colors"
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
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-app-surface hover:bg-app-elevated text-app text-xs font-medium border border-app transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                            Reject
                          </button>
                        </div>
                      </div>
                    )}
                    {msg.taskId &&
                      msg.taskReport &&
                      lastMessageIdByTask.get(msg.taskId) === msg.id &&
                      (() => {
                        const reportTaskId = msg.taskId
                        const dirtyFiles = msg.taskReport.dirtyFiles ?? []
                        const retryable =
                          msg.taskReport.outcome === 'pending' ||
                          msg.taskReport.outcome === 'failed'
                        if (dirtyFiles.length === 0 && !retryable) return null
                        const busy = Boolean(busyReportActions[msg.id])
                        const actionError = reportActionErrors[msg.id]
                        const buttons = (
                          <div className="flex items-center gap-2 pt-1">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() =>
                                runReportAction(msg.id, () =>
                                  dirtyFiles.length > 0
                                    ? onCommitRunTask?.(reportTaskId, dirtyFiles)
                                    : onRetryTask?.(reportTaskId),
                                )
                              }
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-control bg-app-accent hover:bg-app-accent-hover text-white text-xs font-semibold transition-colors disabled:opacity-60"
                            >
                              {dirtyFiles.length > 0 ? (
                                <Check className="w-3.5 h-3.5" />
                              ) : (
                                <RotateCw className="w-3.5 h-3.5" />
                              )}
                              {dirtyFiles.length > 0 ? 'Commit & Run' : 'Retry'}
                            </button>
                          </div>
                        )
                        if (dirtyFiles.length === 0)
                          return (
                            <>
                              {actionError && (
                                <div role="alert" className="text-xs text-app-error mt-3">
                                  {actionError}
                                </div>
                              )}
                              {buttons}
                            </>
                          )
                        return (
                          <div className="p-4 rounded-card bg-app-surface border border-app space-y-3 mt-3 whitespace-normal">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-app-warning" />
                                <span className="font-semibold text-xs text-app">
                                  Uncommitted changes
                                </span>
                              </div>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded-control bg-app-bg text-app-muted border border-app">
                                {reportTaskId}
                              </span>
                            </div>
                            <div className="text-xs text-app-muted font-mono">
                              {dirtyFiles.map((file) => (
                                <div key={file}>{file}</div>
                              ))}
                            </div>
                            {actionError && (
                              <div role="alert" className="text-xs text-app-error">
                                {actionError}
                              </div>
                            )}
                            {buttons}
                          </div>
                        )
                      })()}
                  </ChatMessage>
                )
              })}
              {isWorking && liveText && (
                <ChatMessage
                  from="assistant"
                  initial={false}
                  layout={false}
                  aria-live="polite"
                  className="max-w-full w-full select-text"
                >
                  <div className="prose prose-invert max-w-none whitespace-normal [&>p]:mb-2 [&>ul]:list-disc [&>ul]:pl-4 [&>ol]:list-decimal [&>ol]:pl-4 [&>pre]:bg-app-bg [&>pre]:p-2.5 [&>pre]:rounded-control [&>pre]:border [&>pre]:border-app [&>pre]:font-mono [&>code]:bg-app-bg [&>code]:px-1 [&>code]:py-0.5 [&>code]:rounded-control [&>code]:border [&>code]:border-app [&>code]:font-mono [&>strong]:font-bold [&>strong]:text-app">
                    <Markdown remarkPlugins={[remarkGfm]}>{liveText}</Markdown>
                  </div>
                </ChatMessage>
              )}
              {isWorking && (
                <ThreadThinking
                  active
                  label={livePhase(liveTurn, Boolean(liveText))}
                  elapsed={formatElapsed(nowMs - workStartedAt)}
                  steps={liveReasoning}
                />
              )}
            </div>
          )}
        </div>
        {sendError && (
          <div className="mx-auto max-w-3xl text-sm text-app-error" role="alert">
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
            onSelectionChange={(_cli, model) => setComposerModel(model)}
          />
        </div>
      </div>
    </div>
  )
}
