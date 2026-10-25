import { Database } from 'bun:sqlite'
import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import { redactSensitive } from '../../security/secrets.ts'
import type { ApprovalAdapter } from '../approvals.ts'
import { decideApproval } from '../approvals.ts'
import { CliFailure, type CliNotice, classifyCliFailure, cliFailureNotice } from './cli-failure.ts'
import { codexApprovalRequest } from './codex-approval.ts'
import { type ExecutorStepEvent, readonlyCommandTarget } from './step-event.ts'

type JsonRpcMessage = {
  id?: string | number
  method?: string
  params?: any
  result?: any
  error?: { code?: number; message?: string; data?: unknown }
}
type Child = ChildProcessWithoutNullStreams
type TurnDiagnostics = {
  notifications: Record<string, number>
  dropped: Record<string, number>
  stdoutBytes: number
  stderrBytes: number
  nativeLogReadErrors?: number
}

function turnDiagnostics(): TurnDiagnostics {
  return {
    notifications: Object.create(null),
    dropped: Object.create(null),
    stdoutBytes: 0,
    stderrBytes: 0,
  }
}

class CodexAppServerError extends Error {
  constructor(
    message: string,
    readonly protocol = false,
  ) {
    super(message)
  }
}

export interface CodexAppServerThreadStore {
  get(sessionId: string): { threadId: string | null; contextHash: string | null }
  set(sessionId: string, threadId: string, contextHash: string): void
}

interface CodexAppServerOptions {
  binary: string
  env: Record<string, string>
  store: CodexAppServerThreadStore
  spawnProcess?: (binary: string, env: Record<string, string>) => Child
}

/** Override de config que se pasa al hilo (AT.20/AT.21: servidor MCP con `create_task` y/o `run_readonly`). */
type ThreadConfig = Record<string, unknown>

