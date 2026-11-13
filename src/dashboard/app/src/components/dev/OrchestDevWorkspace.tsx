import {
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  FilePen,
  FileText,
  Loader2,
  Search,
  Sparkles,
  Terminal,
  X,
} from 'lucide-react'
import type React from 'react'
import { useEffect, useRef, useState } from 'react'
import { ChatMessage } from '@/components/ui/chat-message'
import { FileThumbnail } from '@/components/ui/file-thumbnail'
import type { ChatMessageRow, TimelineStep, TimelineTurn } from '../../api/chat'
import { getSessionContext, getTimeline, type TimelineResponse } from '../../api/chat'
import { type ConfigResponse, getConfig } from '../../api/settings'
import { useStickToBottom } from '../../hooks/useStickToBottom'
import { useStopChatTurn } from '../../hooks/useStopChatTurn'
import type {
  AgentItem,
  SessionStatus as ApiSessionStatus,
  ApprovalMode,
  ChatAttachment,
  ProjectItem,
} from '../../types/orchestos'
import { AgentComposer, type CliId } from '../common/AgentComposer'
import { StoppedResponse } from '../thread/StoppedResponse'
import { ThreadMarkdown } from '../thread/ThreadMarkdown'
import { assistantCopyTarget } from './copy-target'
import { resolveNewSessionAgent } from './new-session-agent'

interface OrchestDevWorkspaceProps {
  activeProject: ProjectItem
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
  exchanges.sort((a, b) => {
    const aAt = a.turn?.createdAt ?? a.userMessage?.createdAt ?? a.assistantMessage?.createdAt ?? ''
    const bAt = b.turn?.createdAt ?? b.userMessage?.createdAt ?? b.assistantMessage?.createdAt ?? ''
    return Date.parse(aAt) - Date.parse(bAt)
  })
  for (const command of timeline.commands) {
    const at = Date.parse(command.createdAt)
    const first = exchanges[0]
    const firstStart = Date.parse(first?.turn?.createdAt ?? first?.userMessage?.createdAt ?? '')
    const containing =
      at < firstStart
        ? first
        : exchanges.find((exchange) => {
            const start = Date.parse(
              exchange.turn?.createdAt ?? exchange.userMessage?.createdAt ?? '',
            )
            const next = exchanges[exchanges.indexOf(exchange) + 1]
            const end = next
              ? Date.parse(next.turn?.createdAt ?? next.userMessage?.createdAt ?? '')
              : Number.POSITIVE_INFINITY
            return Number.isFinite(at) && at >= start && at < end
          })
    ;(containing ?? exchanges.at(-1))?.commands.push(command)
  }
  return exchanges
}

interface DiffLine {
  type: 'add' | 'del' | 'context' | 'header'
  oldLineNumber?: number
  newLineNumber?: number
  text: string
}

const INITIAL_DIFF_LINES: DiffLine[] = [] /* real diff lines are supplied by timeline steps */
/*
  {
    type: 'header',
    text: '@@ -42,7 +42,16 @@ export async function routeExecution(req: EngineRequest): Promise<RunResult> {',
  },
  { type: 'del', oldLineNumber: 42, text: '-  if (!req.model) {' },
  { type: 'del', oldLineNumber: 43, text: "-    throw new Error('Target model not specified');" },
  { type: 'del', oldLineNumber: 44, text: '-  }' },
  { type: 'add', newLineNumber: 42, text: '+  if (!req.model) {' },
  {
    type: 'add',
    newLineNumber: 43,
    text: "+    throw new Error('Target model not specified in engine dispatch');",
  },
  { type: 'add', newLineNumber: 44, text: '+  }' },
  { type: 'add', newLineNumber: 45, text: '+' },
  { type: 'add', newLineNumber: 46, text: '+  // Enforce context window ceiling check' },
  { type: 'add', newLineNumber: 47, text: '+  const maxContext = req.contextLimit ?? 200_000;' },
  { type: 'add', newLineNumber: 48, text: '+  if (req.estimatedTokens > maxContext) {' },
  {
    type: 'add',
    newLineNumber: 49,
    text: '+    throw new ' + 'Context' + 'ExceededError(`Payload ${req.estimatedTokens} exceeds context' + 'Window ${maxContext}`);',
  },
  { type: 'add', newLineNumber: 50, text: '+  }' },
  { type: 'add', newLineNumber: 51, text: '+' },
  { type: 'add', newLineNumber: 52, text: '+  // Validate output slice against AST contract' },
  {
    type: 'add',
    newLineNumber: 53,
    text: '+  await assertContractSlices(req.taskContract, req.modifiedPaths);',
  },
  { type: 'context', oldLineNumber: 45, newLineNumber: 54, text: ' ' },
  {
    type: 'context',
    oldLineNumber: 46,
    newLineNumber: 55,
    text: '   return executeInWorktree(req);',
  },
  { type: 'context', oldLineNumber: 47, newLineNumber: 56, text: ' }' },
]
*/

