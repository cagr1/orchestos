import {
  Archive,
  Bot,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  FilePen,
  FileText,
  Loader2,
  Search,
  Sparkles,
  Square,
  Terminal,
  User,
  X,
} from 'lucide-react'
import type React from 'react'
import { useEffect, useRef, useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { getTimeline, type TimelineResponse } from '../../api/chat'
import type {
  AgentItem,
  SessionStatus as ApiSessionStatus,
  ChatAttachment,
  ProjectItem,
} from '../../types/orchestos'
import { AgentComposer, type CliId } from '../common/AgentComposer'
import { ContextRing } from '../common/ContextRing'
import { ProviderLogo } from '../common/ProviderLogos'

interface OrchestDevWorkspaceProps {
  activeProject: ProjectItem
  activeAgent?: AgentItem | null
  onCloseAgent?: (agentId: string) => void
  onRunCommand?: (cmd: string) => void
  onSelectAgent?: (agentId: string) => void
  onSendMessage?: (
    content: string,
    attachments?: ChatAttachment[],
    agent?: string,
    model?: string,
    effort?: string,
  ) => void
  sessionStatus?: ApiSessionStatus
  onSlashCommand?: (command: string, argument?: string) => void
}

export type SessionStatus = 'working' | 'waiting for approval' | 'done' | 'failed'

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
  onCloseAgent,
  onRunCommand,
  onSelectAgent,
  onSendMessage,
  onSlashCommand,
  sessionStatus: apiSessionStatus,
}) => {
  // Session status state: amber pulsing dot when waiting for approval
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('done')
  const [elapsedTime] = useState('')
  const [currentStep, setCurrentStep] = useState('')

  // Collapsed items state
  const [isThoughtExpanded, setIsThoughtExpanded] = useState(false)
  const [isReadFilesExpanded, setIsReadFilesExpanded] = useState(false)
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

  // Dynamic user message turns
  const [extraTurns, setExtraTurns] = useState<
    { id: string; userMessage: string; response?: string }[]
  >([])

  const timelineEndRef = useRef<HTMLDivElement>(null)
  const [timeline, setTimeline] = useState<TimelineResponse | null>(null)

  useEffect(() => {
    if (!activeAgent?.id) {
      setTimeline(null)
      return
    }
    let disposed = false
    const refreshTimeline = () =>
      getTimeline(activeAgent.id)
        .then((next) => {
          if (!disposed) setTimeline(next)
        })
        .catch(() => {
          if (!disposed) setTimeline(null)
        })
    void refreshTimeline()
    const timer = window.setInterval(() => void refreshTimeline(), 1000)
    return () => {
      disposed = true
      window.clearInterval(timer)
    }
  }, [activeAgent?.id])

  const hasRealTurn = Boolean(
    timeline &&
      (timeline.turns.length > 0 || timeline.messages.length > 0 || timeline.commands.length > 0),
  )
  const latestUserMessage = [...(timeline?.messages ?? [])]
    .reverse()
    .find((message) => message.role === 'user')
  const latestAssistantMessage =
    [...(timeline?.messages ?? [])].reverse().find((message) => message.role === 'assistant')
      ?.content ?? ''
  const steps = timeline?.turns.flatMap((turn) => turn.steps) ?? []
  const thoughtStep = steps.find((step) => step.type === 'text' && step.detail)
  const readSteps = steps.filter((step) => step.tool?.toLowerCase() === 'read' && step.target)
  const searchSteps = steps.filter((step) => step.tool?.toLowerCase().includes('search'))
  const editStep = steps.find((step) => ['edit', 'write'].includes(step.tool?.toLowerCase() ?? ''))
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
  const allCommands = [...(timeline?.commands ?? []), ...cliCommands]
  const failedCommand = allCommands.find((command) => command.exitCode !== 0)
  const passedCommand = allCommands.find((command) => command.exitCode === 0)
  const isWorking = sessionStatus === 'working' || timeline?.pending === true

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
  const activeContext = apiSessionStatus?.clis.find((cli) => cli.id === cliId)?.context
  const cliName =
    cliId === 'claude'
      ? 'Claude'
      : cliId === 'codex'
        ? 'Codex'
        : cliId === 'opencode'
          ? 'OpenCode'
          : cliId === 'deepseek'
            ? 'DeepSeek'
            : 'Gemini'

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

  const handleStop = () => {
    setSessionStatus('done')
    setCurrentStep('Execution interrupted by user')
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

  const handleSendMessage = (
    content: string,
    attachments?: ChatAttachment[],
    cli?: string,
    model?: string,
    effort?: string,
    isShellCmd?: boolean,
  ) => {
    if (!isShellCmd) onSendMessage?.(content, attachments, cli, model, effort)
    setSessionStatus('working')
    setCurrentStep('')

    if (isShellCmd && onRunCommand) {
      onRunCommand(content)
    }

    timelineEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // EMPTY STATE: when no agent session is selected (keep "OrchestOS Dev")
  if (!activeAgent) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center p-8 bg-app-bg text-app select-none overflow-hidden">
        <div className="flex flex-col items-center max-w-sm text-center space-y-4 opacity-75 hover:opacity-100 transition-opacity">
          <div className="w-14 h-14 rounded-card bg-app-surface border border-app flex items-center justify-center text-app-accent shadow-xs">
            <span className="text-xl font-black tracking-tighter">O</span>
            <span className="text-lg font-black text-app">S</span>
          </div>

          <div className="space-y-1">
            <h1 className="text-lg font-bold text-app tracking-tight">OrchestOS Dev</h1>
            <p className="text-xs text-app-muted leading-relaxed">
              No active session open. Select an agent from the sidebar or click + to launch a new
              CLI session.
            </p>
          </div>

          {onSelectAgent && (
            <button
              type="button"
              onClick={() => onSelectAgent('ag_handoff')}
              className="mt-1 inline-flex items-center gap-2 px-3 py-1.5 rounded-control bg-app-surface border border-app text-xs font-mono text-app hover:border-app-accent transition-colors shadow-2xs"
            >
              <ProviderLogo id="claude" size={14} className="w-3.5 h-3.5" />
              <span>Resume session</span>
            </button>
          )}
        </div>
      </main>
    )
  }

  const effectiveSessionStatus = apiSessionStatus?.clis.some((cli) => cli.available)
    ? sessionStatus
    : sessionStatus

  const failingBashOutput = failedCommand
    ? [failedCommand.cmd, failedCommand.stdout, failedCommand.stderr].filter(Boolean).join('\n')
    : ''

  const passingBashOutput = passedCommand
    ? [passedCommand.cmd, passedCommand.stdout, passedCommand.stderr].filter(Boolean).join('\n')
    : ''

  return (
    <main className="flex-1 flex flex-col h-full bg-app-bg text-app overflow-hidden relative select-none">
      {/* 1. SESSION HEADER (40px) */}
      {/* title; CLI product logo before it (tooltip = name); small status dot next to title (tooltip = state); Archive and Stop as icon buttons; context ring on right. No path pill, no CLI name text, no status text. */}
      <header className="h-10 border-b border-app bg-app-bg px-3.5 flex items-center justify-between flex-shrink-0 z-20">
        {/* Left: Product logo + Title + Status dot */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div title={cliName} className="flex-shrink-0 cursor-default">
            <ProviderLogo id={cliId} size={16} className="w-4 h-4" />
          </div>

          <span className="font-semibold text-xs text-app truncate max-w-sm">
            {activeAgent.name}
          </span>

          {/* Small status dot next to title (tooltip = state) */}
          {sessionStatus === 'waiting for approval' && (
            <span
              title="waiting for approval"
              className="w-2 h-2 rounded-full bg-amber-400 animate-pulse flex-shrink-0 cursor-default"
            />
          )}
          {isWorking && (
            <span title="working" className="flex items-center flex-shrink-0 cursor-default">
              <Loader2 className="w-3 h-3 text-app-accent animate-spin" />
            </span>
          )}
          {sessionStatus === 'done' && (
            <span
              title="done"
              className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0 cursor-default"
            />
          )}
          {sessionStatus === 'failed' && (
            <span
              title="failed"
              className="w-2 h-2 rounded-full bg-rose-500 flex-shrink-0 cursor-default"
            />
          )}
        </div>

        {/* Right: Archive and Stop as icon buttons + Context ring (64% in Dev) */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {isWorking && (
            <button
              type="button"
              onClick={handleStop}
              className="p-1 rounded-control text-app-muted hover:text-rose-400 hover:bg-rose-950/20 transition-colors"
              title="Stop execution"
              aria-label="Stop execution"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
            </button>
          )}

          {onCloseAgent && (
            <button
              type="button"
              onClick={() => onCloseAgent(activeAgent.id)}
              className="p-1 rounded-control text-app-muted hover:text-app hover:bg-app-surface transition-colors"
              title="Archive session"
              aria-label="Archive session"
            >
              <Archive className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Context ring (64% in Dev) */}
          <ContextRing
            percent={activeContext?.pct}
            model={activeContext?.model}
            usedTokens={activeContext ? `${activeContext.used}` : undefined}
            maxTokens={activeContext ? `${activeContext.window}` : undefined}
            className="ml-1"
          />
        </div>
      </header>

      {/* 2. TIMELINE (Centered, same max width as Chat) */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
        <div className="max-w-3xl lg:max-w-4xl mx-auto space-y-3">
          {/* USER MESSAGE: no avatar, no "You" label; time only on hover */}
          {latestUserMessage && (
            <div className="flex justify-end group">
              <div className="relative max-w-2xl px-4 py-2.5 rounded-card bg-app-surface text-app border border-app text-xs leading-relaxed shadow-2xs">
                <span className="absolute right-0 bottom-full mb-1 text-[10px] font-mono text-app-muted opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                  {latestUserMessage
                    ? new Date(latestUserMessage.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : ''}
                </span>
                {latestUserMessage.content}
                {readSteps[0]?.target && (
                  <code className="px-1 py-0.5 bg-app-bg border border-app rounded-xs font-mono text-[11px]">
                    {readSteps[0].target}
                  </code>
                )}{' '}
                {readSteps[1]?.target && (
                  <code className="px-1 py-0.5 bg-app-bg border border-app rounded-xs font-mono text-[11px]">
                    {readSteps[1].target}
                  </code>
                )}{' '}
                <button
                  type="button"
                  onClick={() =>
                    void handleCopyMessage(
                      latestUserMessage.id.toString(),
                      latestUserMessage.content,
                    )
                  }
                  className="absolute right-0 top-full mt-1 p-1 rounded-control text-app-muted opacity-0 group-hover:opacity-100 hover:text-app hover:bg-app-surface transition-colors"
                  title="Copy"
                  aria-label="Copy"
                >
                  {copiedMessageId === latestUserMessage.id.toString() ? (
                    <Check className="w-3 h-3" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              </div>
              <User className="mb-2 h-4 w-4 shrink-0 text-app-muted" aria-hidden="true" />
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
                    onClick={() => setIsThoughtExpanded(!isThoughtExpanded)}
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
                      <div>{thoughtStep.detail}</div>
                      {false && <div>{thoughtStep.detail}</div>}
                      {false && <div>{thoughtStep.detail}</div>}
                      {false && <div>{thoughtStep.detail}</div>}
                    </div>
                  )}
                </div>
              )}

              {/* 2. Read: consecutive reads collapse into one row */}
              {readSteps.length > 0 && (
                <div className="text-xs">
                  <button
                    type="button"
                    onClick={() => setIsReadFilesExpanded(!isReadFilesExpanded)}
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
                    <div className="mt-1 mb-2 ml-5 p-2 rounded-control bg-app-surface/50 border border-app/60 font-mono text-[11px] text-app-muted space-y-1.5">
                      {readSteps[0] && (
                        <div className="flex items-center justify-between py-0.5">
                          <span className="text-app">{readSteps[0].target}</span>
                        </div>
                      )}
                      {readSteps[1] && (
                        <div className="flex items-center justify-between py-0.5 border-t border-app/40">
                          <span className="text-app">{readSteps[1].target}</span>
                        </div>
                      )}
                      {readSteps[2] && (
                        <div className="flex items-center justify-between py-0.5 border-t border-app/40">
                          <span className="text-app">{readSteps[2].target}</span>
                        </div>
                      )}
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
              {editStep && (
                <div className="text-xs">
                  <button
                    type="button"
                    onClick={() => setIsEditExpanded(!isEditExpanded)}
                    className="h-8 w-full flex items-center justify-between px-2 rounded-control hover:bg-app-surface/60 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FilePen className="w-3.5 h-3.5 text-app-muted flex-shrink-0" />
                      <span className="font-mono text-app-muted text-xs">Edit</span>
                      <span className="font-mono text-app text-xs truncate">
                        {editStep?.target}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 font-mono text-xs">
                      <span className="text-emerald-400 font-medium">+{editStep?.added ?? 0}</span>
                      <span className="text-rose-400 font-medium">−{editStep?.removed ?? 0}</span>
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
                              className="px-3 py-0.5 bg-rose-950/30 text-rose-300 flex items-center gap-3"
                            >
                              <span className="w-6 text-right text-rose-500/60 select-none text-[10px]">
                                {line.oldLineNumber}
                              </span>
                              <span className="select-none text-rose-400 font-bold">-</span>
                              <span className="flex-1 whitespace-pre">{line.text.slice(1)}</span>
                            </div>
                          )
                        }
                        if (line.type === 'add') {
                          return (
                            <div
                              key={idx}
                              className="px-3 py-0.5 bg-emerald-950/30 text-emerald-300 flex items-center gap-3"
                            >
                              <span className="w-6 text-right text-emerald-500/60 select-none text-[10px]">
                                {line.newLineNumber}
                              </span>
                              <span className="select-none text-emerald-400 font-bold">+</span>
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
              )}

              {/* 5. Failing Bash: command output and exit state */}
              {failedCommand && (
                <div className="text-xs">
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
              )}

              {/* 6. Passing Bash: command output and exit state */}
              {passedCommand && (
                <div className="text-xs">
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
              )}
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
          {hasRealTurn && latestAssistantMessage && (
            <div className="flex items-start gap-2">
              <Bot className="mt-4 h-4 w-4 shrink-0 text-app-accent" aria-hidden="true" />
              <div className="relative rounded-card p-4 bg-app-surface/60 border border-app/60 text-xs text-app leading-relaxed shadow-2xs flex-1 group">
                <div className="prose prose-invert max-w-none text-xs leading-relaxed [&>p]:mb-2 [&>ul]:list-disc [&>ul]:pl-4 [&>pre]:bg-app-bg [&>pre]:p-2.5 [&>pre]:rounded-control [&>pre]:border [&>pre]:border-app [&>pre]:font-mono [&>code]:bg-app-bg [&>code]:px-1 [&>code]:py-0.5 [&>code]:rounded-control [&>code]:border [&>code]:border-app [&>code]:font-mono [&>strong]:font-bold [&>strong]:text-app">
                  <Markdown remarkPlugins={[remarkGfm]}>{latestAssistantMessage}</Markdown>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const message = [...(timeline?.messages ?? [])]
                      .reverse()
                      .find((item) => item.role === 'assistant')
                    if (message) void handleCopyMessage(message.id.toString(), message.content)
                  }}
                  className="absolute right-2 top-2 p-1 rounded-control text-app-muted opacity-0 group-hover:opacity-100 hover:text-app hover:bg-app-elevated transition-colors"
                  title="Copy"
                  aria-label="Copy"
                >
                  {copiedMessageId ===
                  String(
                    [...(timeline?.messages ?? [])]
                      .reverse()
                      .find((item) => item.role === 'assistant')?.id,
                  ) ? (
                    <Check className="w-3 h-3" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              </div>
            </div>
          )}

          {/* 9. WHILE RUNNING: one live row with subtle shimmer, current step and elapsed time */}
          {sessionStatus === 'working' && (
            <div className="h-8 px-2.5 flex items-center justify-between text-xs font-mono text-app-muted bg-app-surface/40 rounded-control border border-app/40 animate-pulse">
              <div className="flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 text-app-accent animate-spin" />
                <span className="text-app">{currentStep}</span>
              </div>
              <span className="text-[11px] text-app-muted">{elapsedTime}</span>
            </div>
          )}

          {/* Dynamic Extra Turns if user sent any further messages */}
          {extraTurns.map((turn) => (
            <div key={turn.id} className="space-y-3 pt-2">
              <div className="flex justify-end group">
                <div className="relative max-w-2xl px-4 py-2.5 rounded-card bg-app-surface text-app border border-app text-xs leading-relaxed shadow-2xs">
                  {turn.userMessage}
                </div>
                <User className="mb-2 h-4 w-4 shrink-0 text-app-muted" aria-hidden="true" />
              </div>
              {turn.response && (
                <div className="rounded-card p-4 bg-app-surface/60 border border-app/60 text-xs text-app leading-relaxed shadow-2xs">
                  <pre className="font-mono text-xs whitespace-pre text-app-muted">
                    {turn.response}
                  </pre>
                </div>
              )}
            </div>
          ))}

          <div ref={timelineEndRef} />
        </div>
      </div>

      {/* 3. COMPOSER (Chat and Dev share it) */}
      <div className="p-3 border-t border-app bg-app-bg flex-shrink-0">
        <div className="max-w-3xl lg:max-w-4xl mx-auto">
          <AgentComposer
            onSendMessage={handleSendMessage}
            defaultCli={cliId}
            defaultModel={activeAgent.model}
            defaultEffort={activeAgent.effort}
            lockedCli={activeAgent.agent as CliId | undefined}
            onSlashCommand={onSlashCommand}
          />
        </div>
      </div>
    </main>
  )
}