function normalizedPrompt(prompt: string): string {
  return prompt
    .replace(/^Now:.*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function codexContextHash(prompt: string): string {
  return createHash('sha256').update(normalizedPrompt(prompt)).digest('hex')
}

/** Mismo hash, nombre neutro: lo usan también los chats de otros CLI (AT.19.1). */
export const chatContextHash = codexContextHash

export class CodexAppServer {
  private child: Child | null = null
  private reader: ReturnType<typeof createInterface> | null = null
  private nextId = 1
  private pending = new Map<
    string | number,
    { resolve(value: any): void; reject(error: Error): void; timer: ReturnType<typeof setTimeout> }
  >()
  private ready: Promise<void> | null = null
  private resumed = new Set<string>()
  /** AT.20 — si el hilo se abrió/reanudó con la herramienta `create_task` (solo en este proceso). */
  /** Clave de las herramientas MCP (conjunto + raíz) con que se abrió cada hilo; '' = ninguna. */
  private toolOffered = new Map<string, string>()
  private turns = new Map<
    string,
    {
      turnId: string | null
      text: string
      messageItemId?: string
      messageBoundary?: boolean
      usage: any
      /** CX.6.1 — `last` del último evento y ventana del modelo (contexto del propio evento). */
      lastUsage?: any
      contextWindow?: number | null
      onDelta?: (delta: string) => void
      onStep?: (event: ExecutorStepEvent) => void
      logPhase?: (event: string, details?: Record<string, unknown>) => void
      firstDelta?: boolean
      responseStarted?: boolean
      lastNotice?: CliNotice
      model?: string
      diagnostics: TurnDiagnostics
      finish: (error?: Error) => void
    }
  >()
  private taskApprovals = new Map<
    string,
    { adapter: ApprovalAdapter; cwd: string; items: Map<string, any> }
  >()
  private readonly spawnProcess: NonNullable<CodexAppServerOptions['spawnProcess']>

  constructor(private readonly options: CodexAppServerOptions) {
    this.spawnProcess =
      options.spawnProcess ??
      ((binary, env) => spawn(binary, ['app-server'], { env, stdio: 'pipe' }))
  }

  private async ensureReady(): Promise<void> {
    if (this.child && this.ready) return this.ready
    this.resumed.clear()
    this.child = this.spawnProcess(this.options.binary, this.options.env)
    this.child.stderr.on('data', (chunk) => {
      for (const state of this.turns.values())
        state.diagnostics.stderrBytes += Buffer.byteLength(chunk)
    })
    this.child.stdout.on('data', (chunk) => {
      for (const state of this.turns.values())
        state.diagnostics.stdoutBytes += Buffer.byteLength(chunk)
    })
    this.reader = createInterface({ input: this.child.stdout })
    this.reader.on('line', (line) => this.receive(line))
    this.child.on('error', (error) =>
      this.failAll(new CodexAppServerError(`app-server spawn failed: ${error.message}`, true)),
    )
    this.child.on('exit', (code, signal) => {
      this.failAll(
        new CodexAppServerError(`app-server exited (${code ?? signal ?? 'unknown'})`, true),
      )
      this.child = null
      this.ready = null
      this.reader = null
      this.resumed.clear()
    })
    this.ready = (async () => {
      await this.request(
        'initialize',
        {
          clientInfo: { name: 'orchestos', title: 'OrchestOS', version: '1.0.0' },
          capabilities: { experimentalApi: false, requestAttestation: false },
        },
        10_000,
      )
      this.notify('initialized', {})
    })()
    try {
      await this.ready
    } catch (error) {
      this.kill()
      throw error
    }
  }

  private receive(line: string): void {
    let message: JsonRpcMessage
    try {
      message = JSON.parse(line)
    } catch {
      this.failAll(new CodexAppServerError('invalid JSON-RPC response', true))
      return
    }
    if (message.id !== undefined && message.method) {
      const state = this.taskApprovals.get(message.params?.threadId)
      const supported =
        message.method === 'item/fileChange/requestApproval' ||
        message.method === 'item/commandExecution/requestApproval'
      const reply = (decision: 'accept' | 'decline') => {
        this.child?.stdin.write(`${JSON.stringify({ id: message.id, result: { decision } })}\n`)
      }
      if (!state) return
      const turn = this.turns.get(message.params?.threadId)
      if (!supported || (turn?.turnId && message.params?.turnId !== turn.turnId)) {
        reply('decline')
        return
      }
      const request = codexApprovalRequest(
        message.method,
        message.params,
        state.items.get(message.params.itemId),
        state.cwd,
      )
      console.error(
        `[codex-approval] ${JSON.stringify({
          event: 'request',
          method: message.method,
          itemId: message.params.itemId,
          itemFound: state.items.has(message.params.itemId),
          kind: request.kind,
          files: request.detail.files ?? [],
          withinProject: request.withinProject ?? false,
          readOnly: request.readOnly ?? false,
          paramsKeys: Object.keys(message.params),
          changesInParams: Object.hasOwn(message.params, 'changes'),
          command:
            typeof message.params.command === 'string'
              ? redactSensitive(message.params.command).slice(0, 300)
              : undefined,
          commandActions: Array.isArray(message.params.commandActions)
            ? message.params.commandActions
                .map((action: unknown) =>
                  action && typeof action === 'object' && 'type' in action
                    ? action.type
                    : undefined,
                )
                .filter((type: unknown): type is string => typeof type === 'string')
            : [],
          availableDecisions: message.params.availableDecisions,
        })}`,
      )
      void state.adapter.requestApproval(request).then(
        (decision) => {
          const automatic =
            decideApproval(state.adapter.mode, request, new Set()) === 'auto-approve'
          console.error(
            `[codex-approval] ${JSON.stringify({
              event: 'decision',
              itemId: message.params.itemId,
              decision,
              auto: automatic,
            })}`,
          )
          reply(decision === 'approve' ? 'accept' : 'decline')
        },
        () => {
          console.error(
            `[codex-approval] ${JSON.stringify({
              event: 'decision',
              itemId: message.params.itemId,
              decision: 'reject',
              auto: false,
            })}`,
          )
          reply('decline')
        },
      )
      return
    }
    if (message.id !== undefined) {
      const pending = this.pending.get(message.id)
      if (!pending) return
      clearTimeout(pending.timer)
      this.pending.delete(message.id)
      if (message.error)
        pending.reject(
          new CodexAppServerError(
            message.error.message ?? 'app-server request failed',
            this.isProtocolError(message.error),
          ),
        )
      else pending.resolve(message.result)
      return
    }
    if (message.method) this.notification(message.method, message.params ?? {})
  }

  private isProtocolError(error: { code?: number; message?: string }): boolean {
    return (
      error.code === -32601 ||
      error.code === -32602 ||
      /method not found|unknown method|invalid params|unknown field/i.test(error.message ?? '')
    )
  }

  private request(
    method: string,
    params: unknown,
    timeoutMs = 15_000,
    onResolved?: () => void,
  ): Promise<any> {
    if (!this.child)
      return Promise.reject(new CodexAppServerError('app-server is not running', true))
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new CodexAppServerError(`${method} timed out`, method === 'initialize'))
      }, timeoutMs)
      this.pending.set(id, {
        resolve: (value) => {
          onResolved?.()
          resolve(value)
        },
        reject,
        timer,
      })
      this.child?.stdin.write(
        `${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`,
        (error) => {
          if (error) {
            clearTimeout(timer)
            this.pending.delete(id)
            reject(new CodexAppServerError(error.message, true))
          }
        },
      )
    })
  }

  private notify(method: string, params: unknown): void {
    this.child?.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method, params })}\n`)
  }

  private logTurn(
    event: string,
    threadId: string | null,
    startedAt: number,
    error?: unknown,
    diagnostics?: TurnDiagnostics,
    details?: Record<string, unknown>,
  ): void {
    let errorDetails: { kind: string; method?: string; name?: string } | undefined
    if (error !== undefined) {
      const message = error instanceof Error ? error.message : String(error)
      const timeoutMethod = message.match(/^([\w/]+) timed out$/)?.[1]
      errorDetails = timeoutMethod
        ? { kind: 'timeout', method: timeoutMethod }
        : { kind: 'error', name: error instanceof Error ? error.name : typeof error }
    }
    console.error(
      `[codex-turn] ${JSON.stringify({
        event,
        threadId,
        ms: Date.now() - startedAt,
        ...errorDetails,
        ...(event === 'turn-error' || event === 'turn-completed' ? diagnostics : undefined),
        ...details,
      })}`,
    )
  }

  private notification(method: string, params: any): void {
    const observed = this.turns.get(params.threadId)
    for (const state of observed ? [observed] : this.turns.values()) {
      const counts = state.diagnostics.notifications
      counts[method] = (counts[method] ?? 0) + 1
      if (!observed) {
        const dropped = state.diagnostics.dropped
        dropped['no-state'] = (dropped['no-state'] ?? 0) + 1
      }
    }
    const drop = (reason: string) => {
      if (observed) {
        const dropped = observed.diagnostics.dropped
        dropped[reason] = (dropped[reason] ?? 0) + 1
      }
    }
    // Protocol 0.164.0: only record status/auth enums, never account payloads or credentials.
    if (method === 'thread/status/changed' || method === 'account/updated') {
      const isThread = method === 'thread/status/changed'
      const status = params.status
      const details = isThread
        ? {
            status: {
              type: ['notLoaded', 'idle', 'systemError', 'active'].includes(status?.type)
                ? status.type
                : 'unknown',
              ...(Array.isArray(status?.activeFlags)
                ? {
                    activeFlags: status.activeFlags.filter((flag: unknown) =>
                      ['waitingOnApproval', 'waitingOnUserInput'].includes(String(flag)),
                    ),
                  }
                : {}),
            },
          }
        : {
            fields: Object.keys(params),
            authMode:
              params.authMode === null
                ? null
                : [
                      'apikey',
                      'chatgpt',
                      'chatgptAuthTokens',
                      'headers',
                      'agentIdentity',
                      'personalAccessToken',
                      'bedrockApiKey',
                      'bedrockAccessKeys',
                    ].includes(params.authMode)
                  ? params.authMode
                  : 'unknown',
            planType:
              params.planType === null
                ? null
                : /^(free|go|plus|pro|prolite|promax|team|self_serve_business_(prolite|usage_based)|business|ent26|enterprise(_cbp_(automation|usage_based))?|edu(_plus|_pro)?|sci(_plus)?|unknown)$/.test(
                      params.planType,
                    )
                  ? params.planType
                  : 'unknown',
          }
      const states = isThread ? (observed ? [observed] : []) : [...this.turns.values()]
      if (!states.length)
        this.logTurn(
          method,
          isThread ? params.threadId : null,
          Date.now(),
          undefined,
          undefined,
          details,
        )
      for (const state of states) {
        state.logPhase?.(method, details)
        const notice: CliNotice | undefined =
          isThread && status?.type === 'systemError'
            ? {
                kind: 'unknown',
                message: 'Codex reported a system error for this thread.',
                detail: JSON.stringify(details),
              }
            : !isThread && params.authMode === null
              ? {
                  kind: 'auth',
                  message: 'Codex reported no authentication mode for this account.',
                  detail: JSON.stringify(details),
                }
              : undefined
        if (notice) {
          state.lastNotice = notice
          state.onStep?.({ type: 'notice', label: notice.message, notice })
        }
      }
    }
    if (method === 'account/rateLimits/updated') {
      const limits = params.rateLimits
      const windows = [limits, ...Object.values(params.rateLimitsByLimitId ?? {})] as any[]
      const exhausted = windows
        .flatMap((limit) => [limit?.primary, limit?.secondary])
        .find((limit) => limit?.usedPercent >= 100)
      if (exhausted) {
        const resetDate =
          typeof exhausted.resetsAt === 'number' ? new Date(exhausted.resetsAt * 1000) : undefined
        const reset = resetDate
          ? `${resetDate.toDateString() === new Date().toDateString() ? '' : `${resetDate.toLocaleDateString('en-US')} `}${resetDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })}`
          : undefined
        const message = `Codex usage limit reached${reset ? ` — resets at ${reset}` : '.'}`
        for (const state of this.turns.values()) {
          const notice: CliNotice = { kind: 'quota', message, detail: JSON.stringify(limits) }
          state.lastNotice = notice
          state.onStep?.({ type: 'notice', label: message, notice })
        }
      }
    }
    if (observed && (!observed.turnId || !params.turnId || observed.turnId === params.turnId)) {
      if (method === 'turn/started' && !observed.responseStarted) {
        const notice: CliNotice = {
          kind: 'no-response',
          message: `Request sent to ${observed.model || 'the model'}`,
          detail: 'no response yet, no error reported by Codex',
        }
        observed.onStep?.({ type: 'notice', label: notice.message, notice })
      }
      if (method.startsWith('item/') && params.item?.type !== 'userMessage') {
        observed.responseStarted = true
      }
    }
    if (method === 'item/started' && params.item?.type === 'fileChange') {
      this.taskApprovals.get(params.threadId)?.items.set(params.item.id, params.item)
      console.error(
        `[codex-approval] ${JSON.stringify({
          event: 'item-started',
          itemId: params.item.id,
          files: (params.item.changes ?? [])
            .flatMap((change: any) => [change.path, change.kind?.move_path])
            .filter((path: unknown): path is string => typeof path === 'string'),
        })}`,
      )
    }
    if (method === 'item/agentMessage/delta' || method === 'item/reasoning/summaryTextDelta') {
      const state = this.turns.get(params.threadId)
      if (!state) return
      if (state.turnId && params.turnId !== state.turnId) {
        drop('turnId-mismatch')
        return
      }
      if (typeof params.delta !== 'string') {
        drop('no-delta-string')
        return
      }
      if (method === 'item/agentMessage/delta') {
        if (!state.firstDelta) {
          state.firstDelta = true
          state.logPhase?.('first-delta')
        }
        const itemId = typeof params.itemId === 'string' ? params.itemId : undefined
        const newItem = !!itemId && !!state.messageItemId && itemId !== state.messageItemId
        const separator = state.text && (newItem || state.messageBoundary) ? '\n\n' : ''
        state.messageBoundary = false
        if (itemId) state.messageItemId = itemId
        state.text += separator + params.delta
        state.onDelta?.(separator + params.delta)
      } else if (params.delta.trim())
        state.onStep?.({ type: 'reasoning', label: 'reasoning', detail: params.delta })
      return
    }
    if (method === 'thread/tokenUsage/updated') {
      const state = this.turns.get(params.threadId)
      if (state?.turnId && params.turnId !== state.turnId) {
        drop('turnId-mismatch')
        return
      }
      if (state && (!state.turnId || params.turnId === state.turnId)) {
        // Un evento por llamada al modelo: el costo del turno es la suma de cada `last`.
        const last = params.tokenUsage?.last
        if (last) {
          const sum = state.usage ?? {}
          for (const key of [
            'inputTokens',
            'cachedInputTokens',
            'cacheWriteInputTokens',
            'outputTokens',
          ])
            sum[key] = (sum[key] ?? 0) + (Number(last[key]) || 0)
          state.usage = sum
          state.lastUsage = last
        }
        if (params.tokenUsage && 'modelContextWindow' in params.tokenUsage)
          state.contextWindow = params.tokenUsage.modelContextWindow ?? null
      }
      return
    }
    if (method === 'item/started' && params.item?.type === 'agentMessage') {
      const state = this.turns.get(params.threadId)
      if (state?.turnId && params.turnId !== state.turnId) {
        drop('turnId-mismatch')
        return
      }
      if (state && (!state.turnId || params.turnId === state.turnId) && state.text)
        state.messageBoundary = true
      return
    }
    if (method === 'item/completed') {
      const state = this.turns.get(params.threadId)
      if (!state) return
      if (state.turnId && params.turnId !== state.turnId) {
        drop('turnId-mismatch')
        return
      }
      const item = params.item
      if (item?.type === 'agentMessage')
        state.onStep?.({ type: 'text', label: 'text', detail: item.text })
      else if (item?.type === 'commandExecution')
        state.onStep?.({
          type: 'tool_use',
          label: 'command',
          detail: item.command,
          target: item.cwd,
          ok: item.exitCode == null ? undefined : item.exitCode === 0,
          exitCode: item.exitCode ?? undefined,
          output: item.aggregatedOutput ?? undefined,
          durationMs: item.durationMs ?? undefined,
        })
      else if (item?.type === 'fileChange') {
        const paths = (item.changes ?? [])
          .map((change: any) => change.path)
          .filter(Boolean)
          .join(', ')
        state.onStep?.({
          type: 'tool_use',
          label: 'file_change',
          detail: paths || JSON.stringify(item.changes ?? []),
          target: paths || undefined,
        })
      } else if (item?.type === 'mcpToolCall') {
        const label =
          item.server && item.tool ? `mcp__${item.server}__${item.tool}` : (item.tool ?? 'mcp')
        const target = readonlyCommandTarget(label, item.arguments)
        state.onStep?.({
          type: 'tool_use',
          label,
          ...(target === undefined ? {} : { target }),
          detail: item.arguments === undefined ? item.server : JSON.stringify(item.arguments),
          ok: item.status === 'failed' ? false : item.status === 'completed' ? true : undefined,
        })
      }
      return
    }
    if (method === 'turn/completed') {
      const state = this.turns.get(params.threadId)
      if (state?.turnId && state.turnId !== params.turn?.id) {
        drop('turnId-mismatch')
        return
      }
      if (state && (!state.turnId || state.turnId === params.turn?.id)) {
        state.logPhase?.('turn-completed')
        if (params.turn?.status === 'failed')
          state.finish(
            new CliFailure(
              cliFailureNotice(
                params.turn.error?.message ?? 'Codex turn failed',
                'Codex CLI',
                state.model,
              ),
            ),
          )
        else {
          state.onStep?.({
            type: 'step_finish',
            label: 'step_finish',
            tokens: { input: state.usage?.inputTokens, output: state.usage?.outputTokens },
          })
          state.finish()
        }
      }
    } else if (method === 'error') {
      const state = this.turns.get(params.threadId)
      if (state?.turnId && params.turnId && state.turnId !== params.turnId) return
      if (state && params.willRetry) {
        const message = params.error?.message ?? 'Codex is retrying the request'
        const notice: CliNotice = {
          kind: 'retrying',
          message,
          detail: JSON.stringify(params.error),
        }
        state.lastNotice = notice
        state.onStep?.({ type: 'notice', label: message, notice })
      }
      if (state && !params.willRetry)
        state.finish(
          new CliFailure(
            cliFailureNotice(
              params.error?.message ?? 'Codex turn failed',
              'Codex CLI',
              state.model,
            ),
          ),
        )
    }
  }

  private failAll(error: Error): void {
    for (const p of this.pending.values()) {
      clearTimeout(p.timer)
      p.reject(error)
    }
    this.pending.clear()
    for (const state of this.turns.values()) state.finish(error)
  }

  async turn(input: {
    sessionId: string
    cwd: string
    systemPrompt: string
    message: string
    /** UI.24.6a — rutas absolutas de imágenes; entran como ítems `localImage` (UserInput del protocolo). */
    imagePaths?: string[]
    transcript?: string
    model?: string
    effort?: string
    /** AT.20/AT.21 — `config` de `thread/start`/`thread/resume`; solo si el turno ofrece herramientas MCP. */
    threadConfig?: ThreadConfig
    /** Clave de las herramientas ofrecidas (`mcpOfferKey`); ausente = la del propio config. */
    offerKey?: string
    timeoutMs: number
    onDelta?: (delta: string) => void
    onStep?: (event: ExecutorStepEvent) => void
  }): Promise<{
    threadId: string
    text: string
    inputTokens: number
    cacheReadTokens: number
    cacheWriteTokens: number
    outputTokens: number
    contextUsed: number | null
    contextWindow: number | null
    model?: string
  }> {
    const startedAt = Date.now()
    const diagnostics = turnDiagnostics()
    let threadId: string | null = null
    try {
      await this.ensureReady()
      const stored = this.options.store.get(input.sessionId)
      const hash = codexContextHash(input.systemPrompt)
      const offerKey = input.threadConfig ? (input.offerKey ?? 'tools') : ''
      threadId = stored.threadId
      let observedModel: string | undefined
      let threadRecreated = false
      if (!threadId) {
        const result = await this.request('thread/start', {
          cwd: input.cwd,
          sandbox: 'read-only',
          approvalPolicy: 'never',
          model: input.model,
          developerInstructions: input.systemPrompt,
          ...(input.threadConfig ? { config: input.threadConfig } : {}),
        })
        threadId = result?.thread?.id
        this.logTurn('thread-start', threadId, startedAt)
        if (typeof threadId !== 'string')
          throw new CodexAppServerError('thread/start response missing thread.id', true)
        observedModel = result?.model ?? result?.thread?.model ?? undefined
        this.options.store.set(input.sessionId, threadId, hash)
        this.resumed.add(threadId)
        this.toolOffered.set(threadId, offerKey)
      } else {
        const startReplacement = async (stepLabel: string) => {
          const started = await this.request('thread/start', {
            cwd: input.cwd,
            sandbox: 'read-only',
            approvalPolicy: 'never',
            model: input.model,
            developerInstructions: input.systemPrompt,
            ...(input.threadConfig ? { config: input.threadConfig } : {}),
          })
          const replacementId = started?.thread?.id
          if (typeof replacementId !== 'string')
            throw new CodexAppServerError('thread/start response missing thread.id', true)
          threadId = replacementId
          this.logTurn('thread-start', threadId, startedAt)
          threadRecreated = true
          observedModel = started?.model ?? started?.thread?.model ?? undefined
          this.options.store.set(input.sessionId, threadId, hash)
          this.resumed.add(threadId)
          this.toolOffered.set(threadId, offerKey)
          input.onStep?.({ type: 'reasoning', label: stepLabel })
        }
        // AT.20/AT.21 — medido con codex-cli 0.163.0: un `thread/resume` repetido sobre un hilo ya reanudado en este
        // proceso NO aplica `config`. Si el turno necesita un conjunto de herramientas (o una raíz) distinto del
        // del hilo (p. ej. modo `chat` → `code`), se abre un hilo nuevo con la transcripción.
        const openedWith = this.toolOffered.get(threadId)
        if (
          this.resumed.has(threadId) &&
          input.threadConfig &&
          openedWith !== undefined &&
          openedWith !== offerKey
        ) {
          await startReplacement(
            input.transcript
              ? 'Codex thread restarted to change its tools (earlier turns were resent)'
              : "Codex thread restarted to change its tools (earlier turns are not in Codex's memory)",
          )
        } else if (!this.resumed.has(threadId)) {
          try {
            const resumed = await this.request('thread/resume', {
              threadId,
              cwd: input.cwd,
              excludeTurns: true,
              sandbox: 'read-only',
              approvalPolicy: 'never',
              model: input.model,
              ...(input.threadConfig ? { config: input.threadConfig } : {}),
            })
            this.logTurn('thread-resume', threadId, startedAt)
            observedModel = resumed?.thread?.model ?? undefined
            this.resumed.add(threadId)
            this.toolOffered.set(threadId, offerKey)
          } catch (error) {
            if (!(error instanceof CodexAppServerError) || !isExpiredThreadError(error.message))
              throw error
            await startReplacement(
              input.transcript
                ? 'Codex thread expired — started a new one (earlier turns were resent)'
                : "Codex thread expired — started a new one (earlier turns are not in Codex's memory)",
            )
          }
        }
      }
      const changed = !threadRecreated && !!stored.threadId && stored.contextHash !== hash
      const dateIgnoredSystemPrompt = changed
        ? `<orchestos-context-update>\n${input.systemPrompt}\n</orchestos-context-update>\n\n`
        : ''
      const includeTranscript = !stored.threadId || threadRecreated
      const message = `${dateIgnoredSystemPrompt}${includeTranscript ? (input.transcript ?? '') : ''}${input.message}`
      const state = {
        turnId: null as string | null,
        text: '',
        usage: null as any,
        lastUsage: undefined as any,
        contextWindow: undefined as number | null | undefined,
        diagnostics,
        model: input.model,
        responseStarted: false,
        lastNotice: undefined as CliNotice | undefined,
        onDelta: input.onDelta,
        onStep: input.onStep,
        logPhase: (event: string, details?: Record<string, unknown>) =>
          this.logTurn(event, threadId, startedAt, undefined, diagnostics, details),
        finish: (_error?: Error) => {},
      }
      const completion = new Promise<void>((resolve, reject) => {
        state.finish = (error) => {
          this.turns.delete(threadId!)
          error ? reject(error) : resolve()
        }
      })
      this.turns.set(threadId, state)
      let turnStart: any
      const nativeLogStartedAt = Date.now()
      try {
        if (process.env.ORCHESTOS_GATE_CAPTURE_DIR) {
          try {
            mkdirSync(process.env.ORCHESTOS_GATE_CAPTURE_DIR, { recursive: true })
            writeFileSync(
              join(process.env.ORCHESTOS_GATE_CAPTURE_DIR, `chat-cli-input-${input.sessionId}.txt`),
              message,
            )
          } catch {}
        }
        turnStart = await this.request(
          'turn/start',
          {
            threadId,
            input: [
              { type: 'text', text: message },
              ...(input.imagePaths ?? []).map((path) => ({ type: 'localImage', path })),
            ],
            cwd: input.cwd,
            model: input.model,
            effort: input.effort,
            approvalPolicy: 'never',
            sandboxPolicy: { type: 'readOnly', networkAccess: false },
          },
          15_000,
          () => this.logTurn('turn-start', threadId, startedAt),
        )
      } catch (error) {
        this.turns.delete(threadId)
        throw error
      }
      state.turnId = turnStart?.turn?.id ?? null
      this.options.store.set(input.sessionId, threadId, hash)
      let timer: ReturnType<typeof setTimeout> | undefined
      let nativeLogTimer: ReturnType<typeof setInterval> | undefined
      let nativeRetry: { status: string; attempt: number; max: number; seconds: number } | undefined
      const seenAttempts = new Set<number>()
      const pollNativeLog = () => {
        if (state.responseStarted || !this.turns.has(threadId!)) {
          if (nativeLogTimer) clearInterval(nativeLogTimer)
          return
        }
        const home = this.options.env.CODEX_HOME
        if (!home) return
        let db: Database | undefined
        try {
          db = new Database(join(home, 'logs_2.sqlite'), { readonly: true })
          const rows = db
            .query<{ feedback_log_body: string | null }, [string, number]>(
              "SELECT feedback_log_body FROM logs WHERE thread_id = ? AND ts >= ? AND level IN ('WARN', 'ERROR') ORDER BY ts, id",
            )
            .all(threadId!, Math.floor(nativeLogStartedAt / 1000))
          for (const row of rows) {
            const body = row.feedback_log_body
            if (typeof body !== 'string') continue
            const loggedTurn = body.match(/\bturn_id=([^\s]+)/)?.[1]
            if (loggedTurn && state.turnId && loggedTurn !== state.turnId) continue
            const retry = body.match(
              /stream disconnected - retrying sampling request \((\d+)\/(\d+) in (\d+(?:\.\d+)?)s\)/,
            )
            const status = body.match(/last status:\s*(\d{3})(?:\s+([A-Za-z][A-Za-z -]{0,79}))?/)
            if (!retry || !status) continue
            const attempt = Number(retry[1])
            const max = Number(retry[2])
            const seconds = Math.ceil(Number(retry[3]))
            if (
              !Number.isSafeInteger(attempt) ||
              attempt < 1 ||
              !Number.isSafeInteger(max) ||
              max < attempt ||
              !Number.isSafeInteger(seconds) ||
              seenAttempts.has(attempt)
            )
              continue
            seenAttempts.add(attempt)
            const statusText = `${status[1]}${status[2] ? ` ${status[2].trim()}` : ''}`
            const kind = Number(status[1]) >= 500 ? 'overloaded' : classifyCliFailure(statusText)
            nativeRetry = { status: statusText, attempt, max, seconds }
            const notice: CliNotice = {
              kind: 'retrying',
              message: `Codex got ${statusText} — retry ${attempt}/${max} in ${seconds} s`,
              detail: cliFailureNotice(statusText, 'Codex', input.model, kind).message,
            }
            state.lastNotice = notice
            input.onStep?.({ type: 'notice', label: notice.message, notice })
          }
        } catch {
          diagnostics.nativeLogReadErrors = (diagnostics.nativeLogReadErrors ?? 0) + 1
        } finally {
          db?.close()
        }
      }
      nativeLogTimer = setInterval(pollNativeLog, 2_000)
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          pollNativeLog()
          const raw = `Codex timed out after ${input.timeoutMs}ms`
          const notice: CliNotice =
            state.lastNotice && state.lastNotice.kind !== 'retrying'
              ? {
                  ...state.lastNotice,
                  detail: `${state.lastNotice.detail ?? state.lastNotice.message}\n${raw}`,
                }
              : {
                  kind: 'timeout',
                  message: state.responseStarted
                    ? `Codex timed out after ${input.timeoutMs / 1000} s while waiting for ${input.model || 'the model'}.`
                    : nativeRetry
                      ? `No response from ${input.model || 'the model'} in ${input.timeoutMs / 1000} s — Codex got ${nativeRetry.status} and was waiting to retry (${nativeRetry.attempt}/${nativeRetry.max} in ${nativeRetry.seconds} s).`
                      : `No response from ${input.model || 'the model'} in ${input.timeoutMs / 1000} s. ${state.lastNotice ? state.lastNotice.message : 'Codex reported no error.'}`,
                  detail: raw,
                }
          input.onStep?.({ type: 'notice', label: notice.message, notice })
          reject(new CliFailure(notice))
        }, input.timeoutMs)
      })
      try {
        await Promise.race([completion, timeout])
      } catch (error) {
        if (state.turnId) {
          try {
            await this.request('turn/interrupt', { threadId, turnId: state.turnId }, 2_000)
          } catch {}
        }
        state.finish(error as Error)
        throw error
      } finally {
        if (timer) clearTimeout(timer)
        if (nativeLogTimer) clearInterval(nativeLogTimer)
      }
      return {
        threadId,
        text: state.text,
        inputTokens: Math.max(
          0,
          (state.usage?.inputTokens ?? 0) - (state.usage?.cachedInputTokens ?? 0),
        ),
        cacheReadTokens: state.usage?.cachedInputTokens ?? 0,
        cacheWriteTokens: state.usage?.cacheWriteInputTokens ?? 0,
        outputTokens: state.usage?.outputTokens ?? 0,
        contextUsed: state.lastUsage ? Number(state.lastUsage.totalTokens) || null : null,
        contextWindow: state.contextWindow ?? null,
        model: observedModel,
      }
    } catch (error) {
      this.logTurn('turn-error', threadId, startedAt, error, diagnostics)
      throw error
    }
  }

  /** Fresh task thread; chat turn() keeps its read-only/never contract unchanged. */
  async taskTurn(input: {
    cwd: string
    prompt: string
    model: string
    effort?: string
    timeoutMs: number
    approvals: ApprovalAdapter
    onStep?: (event: ExecutorStepEvent) => void
  }) {
    await this.ensureReady()
    const started = await this.request('thread/start', {
      cwd: input.cwd,
      sandbox: 'workspace-write',
      // CI.32.c (2026-10-22): auto-edit uses Codex's native sandbox approval behavior.
      approvalPolicy: input.approvals.mode === 'auto-edit' ? 'on-request' : 'untrusted',
      approvalsReviewer: 'user',
      model: input.model,
      ephemeral: true,
    })
    const threadId = started?.thread?.id
    if (typeof threadId !== 'string') throw new CodexAppServerError('Missing task thread.id', true)
    const state = {
      turnId: null as string | null,
      text: '',
      usage: null as any,
      lastUsage: undefined as any,
      contextWindow: undefined as number | null | undefined,
      diagnostics: turnDiagnostics(),
      onStep: input.onStep,
      finish: (_error?: Error) => {},
    }
    let settled = false
    const completion = new Promise<void>((resolve, reject) => {
      state.finish = (error) => {
        if (settled) return
        settled = true
        this.turns.delete(threadId)
        error ? reject(error) : resolve()
      }
    })
    // Register a rejection handler before turn/start: the CLI can exit before its response.
    void completion.catch(() => {})
    this.turns.set(threadId, state)
    this.taskApprovals.set(threadId, { adapter: input.approvals, cwd: input.cwd, items: new Map() })
    const timer = setTimeout(() => {
      state.finish(new CodexAppServerError(`Codex task timed out after ${input.timeoutMs}ms`))
      this.kill()
    }, input.timeoutMs)
    try {
      const turn = await this.request('turn/start', {
        threadId,
        input: [{ type: 'text', text: input.prompt }],
        cwd: input.cwd,
        model: input.model,
        effort: input.effort,
        approvalPolicy: input.approvals.mode === 'auto-edit' ? 'on-request' : 'untrusted',
        approvalsReviewer: 'user',
        sandboxPolicy: { type: 'workspaceWrite', writableRoots: [input.cwd], networkAccess: false },
      })
      state.turnId = turn?.turn?.id ?? null
      await completion
      if (!state.usage) throw new CodexAppServerError('Codex task returned no usage; cost unknown')
      return {
        threadId,
        finalText: state.text,
        inputTokens: Math.max(
          0,
          (state.usage.inputTokens ?? 0) - (state.usage.cachedInputTokens ?? 0),
        ),
        outputTokens: state.usage.outputTokens ?? 0,
        cacheReadTokens: state.usage.cachedInputTokens ?? 0,
        cacheWriteTokens: state.usage.cacheWriteInputTokens ?? 0,
      }
    } finally {
      clearTimeout(timer)
      this.taskApprovals.delete(threadId)
      this.turns.delete(threadId)
      this.kill()
    }
  }

  kill(): void {
    this.failAll(new CodexAppServerError('app-server stopped', true))
    this.reader?.close()
    this.reader = null
    if (this.child) {
      this.child.kill('SIGTERM')
      this.child = null
    }
    this.ready = null
    this.resumed.clear()
  }
}

function isExpiredThreadError(message: string): boolean {
  return /thread (?:not found|expired|does not exist)|no (?:such )?rollout|rollout (?:not found|does not exist)/i.test(
    message,
  )
}

const servers = new Map<string, CodexAppServer>()
export function getCodexAppServer(
  configHome: string,
  binary: string,
  env: Record<string, string>,
  store: CodexAppServerThreadStore,
): CodexAppServer {
  let server = servers.get(configHome)
  if (!server) {
    server = new CodexAppServer({ binary, env, store })
    servers.set(configHome, server)
  }
  return server
}
export function stopCodexAppServers(): void {
  for (const server of servers.values()) server.kill()
  servers.clear()
}
