import { BookmarkPlus, Check, Copy, FileText } from 'lucide-react'
import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import type React from 'react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ChatMessage } from '@/components/ui/chat-message'
import { FileThumbnail } from '@/components/ui/file-thumbnail'
import type { CliNotice } from '../../../../../run/executors/cli-failure'
import {
  getDefaultChatAgent,
  getSessionContext,
  getTimeline,
  type TimelineResponse,
} from '../../api/chat'
import type { PendingApproval } from '../../api/runs'
import { type ConfigResponse, getConfig } from '../../api/settings'
import { useStickToBottom } from '../../hooks/useStickToBottom'
import { useStopChatTurn } from '../../hooks/useStopChatTurn'
import { useUserProfile } from '../../hooks/useUserProfile'
import type { ChatAttachment, ChatThread, SessionStatus, TaskItem } from '../../types/orchestos'
import { AgentComposer, type CliId } from '../common/AgentComposer'
import {
  type EntranceMode,
  enterSession,
  entranceModes,
  hasStreamed,
  markEntered,
  noteLocalSend,
  noteStreamed,
} from '../thread/entrance'
import { StoppedResponse } from '../thread/StoppedResponse'
import { TaskCard } from '../thread/TaskCard'
import { ThreadEmpty } from '../thread/ThreadEmpty'
import { ThreadMarkdown } from '../thread/ThreadMarkdown'
import { ThreadThinking } from '../thread/ThreadThinking'
import { ThreadTools } from '../thread/ThreadTools'
import { buildTaskCards } from '../thread/taskCards'
import { formatElapsed, livePhase } from '../thread/thinking'
import { RememberDialog } from './RememberDialog'

interface OrchestChatViewProps {
  tasks?: TaskItem[]
  approvals?: Record<string, PendingApproval[]>
  thread?: ChatThread
  projectExists?: boolean
  projectName?: string
  onSendMessage: (
    content: string,
    attachments?: ChatAttachment[],
    agent?: string,
    model?: string,
    effort?: string,
    approvalMode?: import('../../types/orchestos').ApprovalMode,
  ) => unknown
  onApproveHeldTask?: (taskId: string) => void | Promise<void>
  onRejectHeldTask?: (taskId: string) => void | Promise<void>
  onViewEvidence?: (runId: string) => void | Promise<void>
  onRetryTask?: (taskId: string) => void | Promise<void>
  onCommitRunTask?: (taskId: string, files: string[]) => void | Promise<void>
  sessionStatus?: SessionStatus | null
  onSlashCommand?: (command: string, argument?: string) => void
  onTurnSettled?: () => void
  onOpenRouting?: () => void
}