export const OrchestDevWorkspace: React.FC<OrchestDevWorkspaceProps> = ({
  activeProject,
  activeAgent,
  newSessionAgent,
  onRunCommand,
  onSelectAgent,
  onSendMessage,
  onTimelinePending,
  onSlashCommand,
  sessionStatus: apiSessionStatus,
}) => {
  const [orchestrator, setOrchestrator] = useState<
    | NonNullable<ConfigResponse['roleAssignments']>[string]
    | undefined
    | { agent: string; model?: string; effort?: string }
  >(undefined)
  useEffect(() => {
    let disposed = false
    setOrchestrator(undefined)
    const controller = new AbortController()
    void getConfig(activeProject.id, controller.signal)
      .then((config) => {
        if (!disposed)
          setOrchestrator(
            newSessionAgent
              ? resolveNewSessionAgent(newSessionAgent, config.roleAssignments)
              : (config.roleAssignments?.orchestrator ?? null),
          )
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
  const [elapsedTime] = useState('')
  const [currentStep, setCurrentStep] = useState('')

  // Collapsed state is keyed by exchange so each turn retains its own disclosure state.
  const [expandedExchanges, setExpandedExchanges] = useState<Record<string, string[]>>({})
  const [isSearchExpanded, setIsSearchExpanded] = useState(false)
  const [isEditExpanded, setIsEditExpanded] = useState(false)
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
    setCurrentStep('Purging .cache/ast-index and rebuilding symbol graph...')
    setTimeout(() => {
      setSessionStatus('done')
      setCurrentStep('All AST checks and acceptance criteria fulfilled')
    }, 1200)
  }

  const handleDeny = () => {
    setApprovalState('denied')
    setSessionStatus('failed')
    setCurrentStep('Cache re-indexing denied by user')
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
    setCurrentStep('')

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
    const isCurrentExchange = timeline?.live?.turnId === exchange.id
    const exchangeUserMessage = exchange.userMessage
    const pendingForExchange = exchange.optimistic && pendingUserMessage
    const visibleUserMessage = pendingForExchange
      ? {
          content: pendingUserMessage.content,
          createdAt: new Date(pendingUserMessage.sentAt).toISOString(),
        }
      : exchangeUserMessage
    const steps = exchange.steps
    // USO.6: el pensamiento son los pasos `reasoning`; los `text` son la respuesta y la repetían.
    const reasoningSteps = steps.filter((step) => step.type === 'reasoning' && step.detail?.trim())
    const thoughtStep = reasoningSteps.length
      ? {
          detail: reasoningSteps
            .map((step) => (step.detail as string).replace(/^\*\*(.*?)\*\*$/s, '$1'))
            .join('\n\n'),
          durationMs: reasoningSteps.reduce((total, step) => total + (step.durationMs ?? 0), 0),
        }
      : undefined
    const readSteps = steps.filter((step) => step.tool?.toLowerCase() === 'read' && step.target)
    const searchSteps = steps.filter((step) => step.tool?.toLowerCase().includes('search'))
    const editSteps = steps.filter((step) =>
      ['edit', 'write'].includes(step.tool?.toLowerCase() ?? ''),
    )
    const cliCommands = steps
      .filter((step) => step.tool?.toLowerCase() === 'command' && step.detail)
      .map((step, index) => ({
        id: -(index + 1),
        cmd: step.detail ?? '',
        exitCode: step.exitCode ?? (step.ok === false ? 1 : 0),
        stdout: step.output ?? '',
        stderr: '',
        elapsedMs: step.durationMs ?? 0,
        createdAt: step.createdAt,
      }))
    const allCommands = [...exchange.commands, ...cliCommands]
    const failedCommands = allCommands.filter((command) => command.exitCode !== 0)
    const passedCommands = allCommands.filter((command) => command.exitCode === 0)
    const hasRealTurn = Boolean(
      exchangeUserMessage ||
        exchange.assistantMessage ||
        steps.length ||
        exchange.commands.length ||
        (isCurrentExchange && timeline?.pending),
    )
    const visibleAssistantMessage =
      isCurrentExchange && timeline?.live?.text
        ? timeline.live.text
        : (exchange.assistantMessage?.content ?? '')
    const assistantCopy = assistantCopyTarget(exchange, visibleAssistantMessage)
    const isThoughtExpanded = expandedExchanges[exchange.id]?.includes('thought') ?? false
    const isReadFilesExpanded = expandedExchanges[exchange.id]?.includes('read') ?? false
    const setExpanded = (key: string, expanded: boolean) =>
      setExpandedExchanges((current) => {
        const values = new Set(current[exchange.id] ?? [])
        if (expanded) values.add(key)
        else values.delete(key)
        return { ...current, [exchange.id]: [...values] }
      })
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
            {/* 1. Thought (collapsed; summary shows only when expanded) */}
            {thoughtStep && (
              <div className="text-xs">
                <button
                  type="button"
                  onClick={() => setExpanded('thought', !isThoughtExpanded)}
                  className="h-8 w-full flex items-center gap-2 px-2 rounded-control hover:bg-app-surface/60 transition-colors text-app-muted cursor-pointer"
                >
                  {isThoughtExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />
                  )}
                  <Sparkles className="w-3.5 h-3.5 text-app-accent flex-shrink-0" />
                  <span className="font-mono text-[11px]">
                    Thought
                    {thoughtStep?.durationMs
                      ? ` · ${Math.round(thoughtStep.durationMs / 1000)}s`
                      : ''}
                  </span>
                </button>

                {isThoughtExpanded && (
                  <div className="mt-1 mb-2 ml-5 p-3 rounded-control bg-app-surface/50 border border-app/60 font-mono text-[11px] text-app-muted space-y-1.5 leading-relaxed">
                    <div className="whitespace-pre-wrap">{thoughtStep.detail}</div>
                  </div>
                )}
              </div>
            )}

            {/* 2. Read: consecutive reads collapse into one row */}
            {readSteps.length > 0 && (
              <div className="text-xs">
                <button
                  type="button"
                  onClick={() => setExpanded('read', !isReadFilesExpanded)}
                  className="h-8 w-full flex items-center justify-between px-2 rounded-control hover:bg-app-surface/60 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-3.5 h-3.5 text-app-muted flex-shrink-0" />
                    <span className="font-mono text-app-muted text-xs">Read</span>
                    <span className="font-mono text-app text-xs truncate">
                      {readSteps.length} {readSteps.length === 1 ? 'file' : 'files'}
                    </span>
                  </div>
                  {isReadFilesExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 text-app-muted flex-shrink-0" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-app-muted flex-shrink-0" />
                  )}
                </button>

                {isReadFilesExpanded && (
                  <div className="mt-1 mb-2 ml-5 p-2 rounded-control bg-app-surface/50 border border-app/60 font-mono text-[11px] text-app-muted space-y-1.5 max-h-48 overflow-y-auto">
                    {readSteps.map((step) => (
                      <div
                        key={step.seq}
                        className="flex items-center justify-between py-0.5 border-t border-app/40"
                      >
                        <span className="text-app">{step.target}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* 3. Search: search results and count */}
            {searchSteps.length > 0 && (
              <div className="text-xs">
                <button
                  type="button"
                  onClick={() => setIsSearchExpanded(!isSearchExpanded)}
                  className="h-8 w-full flex items-center justify-between px-2 rounded-control hover:bg-app-surface/60 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Search className="w-3.5 h-3.5 text-app-muted flex-shrink-0" />
                    <span className="font-mono text-app-muted text-xs">Search</span>
                    <span className="font-mono text-app text-xs truncate">
                      {searchSteps[0]?.target ?? searchSteps[0]?.detail}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="font-mono text-xs text-app-muted">{searchSteps.length}</span>
                    {isSearchExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5 text-app-muted" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-app-muted" />
                    )}
                  </div>
                </button>

                {isSearchExpanded && (
                  <div className="mt-1 mb-2 ml-5 p-2 rounded-control bg-app-surface/50 border border-app/60 font-mono text-[11px] text-app-muted space-y-1">
                    {searchSteps[0] && (
                      <div className="flex items-center justify-between">
                        <span className="text-app">
                          {searchSteps[0].target ?? searchSteps[0].detail}
                        </span>
                        <span className="text-app-muted/70">{searchSteps[0].detail}</span>
                      </div>
                    )}
                    {searchSteps[1] && (
                      <div className="flex items-center justify-between border-t border-app/40 pt-1">
                        <span className="text-app">
                          {searchSteps[1].target ?? searchSteps[1].detail}
                        </span>
                        <span className="text-app-muted/70">{searchSteps[1].detail}</span>
                      </div>
                    )}
                    {searchSteps[2] && (
                      <div className="flex items-center justify-between border-t border-app/40 pt-1">
                        <span className="text-app">
                          {searchSteps[2].target ?? searchSteps[2].detail}
                        </span>
                        <span className="text-app-muted/70">{searchSteps[2].detail}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 4. Edit: target and line counts */}
            {editSteps.map((editStep) => (
              <div key={editStep.seq} className="text-xs">
                <button
                  type="button"
                  onClick={() => setIsEditExpanded(!isEditExpanded)}
                  className="h-8 w-full flex items-center justify-between px-2 rounded-control hover:bg-app-surface/60 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FilePen className="w-3.5 h-3.5 text-app-muted flex-shrink-0" />
                    <span className="font-mono text-app-muted text-xs">Edit</span>
                    <span className="font-mono text-app text-xs truncate">{editStep?.target}</span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 font-mono text-xs">
                    <span className="text-emerald-400 [[data-diff-palette=colorblind]_&]:text-sky-400 font-medium">
                      +{editStep?.added ?? 0}
                    </span>
                    <span className="text-rose-400 [[data-diff-palette=colorblind]_&]:text-orange-400 font-medium">
                      −{editStep?.removed ?? 0}
                    </span>
                    {isEditExpanded ? (
                      <ChevronDown className="w-3.5 h-3.5 text-app-muted" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-app-muted" />
                    )}
                  </div>
                </button>

                {/* Expanded Edit -> inline colored diff */}
                {isEditExpanded && (
                  <div className="mt-1 mb-2 ml-5 rounded-control border border-app bg-[#0c1017] font-mono text-[11px] overflow-x-auto">
                    {INITIAL_DIFF_LINES.map((line, idx) => {
                      if (line.type === 'header') {
                        return (
                          <div
                            key={idx}
                            className="px-3 py-1 bg-app-elevated/40 text-app-muted text-[10px] select-none"
                          >
                            {line.text}
                          </div>
                        )
                      }
                      if (line.type === 'del') {
                        return (
                          <div
                            key={idx}
                            className="px-3 py-0.5 bg-rose-950/30 [[data-diff-palette=colorblind]_&]:bg-orange-950/30 text-rose-300 [[data-diff-palette=colorblind]_&]:text-orange-300 flex items-center gap-3"
                          >
                            <span className="w-6 text-right text-rose-500/60 [[data-diff-palette=colorblind]_&]:text-orange-500/60 select-none text-[10px]">
                              {line.oldLineNumber}
                            </span>
                            <span className="select-none text-rose-400 [[data-diff-palette=colorblind]_&]:text-orange-400 font-bold">
                              -
                            </span>
                            <span className="flex-1 whitespace-pre">{line.text.slice(1)}</span>
                          </div>
                        )
                      }
                      if (line.type === 'add') {
                        return (
                          <div
                            key={idx}
                            className="px-3 py-0.5 bg-emerald-950/30 [[data-diff-palette=colorblind]_&]:bg-sky-950/30 text-emerald-300 [[data-diff-palette=colorblind]_&]:text-sky-300 flex items-center gap-3"
                          >
                            <span className="w-6 text-right text-emerald-500/60 [[data-diff-palette=colorblind]_&]:text-sky-500/60 select-none text-[10px]">
                              {line.newLineNumber}
                            </span>
                            <span className="select-none text-emerald-400 [[data-diff-palette=colorblind]_&]:text-sky-400 font-bold">
                              +
                            </span>
                            <span className="flex-1 whitespace-pre">{line.text.slice(1)}</span>
                          </div>
                        )
                      }
                      return (
                        <div
                          key={idx}
                          className="px-3 py-0.5 text-app-muted/80 flex items-center gap-3"
                        >
                          <span className="w-6 text-right text-app-muted/30 select-none text-[10px]">
                            {line.newLineNumber}
                          </span>
                          <span className="select-none opacity-0"> </span>
                          <span className="flex-1 whitespace-pre">{line.text}</span>
                        </div>
                      )
                    })}
                    {INITIAL_DIFF_LINES.length === 0 && (
                      <pre className="p-3 text-app-muted whitespace-pre-wrap">
                        {editStep.detail || editStep.output || 'No diff details recorded'}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            ))}

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

        {/* 9. WHILE RUNNING: one live row with subtle shimmer, current step and elapsed time */}
        {isCurrentExchange && sessionStatus === 'working' && (
          <div className="h-8 px-2.5 flex items-center justify-between text-xs font-mono text-app-muted bg-app-surface/40 rounded-control border border-app/40 animate-pulse">
            <div className="flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 text-app-accent animate-spin" />
              <span className="text-app">{currentStep}</span>
            </div>
            <span className="text-[11px] text-app-muted">{elapsedTime}</span>
          </div>
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
        </div>
      </div>

      {/* 2. COMPOSER (Chat and Dev share it) */}
      {/* Keep the composer mounted while a selected session hydrates: uploads belong to its draft. */}
      <div
        data-composer-region
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
            orchestratorAssigned={!!activeAgent || !!orchestrator}
            onSlashCommand={onSlashCommand}
          />
        </div>
      </div>
    </main>
  )
}
