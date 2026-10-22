import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { decideClaudeResume } from '../../chat/claude-resume.ts'
import { getClaudeChatSession, setClaudeChatSession } from '../../db/chat-sessions.ts'
import type { McpOffer } from '../../mcp/adapters.ts'
import { type ReadAudit, uninstrumentedReadAudit } from '../read-audit.ts'
import { KNOWN_CLIS } from './cli-registry.ts'
import { CODEX_CHAT_EFFORT_LEVELS, runCodexChat } from './codex.ts'
import { CLAUDE_CLI_EFFORTS, ClaudeSessionNotFoundError, runClaudeChat } from './external.ts'
import { runOpencodeChat } from './opencode.ts'
import type { ExecutorStepEvent } from './step-event.ts'

export interface CliRoleDeps {
  claude?: typeof runClaudeChat
  codex?: typeof runCodexChat
  opencode?: typeof runOpencodeChat
}

export interface CliRoleInput {
  cwd: string
  projectRoot?: string
  system: string
  message: string
  timeout: number
  model: string
  effort?: string
  deps?: CliRoleDeps
}

export interface CliRoleResult {
  text: string
  inputTokens: number
  outputTokens: number
  model: string
  usd?: number | null
}

export interface CliTurnInput extends CliRoleInput {
  hasProjectContext: boolean
  sessionId?: string
  historyLength: number
  transcript: string
  imagePaths: string[]
  attachmentsDir?: string
  mcpOffer?: McpOffer
  onStep: (step: ExecutorStepEvent) => void
  onText: (text: string) => void
}

export interface CliTurnResult extends CliRoleResult {
  resultLabel: string
  readAudit: ReadAudit
  responseReadAudit?: ReadAudit
  cacheReadTokens?: number
  cacheWriteTokens?: number
  cliSessionId?: string
  contextUsed?: number | null
  contextWindow?: number | null
  afterSuccess?: () => void
}

export interface CliChatAdapter {
  chat: boolean
  terminal?: boolean
  reason?: string
  label: string
  efforts: readonly string[]
  /** Codex offers create_task only on its persistent session transport. */
  taskToolRequiresSession: boolean
  validateModel: (model: string | undefined, models: readonly { id: string }[]) => string | null
  runTurn: (input: CliTurnInput) => Promise<CliTurnResult>
  runRole: (input: CliRoleInput) => Promise<CliRoleResult>
  failure: (error: Error & { readAudit?: ReadAudit }) => {
    message: string
    record?: { error: string; readAudit: ReadAudit }
  }
}

const adapters = new Map<string, CliChatAdapter>()

/** Public registration used by built-in and additional CLI adapters alike. */
export function registerCliChatAdapter(agent: string, adapter: CliChatAdapter): void {
  if (!KNOWN_CLIS.some((cli) => cli.id === agent)) throw new Error(`Unknown CLI: ${agent}`)
  if (adapters.has(agent)) throw new Error(`CLI chat adapter already registered: ${agent}`)
  adapters.set(agent, adapter)
}

/** Agent ids accepted for chat roles, in registration order, with API last. */
export function roleAgentIds(): string[] {
  return [...adapters.keys(), 'api']
}

export function cliChatAdapterFor(agent: string | undefined): CliChatAdapter | undefined {
  return agent ? adapters.get(agent) : undefined
}

function validateCatalogModel(agent: string): CliChatAdapter['validateModel'] {
  return (model, models) => {
    if (models.length && !model) return `A model is required for the ${agent} CLI session`
    if (model && models.length && !models.some((item) => item.id === model))
      return `Model "${model}" is not available for the ${agent} CLI`
    return null
  }
}

function captureInput(sessionId: string | undefined, text: string): void {
  if (!sessionId || !process.env.ORCHESTOS_GATE_CAPTURE_DIR) return
  try {
    mkdirSync(process.env.ORCHESTOS_GATE_CAPTURE_DIR, { recursive: true })
    writeFileSync(
      join(process.env.ORCHESTOS_GATE_CAPTURE_DIR, `chat-cli-input-${sessionId}.txt`),
      text,
    )
  } catch {}
}

