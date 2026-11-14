import { Check, ChevronDown, ChevronRight, Copy, Terminal, X } from 'lucide-react'
import type React from 'react'
import { useEffect, useRef, useState } from 'react'
import type { InboundSessionMessage } from '@/api/chat'
import { ChatMessage } from '@/components/ui/chat-message'
import { FileThumbnail } from '@/components/ui/file-thumbnail'
import type { ChatMessageRow, TimelineStep, TimelineTurn } from '../../api/chat'
import { getSessionContext, getTimeline, type TimelineResponse } from '../../api/chat'
import type { PendingApproval } from '../../api/runs'
import { type ConfigResponse, getConfig } from '../../api/settings'
import { useStickToBottom } from '../../hooks/useStickToBottom'
import { useStopChatTurn } from '../../hooks/useStopChatTurn'
import type {
  AgentItem,
  SessionStatus as ApiSessionStatus,
  ApprovalMode,
  ChatAttachment,
  ProjectItem,
  TaskItem,
  ChatMessage as ThreadMessage,
} from '../../types/orchestos'
import { AgentComposer, type CliId } from '../common/AgentComposer'
import { answerText } from '../thread/activity'
import { InboundSessionMessageBlock, SessionMessageCard } from '../thread/SessionMessageCard'
import { StoppedResponse } from '../thread/StoppedResponse'
import { TaskCard } from '../thread/TaskCard'
import { ThreadMarkdown } from '../thread/ThreadMarkdown'
import { TurnActivity } from '../thread/TurnActivity'
import { buildTaskCards } from '../thread/taskCards'
import { formatElapsed, parseDbTime } from '../thread/thinking'
import { assistantCopyTarget } from './copy-target'
import { resolveNewSessionAgent } from './new-session-agent'

interface OrchestDevWorkspaceProps {
  activeProject: ProjectItem
  messages?: ThreadMessage[]
  tasks?: TaskItem[]
  approvals?: Record<string, PendingApproval[]>
  onApproveHeldTask?: (taskId: string) => void | Promise<void>
  onRejectHeldTask?: (taskId: string) => void | Promise<void>
  onRetryTask?: (taskId: string) => void | Promise<void>
  onCommitRunTask?: (taskId: string, files: string[]) => void | Promise<void>
  onViewEvidence?: (runId: string) => void | Promise<void>
  activeAgent?: AgentItem | null
  newSessionAgent?: string
  onCloseAgent?: (agentId: string) => void
  onRunCommand?: (cmd: string) => void
  onSelectAgent?: (agentId: string) => void
  onSendMessage?: (
    content: string,
    attachments?: ChatAttachment[],
    agent?: string,
    model?: string,
    effort?: string,
    approvalMode?: ApprovalMode,
    // biome-ignore lint/suspicious/noConfusingVoidType: preserve void callbacks alongside async acceptance.
  ) => void | Promise<boolean>
  onTimelinePending?: (sessionId: string, pending: boolean) => void
  sessionStatus?: ApiSessionStatus
  onSlashCommand?: (command: string, argument?: string) => void
}

export type SessionStatus = 'working' | 'waiting for approval' | 'done' | 'failed'

interface DevExchangeData {
  id: string
  userMessage?: ChatMessageRow
  assistantMessage?: ChatMessageRow
  turn?: TimelineTurn
  steps: TimelineStep[]
  commands: TimelineResponse['commands']
  inbound?: InboundSessionMessage
  optimistic?: boolean
}

