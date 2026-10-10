import { type ChildProcessWithoutNullStreams, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import type { ExecutorStepEvent } from './step-event.ts'

type JsonRpcMessage = {
  id?: string | number
  method?: string
  params?: any
  result?: any
  error?: { code?: number; message?: string; data?: unknown }
}
type Child = ChildProcessWithoutNullStreams

export class CodexProtocolError extends Error {}
export class CodexAppServerError extends Error {
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

export interface CodexAppServerOptions {
  binary: string
  env: Record<string, string>
  store: CodexAppServerThreadStore
  spawnProcess?: (binary: string, env: Record<string, string>) => Child
}

function normalizedPrompt(prompt: string): string {
  return prompt
    .replace(/^Now:.*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function codexContextHash(prompt: string): string {
  return createHash('sha256').update(normalizedPrompt(prompt)).digest('hex')
}

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
  private turns = new Map<
    string,
    {
      turnId: string | null
      text: string
      usage: any
      onDelta?: (delta: string) => void
      onStep?: (event: ExecutorStepEvent) => void
      finish: (error?: Error) => void
    }
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

  private request(method: string, params: unknown, timeoutMs = 15_000): Promise<any> {
    if (!this.child)
      return Promise.reject(new CodexAppServerError('app-server is not running', true))
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new CodexAppServerError(`${method} timed out`, method === 'initialize'))
      }, timeoutMs)
      this.pending.set(id, { resolve, reject, timer })
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

  private notification(method: string, params: any): void {
    if (method === 'item/agentMessage/delta' || method === 'item/reasoning/summaryTextDelta') {
      const state = this.turns.get(params.threadId)
      if (
        !state ||
        (state.turnId && params.turnId !== state.turnId) ||
        typeof params.delta !== 'string'
      )
        return
      if (method === 'item/agentMessage/delta') {
        state.text += params.delta
        state.onDelta?.(params.delta)
      } else if (params.delta.trim())
        state.onStep?.({ type: 'reasoning', label: 'reasoning', detail: params.delta })
      return
    }
    if (method === 'thread/tokenUsage/updated') {
      const state = this.turns.get(params.threadId)
      if (state && (!state.turnId || params.turnId === state.turnId))
        state.usage = params.tokenUsage?.last
      return
    }
    if (method === 'item/completed') {
      const state = this.turns.get(params.threadId)
      if (!state || (state.turnId && params.turnId !== state.turnId)) return
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
      } else if (item?.type === 'mcpToolCall')
        state.onStep?.({ type: 'tool_use', label: item.tool ?? 'mcp', detail: item.server })
      return
    }
    if (method === 'turn/completed') {
      const state = this.turns.get(params.threadId)
      if (state && (!state.turnId || state.turnId === params.turn?.id)) {
        if (params.turn?.status === 'failed')
          state.finish(new CodexAppServerError(params.turn.error?.message ?? 'Codex turn failed'))
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
      if (state && !params.willRetry)
        state.finish(new CodexAppServerError(params.error?.message ?? 'Codex turn failed'))
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
    transcript?: string
    model?: string
    effort?: string
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
    model?: string
  }> {
    await this.ensureReady()
    const stored = this.options.store.get(input.sessionId)
    const hash = codexContextHash(input.systemPrompt)
    let threadId = stored.threadId
    let observedModel: string | undefined
    let threadRecreated = false
    if (!threadId) {
      const result = await this.request('thread/start', {
        cwd: input.cwd,
        sandbox: 'read-only',
        approvalPolicy: 'never',
        model: input.model,
        developerInstructions: input.systemPrompt,
      })
      threadId = result?.thread?.id
      if (typeof threadId !== 'string')
        throw new CodexAppServerError('thread/start response missing thread.id', true)
      observedModel = result?.model ?? result?.thread?.model ?? undefined
      this.options.store.set(input.sessionId, threadId, hash)
      this.resumed.add(threadId)
    } else {
      if (!this.resumed.has(threadId)) {
        try {
          const resumed = await this.request('thread/resume', {
            threadId,
            cwd: input.cwd,
            excludeTurns: true,
            sandbox: 'read-only',
            approvalPolicy: 'never',
            model: input.model,
          })
          observedModel = resumed?.thread?.model ?? undefined
          this.resumed.add(threadId)
        } catch (error) {
          if (!(error instanceof CodexAppServerError) || !isExpiredThreadError(error.message))
            throw error
          const started = await this.request('thread/start', {
            cwd: input.cwd,
            sandbox: 'read-only',
            approvalPolicy: 'never',
            model: input.model,
            developerInstructions: input.systemPrompt,
          })
          const replacementId = started?.thread?.id
          if (typeof replacementId !== 'string')
            throw new CodexAppServerError('thread/start response missing thread.id', true)
          threadId = replacementId
          threadRecreated = true
          observedModel = started?.model ?? started?.thread?.model ?? undefined
          this.options.store.set(input.sessionId, threadId, hash)
          this.resumed.add(threadId)
          input.onStep?.({
            type: 'reasoning',
            label: input.transcript
              ? 'Codex thread expired — started a new one (earlier turns were resent)'
              : "Codex thread expired — started a new one (earlier turns are not in Codex's memory)",
          })
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
      onDelta: input.onDelta,
      onStep: input.onStep,
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
      turnStart = await this.request('turn/start', {
        threadId,
        input: [{ type: 'text', text: message }],
        cwd: input.cwd,
        model: input.model,
        effort: input.effort,
        approvalPolicy: 'never',
        sandboxPolicy: { type: 'readOnly', networkAccess: false },
      })
    } catch (error) {
      this.turns.delete(threadId)
      throw error
    }
    state.turnId = turnStart?.turn?.id ?? null
    this.options.store.set(input.sessionId, threadId, hash)
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new CodexAppServerError(`Codex timed out after ${input.timeoutMs}ms`)),
        input.timeoutMs,
      )
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
      model: observedModel,
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
export function clearCodexAppServersForTests(): void {
  stopCodexAppServers()
}