registerCliChatAdapter('claude', {
  chat: true,
  label: 'Claude Code CLI',
  efforts: CLAUDE_CLI_EFFORTS,
  taskToolRequiresSession: false,
  validateModel: validateCatalogModel('claude'),
  runRole: (i) =>
    (i.deps?.claude ?? runClaudeChat)(i.cwd, i.system, i.message, i.timeout, i.model, i.effort),
  async runTurn(i) {
    const { chatContextHash } = await import('./codex-app-server.ts')
    const contextHash = chatContextHash(i.system)
    const resumeDecision = decideClaudeResume({
      hasSession: !!i.sessionId,
      hasProjectContext: i.hasProjectContext,
      stored: i.sessionId
        ? getClaudeChatSession(i.sessionId)
        : { sessionId: null, contextHash: null, messageCount: null },
      historyLength: i.historyLength,
      contextHash,
    })
    const imageNote = i.imagePaths.map((p) => `\nAttached image: ${p}`).join('')
    const contextUpdate = resumeDecision.contextUpdate
      ? `<orchestos-context-update>\n${i.system}\n</orchestos-context-update>\n\n`
      : ''
    const input = resumeDecision.resume
      ? `${contextUpdate}${i.message}${imageNote}`
      : `${i.transcript}${i.message}${imageNote}`
    captureInput(i.sessionId, input)
    const runTurn = (text: string, resume?: string) =>
      runClaudeChat(
        i.cwd,
        i.system,
        text,
        i.timeout,
        i.model,
        i.effort,
        i.onStep,
        i.onText,
        i.attachmentsDir,
        resume,
        i.mcpOffer,
      )
    let result: Awaited<ReturnType<typeof runTurn>>
    try {
      result = await runTurn(input, resumeDecision.resume ?? undefined)
    } catch (error) {
      if (!(error instanceof ClaudeSessionNotFoundError)) throw error
      i.onStep({
        type: 'reasoning',
        label: 'Claude session expired — started a new one (earlier turns were resent)',
      })
      const retryInput = `${i.transcript}${i.message}${imageNote}`
      captureInput(i.sessionId, retryInput)
      result = await runTurn(retryInput)
    }
    return {
      ...result,
      resultLabel: `${result.model} via Claude Code CLI${result.effort ? ` (effort: ${result.effort})` : ''}`,
      cliSessionId: result.sessionId,
      responseReadAudit: result.readAudit,
      afterSuccess: () => {
        if (i.sessionId && i.hasProjectContext && result.sessionId)
          setClaudeChatSession(i.sessionId, result.sessionId, contextHash, i.historyLength + 2)
      },
    }
  },
  failure: (e) => ({
    message: `Claude Code CLI: ${e.message}`,
    record: e.readAudit
      ? { error: `Claude stream failed: ${e.message}`, readAudit: e.readAudit }
      : undefined,
  }),
})

registerCliChatAdapter('codex', {
  chat: true,
  label: 'Codex CLI',
  efforts: CODEX_CHAT_EFFORT_LEVELS,
  taskToolRequiresSession: true,
  validateModel: validateCatalogModel('codex'),
  runRole: (i) =>
    (i.deps?.codex ?? runCodexChat)(
      i.cwd,
      i.system,
      i.message,
      i.timeout,
      i.model,
      i.effort,
      undefined,
      undefined,
      undefined,
      undefined,
      i.projectRoot,
    ),
  async runTurn(i) {
    const result = await runCodexChat(
      i.cwd,
      i.system,
      i.message,
      i.timeout,
      i.model,
      i.effort,
      i.onStep,
      i.sessionId,
      i.onText,
      i.transcript,
      undefined,
      i.imagePaths,
      i.mcpOffer,
    )
    return {
      ...result,
      resultLabel: `${result.model} via Codex CLI${i.effort ? ` (effort: ${i.effort})` : ''}`,
      readAudit: uninstrumentedReadAudit(),
      cliSessionId: result.threadId,
    }
  },
  failure: (e) => ({
    message: `Codex CLI: ${e.message}`,
    record: { error: `Codex CLI failed: ${e.message}`, readAudit: uninstrumentedReadAudit() },
  }),
})

registerCliChatAdapter('opencode', {
  chat: false,
  terminal: true,
  reason: 'OpenCode se usa como terminal en el tab Dev; el chat no lo ejecuta.',
  label: 'OpenCode CLI',
  efforts: [],
  taskToolRequiresSession: false,
  validateModel: validateCatalogModel('opencode'),
  runRole: (i) =>
    (i.deps?.opencode ?? runOpencodeChat)(i.cwd, i.system, i.message, i.timeout, i.model),
  async runTurn() {
    throw new Error('chat no soportado')
  },
  failure: (e) => ({ message: e.message }),
})