function buildExchanges(timeline: TimelineResponse | null): DevExchangeData[] {
  if (!timeline) return []
  const exchanges: DevExchangeData[] = timeline.turns
    .map((turn) => ({
      id: turn.id,
      turn,
      steps: turn.steps,
      commands: [] as TimelineResponse['commands'],
      userMessage: timeline.messages.find(
        (message) => message.role === 'user' && message.turnId === turn.id,
      ),
      assistantMessage: timeline.messages.find(
        (message) => message.role === 'assistant' && message.turnId === turn.id,
      ),
    }))
    .sort((a, b) => Date.parse(a.turn?.createdAt ?? '') - Date.parse(b.turn?.createdAt ?? ''))
  const turnExchanges = new Map(exchanges.map((exchange) => [exchange.id, exchange]))
  const legacyMessages = timeline.messages.filter((message) => {
    if (message.turnId) return false
    if (message.role !== 'user') return true
    const next = timeline.messages.find((candidate) => candidate.id === message.id + 1)
    const exchange =
      next?.role === 'assistant' && next.turnId ? turnExchanges.get(next.turnId) : null
    if (!exchange) return true
    exchange.userMessage = message
    return false
  })
  for (const message of legacyMessages) {
    if (message.role === 'user') {
      exchanges.push({ id: `legacy-${message.id}`, userMessage: message, steps: [], commands: [] })
      continue
    }
    const preceding = [...exchanges]
      .reverse()
      .find((exchange) => exchange.userMessage && !exchange.assistantMessage && !exchange.turn)
    if (preceding) preceding.assistantMessage = message
    else
      exchanges.push({
        id: `legacy-${message.id}`,
        assistantMessage: message,
        steps: [],
        commands: [],
      })
  }
  for (const event of timeline.events ?? []) {
    if (event.kind === 'session-message')
      exchanges.push({ id: `session-message-${event.id}`, inbound: event, steps: [], commands: [] })
  }
  exchanges.sort((a, b) => {
    const aAt =
      a.inbound?.at ??
      a.turn?.createdAt ??
      a.userMessage?.createdAt ??
      a.assistantMessage?.createdAt ??
      ''
    const bAt =
      b.inbound?.at ??
      b.turn?.createdAt ??
      b.userMessage?.createdAt ??
      b.assistantMessage?.createdAt ??
      ''
    return Date.parse(aAt) - Date.parse(bAt)
  })
  const commandExchanges = exchanges.filter((exchange) => !exchange.inbound)
  for (const command of timeline.commands) {
    const at = Date.parse(command.createdAt)
    const first = commandExchanges[0]
    const firstStart = Date.parse(first?.turn?.createdAt ?? first?.userMessage?.createdAt ?? '')
    const containing =
      at < firstStart
        ? first
        : commandExchanges.find((exchange) => {
            const start = Date.parse(
              exchange.turn?.createdAt ?? exchange.userMessage?.createdAt ?? '',
            )
            const next = commandExchanges[commandExchanges.indexOf(exchange) + 1]
            const end = next
              ? Date.parse(next.turn?.createdAt ?? next.userMessage?.createdAt ?? '')
              : Number.POSITIVE_INFINITY
            return Number.isFinite(at) && at >= start && at < end
          })
    ;(containing ?? commandExchanges.at(-1))?.commands.push(command)
  }
  return exchanges
}

