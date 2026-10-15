import { Check, ChevronDown, ChevronUp, Copy, FileText } from 'lucide-react'
import type React from 'react'
import { useEffect, useRef, useState } from 'react'
import { ChatMessage } from '@/components/ui/chat-message'
import { FileThumbnail } from '@/components/ui/file-thumbnail'
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
import { TaskCard } from '../thread/TaskCard'
import { ThreadMarkdown } from '../thread/ThreadMarkdown'
import { ThreadThinking } from '../thread/ThreadThinking'
import { buildTaskCards } from '../thread/taskCards'
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
  // ERP.4.14: `undefined` = la config aún se lee; `null` = leída y sin orquestador.
  const [orchestrator, setOrchestrator] = useState<
    | {
        agent: string
        model: string
        effort?: string
      }
    | null
    | undefined
  >(undefined)
  const [liveTimeline, setLiveTimeline] = useState<TimelineResponse | null>(null)
  const [composerModel, setComposerModel] = useState('')
  const [sessionContext, setSessionContext] = useState<SessionContextResponse | null>(null)

  useEffect(() => {
    let disposed = false
    const projectId = thread?.projectId
    setOrchestrator(undefined)
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
  // UI.24.5 — una tarjeta por tarea; los reportes posteriores la alimentan y no son burbujas
  const taskCards = buildTaskCards(messages, busyReportActions)
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
              {messages
                .filter((msg) => !taskCards.hidden.has(msg.id))
                .map((msg) => {
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
                            {msg.attachments.map((att) =>
                              att.file ? (
                                <div key={att.id} data-attachment-name={att.name} title={att.name}>
                                  <FileThumbnail file={att.file} size={64} />
                                </div>
                              ) : (
                                <div
                                  key={att.id}
                                  data-attachment-name={att.name}
                                  className="flex items-center gap-1.5 px-2 py-0.5 rounded-control bg-app-bg border border-app text-[11px] text-app font-mono"
                                >
                                  <FileText className="w-3 h-3 text-app-accent" />
                                  <span>{att.name}</span>
                                </div>
                              ),
                            )}
                          </div>
                        )}

                        {msg.content}
                      </ChatMessage>
                    )
                  }

                  // Assistant message
                  const card = taskCards.byTask.get(msg.taskId ?? '')
                  const showCard = card?.anchorId === msg.id ? card : undefined
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
                                  <span className="font-mono text-app font-medium">
                                    {tool.name}
                                  </span>
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
                      {(!showCard || showCard.showAnchorText) && (
                        <ThreadMarkdown
                          text={showCard ? showCard.anchorText : msg.content}
                          streaming={false}
                        />
                      )}
                      {showCard && (
                        <TaskCard
                          card={showCard}
                          error={
                            taskActionErrors[showCard.taskId] ??
                            reportActionErrors[showCard.actionKey]
                          }
                          busy={Boolean(busyReportActions[showCard.actionKey])}
                          onApprove={() =>
                            void Promise.resolve(onApproveHeldTask?.(showCard.taskId)).catch(
                              (error: unknown) =>
                                setTaskActionErrors((prev) => ({
                                  ...prev,
                                  [showCard.taskId]:
                                    error instanceof Error ? error.message : String(error),
                                })),
                            )
                          }
                          onReject={() =>
                            void Promise.resolve(onRejectHeldTask?.(showCard.taskId)).catch(
                              (error: unknown) =>
                                setTaskActionErrors((prev) => ({
                                  ...prev,
                                  [showCard.taskId]:
                                    error instanceof Error ? error.message : String(error),
                                })),
                            )
                          }
                          onRetry={() =>
                            runReportAction(showCard.actionKey, () =>
                              onRetryTask?.(showCard.taskId),
                            )
                          }
                          onCommit={(files) =>
                            runReportAction(showCard.actionKey, () =>
                              onCommitRunTask?.(showCard.taskId, files),
                            )
                          }
                        />
                      )}
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
                  <ThreadMarkdown text={liveText} streaming />
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
      <div data-composer-region className="p-3 bg-app-bg flex-shrink-0">
        <div className="max-w-3xl lg:max-w-4xl mx-auto">
          <AgentComposer
            onSendMessage={handleSendFromComposer}
            defaultModel={initialModel}
            defaultEffort={initialEffort}
            defaultCli={cliId}
            orchestratorAssigned={!!orchestrator}
            orchestratorLoading={orchestrator === undefined}
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