// Se lee en cada render: el hook de motion no reacciona a un cambio de la preferencia en caliente.
const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export const OrchestChatView: React.FC<OrchestChatViewProps> = ({
  thread,
  tasks = [],
  approvals = {},
  projectExists = true,
  projectName,
  onSendMessage,
  onApproveHeldTask,
  onRejectHeldTask,
  onRetryTask,
  onViewEvidence,
  onCommitRunTask,
  sessionStatus,
  onSlashCommand,
  onOpenRouting,
  onTurnSettled,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const { stickToBottom } = useStickToBottom(scrollContainerRef, contentRef)
  const [rememberMessage, setRememberMessage] = useState<{
    id: string
    content: string
    sessionId: string
  } | null>(null)
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)
  const [isWorking, setIsWorking] = useState(false)
  const working = isWorking || thread?.running === true
  // Ref: el padre pasa una flecha nueva en cada render y no debe reiniciar el poll.
  const onTurnSettledRef = useRef(onTurnSettled)
  onTurnSettledRef.current = onTurnSettled
  const sendLock = useRef(false)
  const [taskActionErrors, setTaskActionErrors] = useState<Record<string, string>>({})
  const [reportActionErrors, setReportActionErrors] = useState<Record<string, string>>({})
  const [busyReportActions, setBusyReportActions] = useState<Record<string, boolean>>({})
  const [sendNotice, setSendNotice] = useState<CliNotice | null>(null)
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
  const [permissions, setPermissions] = useState<NonNullable<ConfigResponse['permissions']> | null>(
    null,
  )
  const lastProjectId = useRef(thread?.projectId)
  const [liveTimeline, setLiveTimeline] = useState<TimelineResponse | null>(null)
  const [composerModel, setComposerModel] = useState('')
  const profile = useUserProfile()

  useEffect(() => {
    let disposed = false
    const projectId = thread?.projectId
    if (lastProjectId.current !== projectId) {
      lastProjectId.current = projectId
      setOrchestrator(undefined)
      setPermissions(null)
    }
    if (projectId && !projectExists) {
      setOrchestrator(null)
      return
    }
    const controller = new AbortController()
    void getConfig(projectId ?? undefined, controller.signal)
      .then((config) => {
        if (disposed) return
        setOrchestrator(config.roleAssignments?.orchestrator ?? null)
        setPermissions(config.permissions ?? null)
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
  const messagesLoaded = thread?.messagesLoaded !== false
  // UI.24.7 — la entrada se decide una vez por instancia (la ref) con un registro de módulo
  // que sobrevive a los re-montajes; `markEntered` corre tras el commit.
  const decidedEntrance = useRef(new Map<string, EntranceMode>())
  const decidedSession = useRef<string | undefined>(undefined)
  if (decidedSession.current !== sessionId) {
    decidedSession.current = sessionId
    if (sessionId) enterSession(sessionId)
    decidedEntrance.current = new Map()
  }
  const entrances = sessionId ? entranceModes(sessionId, messages) : new Map<string, EntranceMode>()
  for (const message of messages) {
    if (!decidedEntrance.current.has(message.id)) {
      decidedEntrance.current.set(message.id, entrances.get(message.id) ?? 'static')
    }
  }
  const entranceOf = (id: string): EntranceMode => decidedEntrance.current.get(id) ?? 'static'
  const motionProps = (mode: EntranceMode) =>
    mode === 'animate' && !prefersReducedMotion() ? {} : { initial: false as const }
  useEffect(() => {
    if (sessionId) markEntered(sessionId, messages, messagesLoaded)
  }, [sessionId, messages, messagesLoaded])
  // biome-ignore lint/correctness/useExhaustiveDependencies: nuevos mensajes invalidan el contexto compartido del composer.
  useEffect(() => {
    if (!sessionId || !projectExists) return
    const controller = new AbortController()
    void getSessionContext(
      sessionId,
      composerModel,
      thread?.projectId ?? null,
      controller.signal,
    ).catch(() => {})
    return () => {
      controller.abort()
    }
  }, [sessionId, composerModel, messages.length, thread?.projectId, projectExists])
  // Abrir otra conversación siempre la muestra desde el último mensaje.
  // biome-ignore lint/correctness/useExhaustiveDependencies: solo al cambiar de sesión.
  useEffect(() => stickToBottom(), [sessionId, stickToBottom])

  useEffect(() => {
    if (!working || !sessionId || !projectExists) {
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
          if (disposed) return
          setLiveTimeline(timeline)
          if (!isWorking && !timeline.pending) onTurnSettledRef.current?.()
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
  }, [working, isWorking, sessionId, thread?.projectId, projectExists])
  const liveText = liveTimeline?.live?.text ?? ''
  const liveMode = useRef<EntranceMode | null>(null)
  if (!liveText) liveMode.current = null
  else if (liveMode.current === null)
    liveMode.current = sessionId && hasStreamed(sessionId) ? 'static' : 'animate'
  useEffect(() => {
    if (sessionId && liveText) noteStreamed(sessionId)
  }, [sessionId, liveText])
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
  const stop = useStopChatTurn(
    sessionId,
    liveTurn?.status === 'pending' ? liveTurn.id : undefined,
    working,
    thread?.projectId ?? null,
  )
  const [workStartedAt, setWorkStartedAt] = useState(0)
  const [nowMs, setNowMs] = useState(0)
  useEffect(() => {
    if (!working) return
    const start = Date.now()
    setWorkStartedAt(start)
    setNowMs(start)
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [working])
  const [defaultAgent, setDefaultAgent] = useState<string | null | undefined>(undefined)
  useEffect(() => {
    let disposed = false
    void getDefaultChatAgent()
      .then(({ agent }) => {
        if (!disposed) setDefaultAgent(agent)
      })
      .catch(() => {
        if (!disposed) setDefaultAgent(null)
      })
    return () => {
      disposed = true
    }
  }, [])
  const cliId: CliId =
    thread?.agent && thread.agent !== 'local' ? thread.agent : (defaultAgent ?? 'api')
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
    _isShellCmd?: boolean,
    approvalMode?: import('../../types/orchestos').ApprovalMode,
  ) => {
    if (sendLock.current) return false
    sendLock.current = true
    setSendError(null)
    setSendNotice(null)
    if (sessionId) noteLocalSend(sessionId)
    setIsWorking(true)
    stickToBottom()
    try {
      const accepted = await onSendMessage(text, attachments, cli, model, effort, approvalMode)
      return accepted !== false
    } catch (error) {
      setSendError(error instanceof Error ? error.message : String(error))
      setSendNotice((error as { notice?: CliNotice })?.notice ?? null)
      return false
    } finally {
      sendLock.current = false
      setIsWorking(false)
    }
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex-1 flex flex-col h-full text-app overflow-hidden relative select-none">
        {/* Scrollable messages container */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 [mask-image:linear-gradient(to_bottom,transparent,#000_32px)]"
        >
          <div ref={contentRef}>
            {messages.length === 0 ? (
              <ThreadEmpty title={projectName || 'Chat'}>
                {profile.codes === null && (
                  <div className="mt-4 rounded-card border border-app bg-app-surface p-4 space-y-3">
                    <p className="text-sm font-medium text-app">Do you write code?</p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="compact"
                        disabled={profile.saving}
                        onClick={() => void profile.save(true)}
                      >
                        I write code
                      </Button>
                      <Button
                        size="compact"
                        variant="secondary"
                        disabled={profile.saving}
                        onClick={() => void profile.save(false)}
                      >
                        I don't write code
                      </Button>
                    </div>
                  </div>
                )}
                {profile.error && (
                  <p role="alert" className="mt-2 text-sm text-rose-400">
                    {profile.error}
                  </p>
                )}
              </ThreadEmpty>
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
                          {...motionProps(entranceOf(msg.id))}
                          data-entered={entranceOf(msg.id)}
                          layout={false}
                          className="max-w-2xl select-text"
                          actions={
                            <>
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
                              {thread?.projectId && projectExists && (
                                <button
                                  type="button"
                                  title="Remember"
                                  aria-label="Remember"
                                  className="p-1 rounded-control text-app-muted hover:text-app transition-colors"
                                  onClick={() =>
                                    setRememberMessage({
                                      id: msg.id,
                                      content: msg.content,
                                      sessionId: thread.id,
                                    })
                                  }
                                >
                                  <BookmarkPlus className="w-3 h-3" />
                                </button>
                              )}
                            </>
                          }
                        >
                          {/* Attachments if any */}
                          {msg.attachments && msg.attachments.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mb-2">
                              {msg.attachments.map((att) =>
                                att.file ? (
                                  <div
                                    key={att.id}
                                    data-attachment-name={att.name}
                                    title={att.name}
                                  >
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
                        {...motionProps(entranceOf(msg.id))}
                        data-entered={entranceOf(msg.id)}
                        layout={false}
                        className="max-w-full w-full select-text"
                        actions={
                          <>
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
                            {thread?.projectId && projectExists && (
                              <button
                                type="button"
                                title="Remember"
                                aria-label="Remember"
                                className="p-1 rounded-control text-app-muted hover:text-app transition-colors"
                                onClick={() =>
                                  setRememberMessage({
                                    id: msg.id,
                                    content: msg.content,
                                    sessionId: thread.id,
                                  })
                                }
                              >
                                <BookmarkPlus className="w-3 h-3" />
                              </button>
                            )}
                          </>
                        }
                      >
                        {((msg.reasoning?.length ?? 0) > 0 || (msg.notices?.length ?? 0) > 0) && (
                          <div className="mb-3 whitespace-normal">
                            <ThreadThinking
                              active={false}
                              label={
                                msg.thoughtMs === undefined
                                  ? 'Thought'
                                  : `Thought for ${formatElapsed(msg.thoughtMs)}`
                              }
                              steps={msg.reasoning ?? []}
                              notices={msg.notices}
                            />
                          </div>
                        )}
                        {msg.toolCalls && msg.toolCalls.length > 0 && (
                          <div className="mb-3 whitespace-normal">
                            <ThreadTools tools={msg.toolCalls} />
                          </div>
                        )}
                        {(!showCard || showCard.showAnchorText) && (
                          <ThreadMarkdown
                            text={showCard ? showCard.anchorText : msg.content}
                            streaming={false}
                          />
                        )}
                        <StoppedResponse stopped={msg.stopped} />
                        {showCard && (
                          <TaskCard
                            card={
                              tasks.some(
                                (task) => task.id === showCard.taskId && task.status === 'running',
                              )
                                ? { ...showCard, state: 'running' }
                                : showCard
                            }
                            activeRunId={tasks.find((task) => task.id === showCard.taskId)?.runId}
                            approvals={
                              approvals[
                                tasks.find((task) => task.id === showCard.taskId)?.runId ?? ''
                              ] ?? []
                            }
                            projectId={thread?.projectId}
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
                            onViewEvidence={(runId) =>
                              runReportAction(showCard.actionKey, () => onViewEvidence?.(runId))
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
                {working && liveText && (
                  <ChatMessage
                    key="live"
                    from="assistant"
                    {...motionProps(liveMode.current ?? 'static')}
                    data-entered={liveMode.current ?? 'static'}
                    layout={false}
                    aria-live="polite"
                    className="max-w-full w-full select-text"
                  >
                    <ThreadMarkdown text={liveText} streaming />
                  </ChatMessage>
                )}
                <AnimatePresence initial={false}>
                  {working && (
                    <motion.div
                      key="thinking"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                    >
                      <ThreadThinking
                        active
                        label={livePhase(liveTurn, Boolean(liveText))}
                        elapsed={formatElapsed(nowMs - workStartedAt)}
                        steps={liveReasoning}
                        notices={(liveTurn?.steps ?? []).flatMap((step) =>
                          step.notice ? [step.notice] : [],
                        )}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
          {sendError && (
            <div className="mx-auto max-w-3xl text-sm text-app-error" role="alert">
              {sendError}
              {sendNotice?.detail && (
                <details className="mt-2 text-muted-foreground">
                  <summary className="cursor-pointer text-xs">Details</summary>
                  <pre className="whitespace-pre-wrap break-words text-xs">{sendNotice.detail}</pre>
                </details>
              )}
            </div>
          )}
        </div>

        {/* Shared Composer (Nothing under composer: no status line) */}
        <div
          data-composer-region
          data-permission-mode={thread?.projectId ? permissions?.mode : undefined}
          className="p-3 flex-shrink-0"
        >
          <div className="max-w-3xl lg:max-w-4xl mx-auto">
            <AgentComposer
              onSendMessage={handleSendFromComposer}
              hasProject={!!thread?.projectId}
              projectId={thread?.projectId ?? undefined}
              contextSessionId={sessionId}
              defaultModel={initialModel}
              defaultEffort={initialEffort}
              defaultCli={cliId}
              orchestratorAssigned={!!orchestrator}
              orchestratorLoading={
                orchestrator === undefined || (!thread && defaultAgent === undefined)
              }
              busy={working}
              onStop={stop.onStop}
              stopping={stop.stopping}
              onOpenRouting={onOpenRouting}
              onSlashCommand={onSlashCommand}
              onSelectionChange={(_cli, model) => setComposerModel(model)}
            />
          </div>
        </div>
      </div>
      {rememberMessage &&
        rememberMessage.sessionId === sessionId &&
        thread?.projectId &&
        sessionId && (
          <RememberDialog
            key={`${sessionId}:${rememberMessage.id}`}
            projectId={thread.projectId}
            sessionId={sessionId}
            messageId={rememberMessage.id}
            content={rememberMessage.content}
            onClose={() => setRememberMessage(null)}
          />
        )}
    </MotionConfig>
  )
}