export const OrchestDevWorkspace: React.FC<OrchestDevWorkspaceProps> = ({
  activeProject,
  messages = [],
  tasks = [],
  approvals = {},
  onApproveHeldTask,
  onRejectHeldTask,
  onRetryTask,
  onCommitRunTask,
  onViewEvidence,
  activeAgent,
  newSessionAgent,
  onRunCommand,
  onSelectAgent,
  onSendMessage,
  onTimelinePending,
  onSlashCommand,
  sessionStatus: apiSessionStatus,
}) => {
  const [permissions, setPermissions] = useState<ConfigResponse['permissions']>(undefined)
  const [orchestrator, setOrchestrator] = useState<
    | NonNullable<ConfigResponse['roleAssignments']>[string]
    | undefined
    | { agent: string; model?: string; effort?: string }
  >(undefined)
  useEffect(() => {
    let disposed = false
    setOrchestrator(undefined)
    setPermissions(undefined)
    const controller = new AbortController()
    void getConfig(activeProject.id, controller.signal)
      .then((config) => {
        if (!disposed) {
          setPermissions(config.permissions)
          setOrchestrator(
            newSessionAgent
              ? resolveNewSessionAgent(newSessionAgent, config.roleAssignments)
              : (config.roleAssignments?.orchestrator ?? null),
          )
        }
      })
      .catch(() => {
        if (!disposed) setOrchestrator(null)
      })
    return () => {
      disposed = true
      controller.abort()
    }
  }, [activeProject.id, newSessionAgent])
  // Session status state: amber pulsing dot when waiting for approval
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('done')
  const [isFailingBashExpanded, setIsFailingBashExpanded] = useState(false)
  const [isPassingBashExpanded, setIsPassingBashExpanded] = useState(false)

  // Approval state
  const [approvalState, setApprovalState] = useState<'pending' | 'approved' | 'denied'>('pending')

  // Copy buttons state
  const [copiedFail, setCopiedFail] = useState(false)
  const [copiedPass, setCopiedPass] = useState(false)
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)

  const timelineContainerRef = useRef<HTMLDivElement>(null)
  const timelineContentRef = useRef<HTMLDivElement>(null)
  const { stickToBottom } = useStickToBottom(timelineContainerRef, timelineContentRef)
  // Abrir otro agente siempre lo muestra desde el final de su línea de tiempo.
  // biome-ignore lint/correctness/useExhaustiveDependencies: solo al cambiar de agente.
  useEffect(() => stickToBottom(), [activeAgent?.id, stickToBottom])
  const [taskActionErrors, setTaskActionErrors] = useState<Record<string, string>>({})
  const [busyTaskActions, setBusyTaskActions] = useState<Record<string, boolean>>({})
  const taskCards = buildTaskCards(messages, busyTaskActions)
  const runTaskAction = (key: string, action: () => void | Promise<void> | undefined) => {
    setBusyTaskActions((previous) => ({ ...previous, [key]: true }))
    setTaskActionErrors((previous) => ({ ...previous, [key]: '' }))
    void Promise.resolve()
      .then(action)
      .catch((error: unknown) =>
        setTaskActionErrors((previous) => ({
          ...previous,
          [key]: error instanceof Error ? error.message : String(error),
        })),
      )
      .finally(() => setBusyTaskActions((previous) => ({ ...previous, [key]: false })))
  }
  const [timeline, setTimeline] = useState<TimelineResponse | null>(null)
  const [pendingUserMessage, setPendingUserMessage] = useState<{
    content: string
    sentAt: number
  } | null>(null)

  // biome-ignore lint/correctness/useExhaustiveDependencies: cambiar de agente descarta el mensaje optimista y reinicia el estado local.
  useEffect(() => {
    setPendingUserMessage(null)
    setSessionStatus('done')
  }, [activeAgent?.id])

  useEffect(() => {
    if (!activeAgent?.id) {
      setTimeline(null)
      return
    }
    let disposed = false
    const controllers = new Set<AbortController>()
    const refreshTimeline = () => {
      if (document.hidden) return Promise.resolve()
      const controller = new AbortController()
      controllers.add(controller)
      return getTimeline(activeAgent.id, activeAgent.projectId ?? null, controller.signal)
        .then((next) => {
          if (!disposed) {
            setTimeline(next)
            onTimelinePending?.(activeAgent.id, next.pending)
          }
        })
        .catch(() => {
          if (!disposed) setTimeline(null)
        })
        .finally(() => controllers.delete(controller))
    }
    void refreshTimeline()
    // USO.3: quieta basta cada 5 s; un turno en curso sigue a 300 ms.
    const pollInterval = sessionStatus === 'working' || timeline?.pending ? 300 : 5000
    const timer = window.setInterval(() => void refreshTimeline(), pollInterval)
    return () => {
      disposed = true
      window.clearInterval(timer)
      for (const controller of controllers) controller.abort()
    }
  }, [activeAgent?.id, activeAgent?.projectId, sessionStatus, timeline?.pending, onTimelinePending])

  // biome-ignore lint/correctness/useExhaustiveDependencies: los mensajes nuevos invalidan el contexto compartido del composer.
  useEffect(() => {
    // The fetch fills the shared cache that the composer ring reads.
    if (!activeAgent?.id) return
    const controller = new AbortController()
    void getSessionContext(
      activeAgent.id,
      activeAgent.model,
      activeAgent.projectId ?? null,
      controller.signal,
    ).catch(() => {})
    return () => {
      controller.abort()
    }
  }, [activeAgent?.id, activeAgent?.model, activeAgent?.projectId, timeline?.messages.length])

  const exchanges = buildExchanges(timeline)
  const isWorking = sessionStatus === 'working' || timeline?.pending === true
  const pendingTurn = timeline?.turns.find((turn) => turn.status === 'pending')
  const [nowMs, setNowMs] = useState(Date.now)
  useEffect(() => {
    if (!isWorking) return
    setNowMs(Date.now())
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [isWorking])
  const stop = useStopChatTurn(
    activeAgent?.id,
    pendingTurn?.id,
    isWorking,
    activeAgent?.projectId ?? null,
  )
  const persistedPendingMessage = (timeline?.messages ?? []).some(
    (message) =>
      message.role === 'user' &&
      message.content === pendingUserMessage?.content &&
      new Date(message.createdAt).getTime() >= (pendingUserMessage?.sentAt ?? 0) - 5000,
  )
  if (pendingUserMessage && !persistedPendingMessage) {
    const pendingExchange =
      exchanges.find((exchange) => exchange.id === timeline?.live?.turnId) ??
      [...exchanges].reverse().find((exchange) => exchange.turn && !exchange.assistantMessage)
    if (pendingExchange) pendingExchange.optimistic = true
    else
      exchanges.push({
        id: `optimistic-${pendingUserMessage.sentAt}`,
        steps: [],
        commands: [],
        optimistic: true,
      })
  }
  useEffect(() => {
    if (persistedPendingMessage) setPendingUserMessage(null)
  }, [persistedPendingMessage])
  // Derive CLI product identity
  const getCliId = (): CliId => {
    const model = (activeAgent?.model || 'claude').toLowerCase()
    if (model.includes('claude')) return 'claude'
    if (model.includes('codex') || model.includes('gpt')) return 'codex'
    if (model.includes('opencode')) return 'opencode'
    if (model.includes('deepseek')) return 'deepseek'
    return 'gemini'
  }

  const cliId = getCliId()
  const handleApprove = () => {
    setApprovalState('approved')
    setSessionStatus('working')
    setTimeout(() => {
      setSessionStatus('done')
    }, 1200)
  }

  const handleDeny = () => {
    setApprovalState('denied')
    setSessionStatus('failed')
  }

  const handleCopyBash = (text: string, type: 'fail' | 'pass') => {
    navigator.clipboard.writeText(text)
    if (type === 'fail') {
      setCopiedFail(true)
      setTimeout(() => setCopiedFail(false), 1500)
    } else {
      setCopiedPass(true)
      setTimeout(() => setCopiedPass(false), 1500)
    }
  }

  const handleCopyMessage = async (id: string, text: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedMessageId(id)
    window.setTimeout(
      () => setCopiedMessageId((current) => (current === id ? null : current)),
      1500,
    )
  }

  const sentAttachments = useRef(new Map<string, ChatAttachment[]>())

  const handleSendMessage = async (
    content: string,
    attachments?: ChatAttachment[],
    cli?: string,
    model?: string,
    effort?: string,
    isShellCmd?: boolean,
    approvalMode?: ApprovalMode,
  ) => {
    let sent = true
    if (!isShellCmd) {
      const sentAt = Date.now()
      // El servidor no persiste adjuntos: el hilo los recuerda por contenido del mensaje.
      if (attachments?.length) sentAttachments.current.set(content, attachments)
      setPendingUserMessage({ content, sentAt })
      setSessionStatus('working')
      try {
        const accepted = await onSendMessage?.(
          content,
          attachments,
          cli,
          model,
          effort,
          approvalMode,
        )
        sent = !!accepted
        setSessionStatus(accepted ? 'done' : 'failed')
        if (!accepted) setPendingUserMessage(null)
      } catch {
        sent = false
        setSessionStatus('failed')
        setPendingUserMessage(null)
      }
    } else {
      setSessionStatus('working')
    }

    if (isShellCmd && onRunCommand) {
      onRunCommand(content)
    }

    stickToBottom()
    return sent
  }

  const effectiveSessionStatus = apiSessionStatus?.clis.some((cli) => cli.available)
    ? sessionStatus
    : sessionStatus

  function DevExchange(exchange: DevExchangeData) {
    if (exchange.inbound)
      return <InboundSessionMessageBlock key={exchange.id} message={exchange.inbound} />
    const isCurrentExchange =
      timeline?.live?.turnId === exchange.id || exchange.turn?.status === 'pending'
    const exchangeUserMessage = exchange.userMessage
    const pendingForExchange = exchange.optimistic && pendingUserMessage
    const visibleUserMessage = pendingForExchange
      ? {
          content: pendingUserMessage.content,
          createdAt: new Date(pendingUserMessage.sentAt).toISOString(),
        }
      : exchangeUserMessage
    const steps = exchange.steps
    const failedCommands = exchange.commands.filter((command) => command.exitCode !== 0)
    const passedCommands = exchange.commands.filter((command) => command.exitCode === 0)
    const hasRealTurn = Boolean(
      exchangeUserMessage ||
        exchange.assistantMessage ||
        steps.length ||
        exchange.commands.length ||
        (isCurrentExchange && timeline?.pending),
    )
    // Lo intermedio ya está en la actividad; Codex emite su paso `text` al final, así que se filtra por contenido.
    const rawAssistantMessage =
      isCurrentExchange && timeline?.live?.text
        ? answerText(timeline.live.text, steps)
        : answerText(exchange.assistantMessage?.content ?? '', steps)
    const messageId = String(exchange.assistantMessage?.id)
    const card = [...taskCards.byTask.values()].find((item) => item.anchorId === messageId)
    const visibleAssistantMessage = taskCards.hidden.has(messageId)
      ? ''
      : card
        ? card.showAnchorText
          ? card.anchorText
          : ''
        : rawAssistantMessage
    const assistantCopy = assistantCopyTarget(exchange, visibleAssistantMessage)
    return (
      <div key={exchange.id} className="space-y-3 pt-2">
        {/* USER MESSAGE: no avatar, no "You" label; time only on hover */}
        {visibleUserMessage && (
          <div className="flex flex-col">
            <ChatMessage
              from="user"
              layout={false}
              className="max-w-2xl select-text"
              time={new Date(visibleUserMessage.createdAt).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
              actions={
                exchangeUserMessage && visibleUserMessage === exchangeUserMessage ? (
                  <button
                    type="button"
                    onClick={() =>
                      void handleCopyMessage(
                        exchangeUserMessage.id.toString(),
                        exchangeUserMessage.content,
                      )
                    }
                    className="p-1 rounded-control text-app-muted hover:text-app transition-colors"
                    title="Copy"
                    aria-label="Copy"
                  >
                    {copiedMessageId === exchangeUserMessage.id.toString() ? (
                      <Check className="w-3 h-3" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </button>
                ) : undefined
              }
            >
              {sentAttachments.current.get(visibleUserMessage.content)?.length ? (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {sentAttachments.current.get(visibleUserMessage.content)?.map((att) =>
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
                        <span>{att.name}</span>
                      </div>
                    ),
                  )}
                </div>
              ) : null}
              {visibleUserMessage.content}
            </ChatMessage>
          </div>
        )}

        {/* AGENT TURN: FLAT 32px TOOL ROWS (no card borders) */}
        {hasRealTurn && (
          <div className="space-y-1">
            <TurnActivity
              steps={exchange.steps}
              live={
                exchange.turn?.status === 'pending' || (exchange.optimistic && isWorking)
                  ? {
                      elapsed: formatElapsed(
                        nowMs -
                          (exchange.turn
                            ? parseDbTime(exchange.turn.createdAt)
                            : (pendingUserMessage?.sentAt ?? nowMs)),
                      ),
                    }
                  : undefined
              }
            />

            {/* 5. Failing Bash: command output and exit state */}
            {failedCommands.map((failedCommand) => {
              const failingBashOutput = [
                failedCommand.cmd,
                failedCommand.stdout,
                failedCommand.stderr,
              ]
                .filter(Boolean)
                .join('\n')
              return (
                <div key={failedCommand.id} className="text-xs">
                  <button
                    type="button"
                    onClick={() => setIsFailingBashExpanded(!isFailingBashExpanded)}
                    className="h-8 w-full flex items-center justify-between px-2 rounded-control hover:bg-app-surface/60 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Terminal className="w-3.5 h-3.5 text-app-muted flex-shrink-0" />
                      <span className="font-mono text-app-muted text-xs">Bash</span>
                      <span className="font-mono text-app text-xs truncate">
                        {failedCommand?.cmd}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <X className="w-3.5 h-3.5 text-rose-500" />
                      {isFailingBashExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5 text-app-muted" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-app-muted" />
                      )}
                    </div>
                  </button>

                  {/* Expanded Bash -> mono output, max height, scroll, copy icon */}
                  {isFailingBashExpanded && (
                    <div className="mt-1 mb-2 ml-5 relative rounded-control border border-app bg-[#0c1017] p-3 font-mono text-[11px]">
                      <button
                        type="button"
                        onClick={() => handleCopyBash(failingBashOutput, 'fail')}
                        className="absolute top-2 right-2 p-1 rounded-control text-app-muted hover:text-app bg-app-surface/40 hover:bg-app-surface transition-colors"
                        title="Copy output"
                        aria-label="Copy output"
                      >
                        {copiedFail ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <pre className="text-rose-300 leading-relaxed overflow-x-auto max-h-48 whitespace-pre">
                        {failingBashOutput}
                      </pre>
                    </div>
                  )}
                </div>
              )
            })}

            {/* 6. Passing Bash: command output and exit state */}
            {passedCommands.map((passedCommand) => {
              const passingBashOutput = [
                passedCommand.cmd,
                passedCommand.stdout,
                passedCommand.stderr,
              ]
                .filter(Boolean)
                .join('\n')
              return (
                <div key={passedCommand.id} className="text-xs">
                  <button
                    type="button"
                    onClick={() => setIsPassingBashExpanded(!isPassingBashExpanded)}
                    className="h-8 w-full flex items-center justify-between px-2 rounded-control hover:bg-app-surface/60 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Terminal className="w-3.5 h-3.5 text-app-muted flex-shrink-0" />
                      <span className="font-mono text-app-muted text-xs">Bash</span>
                      <span className="font-mono text-app text-xs truncate">
                        {passedCommand?.cmd}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      {isPassingBashExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5 text-app-muted" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5 text-app-muted" />
                      )}
                    </div>
                  </button>

                  {/* Expanded Bash -> mono output, max height, scroll, copy icon */}
                  {isPassingBashExpanded && (
                    <div className="mt-1 mb-2 ml-5 relative rounded-control border border-app bg-[#0c1017] p-3 font-mono text-[11px]">
                      <button
                        type="button"
                        onClick={() => handleCopyBash(passingBashOutput, 'pass')}
                        className="absolute top-2 right-2 p-1 rounded-control text-app-muted hover:text-app bg-app-surface/40 hover:bg-app-surface transition-colors"
                        title="Copy output"
                        aria-label="Copy output"
                      >
                        {copiedPass ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <pre className="text-emerald-300 leading-relaxed overflow-x-auto max-h-48 whitespace-pre">
                        {passingBashOutput}
                      </pre>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* 7. APPROVAL CARD: command or path, one-line reason, Approve / Deny */}
        {/* THE ONLY ELEMENT WITH AN ACCENT BORDER IN THE TURN */}
        {approvalState === 'pending' && false && (
          <div className="border border-app-accent rounded-card p-3 bg-app-surface text-app shadow-2xs space-y-2.5">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <div className="font-mono text-xs font-semibold text-app">{''}</div>
                <div className="text-xs text-app-muted leading-relaxed">{''}</div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={handleDeny}
                  className="px-2.5 py-1 rounded-control text-xs font-medium text-app-muted hover:text-app hover:bg-app-elevated border border-app transition-colors"
                >
                  Deny
                </button>
                <button
                  type="button"
                  onClick={handleApprove}
                  className="px-3 py-1 rounded-control text-xs font-medium bg-app-accent text-white hover:opacity-90 transition-opacity shadow-2xs"
                >
                  Approve
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 8. FINAL ANSWER IN MARKDOWN */}
        {hasRealTurn && (visibleAssistantMessage || exchange.assistantMessage?.stopped) && (
          <ChatMessage
            from="assistant"
            layout={false}
            data-dev-assistant-message
            className="max-w-full w-full select-text"
            actions={
              <button
                type="button"
                onClick={() => {
                  if (assistantCopy) void handleCopyMessage(assistantCopy.id, assistantCopy.text)
                }}
                className="p-1 rounded-control text-app-muted hover:text-app hover:bg-app-elevated transition-colors"
                title="Copy"
                aria-label="Copy"
              >
                {assistantCopy && copiedMessageId === assistantCopy.id ? (
                  <Check className="w-3 h-3" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>
            }
          >
            {visibleAssistantMessage && (
              <ThreadMarkdown
                text={visibleAssistantMessage}
                streaming={Boolean(isCurrentExchange && timeline?.pending)}
              />
            )}
            <StoppedResponse stopped={exchange.assistantMessage?.stopped} />
          </ChatMessage>
        )}
      </div>
    )
  }

  return (
    <main
      data-dev-new-session={!activeAgent ? '' : undefined}
      className={`flex-1 flex flex-col bg-app-bg text-app overflow-hidden ${activeAgent ? 'h-full relative select-none' : 'items-center justify-center p-8'}`}
    >
      {/* 1. TIMELINE (Centered, same max width as Chat) */}
      <div
        ref={timelineContainerRef}
        className={
          activeAgent
            ? 'flex-1 overflow-y-auto p-4 md:p-6 space-y-4 [mask-image:linear-gradient(to_bottom,transparent,#000_32px)]'
            : 'hidden'
        }
      >
        <div ref={timelineContentRef} className="max-w-3xl lg:max-w-4xl mx-auto space-y-3">
          {activeAgent && exchanges.map(DevExchange)}
          {activeAgent &&
            timeline?.messages.map((row) =>
              row.sessionMessage ? (
                <SessionMessageCard key={row.sessionMessage.id} message={row.sessionMessage} />
              ) : null,
            )}
          {activeAgent &&
            [...taskCards.byTask.values()].map((card) => {
              const task = tasks.find((item) => item.id === card.taskId)
              return (
                <TaskCard
                  key={card.taskId}
                  card={task?.status === 'running' ? { ...card, state: 'running' } : card}
                  activeRunId={task?.runId}
                  approvals={approvals[task?.runId ?? ''] ?? []}
                  projectId={activeProject.id}
                  error={taskActionErrors[card.actionKey]}
                  busy={Boolean(busyTaskActions[card.actionKey])}
                  onApprove={() =>
                    runTaskAction(card.actionKey, () => onApproveHeldTask?.(card.taskId))
                  }
                  onReject={() =>
                    runTaskAction(card.actionKey, () => onRejectHeldTask?.(card.taskId))
                  }
                  onRetry={() => runTaskAction(card.actionKey, () => onRetryTask?.(card.taskId))}
                  onCommit={(files) =>
                    runTaskAction(card.actionKey, () => onCommitRunTask?.(card.taskId, files))
                  }
                  onViewEvidence={(runId) =>
                    runTaskAction(card.actionKey, () => onViewEvidence?.(runId))
                  }
                />
              )
            })}
        </div>
      </div>

      {/* 2. COMPOSER (Chat and Dev share it) */}
      {/* Keep the composer mounted while a selected session hydrates: uploads belong to its draft. */}
      <div
        data-composer-region
        data-permission-mode={permissions?.mode}
        className={
          activeAgent ? 'p-3 bg-app-bg flex-shrink-0' : 'w-full max-w-3xl lg:max-w-4xl space-y-4'
        }
      >
        {!activeAgent && (
          <h1 className="text-lg font-bold text-app text-center">
            What should we work on in {activeProject.name}?
          </h1>
        )}
        <div className="max-w-3xl lg:max-w-4xl mx-auto">
          <AgentComposer
            shellMode
            onSendMessage={handleSendMessage}
            hasProject={!!(activeAgent ? activeAgent.projectId : activeProject.id)}
            projectId={(activeAgent ? activeAgent.projectId : activeProject.id) ?? undefined}
            busy={isWorking}
            onStop={stop.onStop}
            stopping={stop.stopping}
            contextSessionId={activeAgent?.id}
            defaultCli={
              activeAgent ? cliId : ((newSessionAgent ?? orchestrator?.agent ?? cliId) as CliId)
            }
            defaultModel={activeAgent ? activeAgent.model : orchestrator?.model}
            defaultEffort={activeAgent ? activeAgent.effort : orchestrator?.effort}
            lockedCli={activeAgent?.agent as CliId | undefined}
            useCliDefaultModel={!activeAgent && !!newSessionAgent && !orchestrator?.model}
            orchestratorLoading={!activeAgent && orchestrator === undefined}
            onSlashCommand={onSlashCommand}
          />
        </div>
      </div>
    </main>
  )
}
