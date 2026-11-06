import { randomBytes } from 'node:crypto'
import type { ApprovalAdapter } from '../approvals.ts'
import { safeChildEnv } from '../path-policy.ts'
import { type OpencodePermission, opencodeApprovalRequest } from './opencode-approval.ts'
import { type ExecutorStepEvent, opencodeEventToStep } from './step-event.ts'

interface Part {
  type: string
  text?: string
  name?: string
  time?: { completed?: number }
  state?: {
    status?: string
    input?: Record<string, unknown>
    content?: Array<{ type: string; text?: string }>
    error?: { message?: string }
  }
}

interface SessionMessage {
  id: string
  type: string
  time?: { created?: number; completed?: number }
  content?: Part[]
  finish?: string
  error?: unknown
  cost?: number
  tokens?: { input?: number; output?: number }
}

function partEvent(part: Part) {
  if (part.type === 'text' || part.type === 'reasoning')
    return { type: part.type, part: { type: part.type, text: part.text } }
  if (part.type === 'tool')
    return {
      type: 'tool_use',
      part: {
        type: 'tool',
        tool: part.name,
        state: {
          status: part.state?.status,
          input: part.state?.input,
          output:
            part.state?.status === 'error'
              ? part.state.error?.message
              : (part.state?.content ?? [])
                  .filter((item) => item.type === 'text')
                  .map((item) => item.text ?? '')
                  .join('\n'),
        },
      },
    }
  return undefined
}

function finishEvent(message: SessionMessage) {
  return {
    type: 'step_finish',
    part: {
      type: 'step-finish',
      reason: message.finish,
      cost: message.cost ?? 0,
      tokens: { input: message.tokens?.input, output: message.tokens?.output },
    },
  }
}

/** Translate v2 stored messages into the existing NDJSON executor contract. */
export function opencodeMessagesToStream(messages: SessionMessage[]): string {
  return messages
    .filter((message) => message.type === 'assistant')
    .flatMap((message) => [
      ...(message.content ?? []).map(partEvent).filter((event) => event !== undefined),
      ...(message.time?.completed ? [finishEvent(message)] : []),
    ])
    .map((event) => JSON.stringify(event))
    .join('\n')
}

interface ServerProcess {
  stdout: ReadableStream<Uint8Array>
  stderr: ReadableStream<Uint8Array>
  exited: Promise<number>
  kill(signal: 'SIGTERM' | 'SIGKILL'): void
}

interface ServerInput {
  binary: string
  cwd: string
  prompt: string
  model?: string
  variant?: string
  timeoutMs: number
  approvals: ApprovalAdapter
  onStep?: (event: ExecutorStepEvent) => void
  signal?: AbortSignal
}

/** Injectable process and HTTP probes: tests never start the real CLI. */
export interface OpencodeServerProbe {
  spawn(binary: string, cwd: string, env: Record<string, string>): ServerProcess
  fetch: (url: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => Promise<Response>
}

const defaultProbe: OpencodeServerProbe = {
  spawn: (binary, cwd, env) =>
    Bun.spawn([binary, 'serve', '--port', '0', '--hostname', '127.0.0.1'], {
      cwd,
      env,
      stdout: 'pipe',
      stderr: 'pipe',
    }),
  fetch: (...args) => fetch(...args),
}

export async function runOpencodeServer(
  input: ServerInput,
  probe = defaultProbe,
): Promise<{ stdout: string; timedOut: boolean }> {
  const controller = new AbortController()
  const cancel = () => controller.abort(new Error('OpenCode task cancelled'))
  input.signal?.addEventListener('abort', cancel, { once: true })
  if (input.signal?.aborted) cancel()
  const timer = setTimeout(
    () => controller.abort(new Error(`OpenCode task timed out after ${input.timeoutMs}ms`)),
    input.timeoutMs,
  )
  let proc: ServerProcess | undefined
  let stopped = false
  let killTimer: ReturnType<typeof setTimeout> | undefined
  const aborted = new Promise<never>((_, reject) => {
    const fail = () => reject(controller.signal.reason)
    controller.signal.addEventListener('abort', fail, { once: true })
    if (controller.signal.aborted) fail()
  })
  void aborted.catch(() => {})
  const bounded = <T>(promise: Promise<T>) => Promise.race([promise, aborted])
  try {
    controller.signal.throwIfAborted()
    const password = randomBytes(32).toString('hex')
    const authorization = `Basic ${Buffer.from(`opencode:${password}`).toString('base64')}`
    proc = probe.spawn(input.binary, input.cwd, {
      ...safeChildEnv(),
      OPENCODE_SERVER_PASSWORD: password,
    })
    const exited = proc.exited.then((code) => {
      stopped = true
      if (killTimer) clearTimeout(killTimer)
      if (!controller.signal.aborted)
        controller.abort(new Error(`OpenCode server exited (${code})`))
    })
    void exited.catch((error) => controller.abort(error))
    let resolveAddress!: (address: string) => void
    const address = new Promise<string>((resolve) => {
      resolveAddress = resolve
    })
    const consume = async (stream: ReadableStream<Uint8Array>) => {
      const reader = stream.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer = (buffer + decoder.decode(value, { stream: true })).slice(-8192)
          const match = buffer.match(
            /(?:opencode )?server listening on (http:\/\/127\.0\.0\.1:\d+)\r?\n/i,
          )
          if (match) resolveAddress(match[1]!)
        }
      } finally {
        reader.releaseLock()
      }
    }
    void consume(proc.stdout).catch((error) => controller.abort(error))
    void consume(proc.stderr).catch((error) => controller.abort(error))
    const base = await bounded(address)
    const apiBody = async <T>(path: string, body?: unknown): Promise<T> => {
      const response = await bounded(
        probe.fetch(
          `${base}${path}${path.includes('?') ? '&' : '?'}directory=${encodeURIComponent(input.cwd)}`,
          {
            method: body === undefined ? 'GET' : 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: authorization },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
            signal: controller.signal,
          },
        ),
      )
      if (!response.ok) throw new Error(`OpenCode ${path}: HTTP ${response.status}`)
      return response.status === 204 ? (undefined as T) : (bounded(response.json()) as Promise<T>)
    }
    const api = async <T>(path: string, body?: unknown): Promise<T> =>
      (await apiBody<{ data: T } | undefined>(path, body))?.data as T
    const slash = input.model?.indexOf('/') ?? -1
    const session = await api<{ id: string }>('/api/session', {
      title: `OrchestOS ${input.approvals.runId}`,
      permissions: [
        { action: '*', resource: '*', effect: 'ask' },
        ...['read', 'glob', 'grep', 'list'].map((action) => ({
          action,
          resource: '*',
          effect: 'allow',
        })),
      ],
      ...(input.model && slash > 0
        ? {
            model: {
              providerID: input.model.slice(0, slash),
              id: input.model.slice(slash + 1),
              ...(input.variant ? { variant: input.variant } : {}),
            },
          }
        : {}),
    })
    if (typeof session.id !== 'string' || !session.id)
      throw new Error('OpenCode returned no session id')
    const path = `/api/session/${encodeURIComponent(session.id)}`
    await api(`${path}/prompt`, { text: input.prompt })
    const readMessages = async (): Promise<SessionMessage[]> => {
      const messages: SessionMessage[] = []
      let query = 'order=asc&limit=200'
      while (true) {
        const page = await apiBody<{
          data: SessionMessage[]
          cursor?: { next?: string }
        }>(`${path}/message?${query}`)
        messages.push(...page.data)
        if (page.data.length < 200) return messages
        if (!page.cursor?.next) throw new Error('OpenCode message page returned no next cursor')
        query = `cursor=${encodeURIComponent(page.cursor.next)}&limit=200`
      }
    }
    const replied = new Set<string>()
    const emitted = new Set<string>()
    while (true) {
      for (const permission of await api<OpencodePermission[]>('/api/permission/request')) {
        if (permission.sessionID !== session.id || replied.has(permission.id)) continue
        const decision = await bounded(
          input.approvals.requestApproval(opencodeApprovalRequest(permission, input.cwd)),
        )
        // Never send OpenCode's pattern-wide "always", even for an OrchestOS grant.
        await api(`${path}/permission/${encodeURIComponent(permission.id)}/reply`, {
          decision: decision === 'approve' ? 'once' : 'reject',
        })
        replied.add(permission.id)
      }
      const active = await api<Record<string, { type: string }>>('/api/session/active')
      // Read after status: an idle transition must not finalize an older snapshot.
      const messages = await readMessages()
      const emit = (
        id: string,
        event: ReturnType<typeof partEvent> | ReturnType<typeof finishEvent>,
      ) => {
        if (!event || emitted.has(id)) return
        for (const step of opencodeEventToStep(event)) input.onStep?.(step)
        emitted.add(id)
      }
      for (const message of messages) {
        if (message.type !== 'assistant') continue
        for (const [index, part] of (message.content ?? []).entries()) {
          if (
            part.type === 'tool' &&
            part.state?.status !== 'completed' &&
            part.state?.status !== 'error'
          )
            continue
          if (
            (part.type === 'text' || part.type === 'reasoning') &&
            !part.time?.completed &&
            !message.time?.completed
          )
            continue
          emit(`${message.id}:${index}`, partEvent(part))
        }
        if (message.time?.completed) emit(`${message.id}:finish`, finishEvent(message))
      }
      const last = messages.filter((message) => message.type === 'assistant').at(-1)
      // A fresh session is also idle: require a completed assistant message before accepting idle.
      if (!(session.id in active) && last?.time?.completed) {
        if (last.error || last.finish === 'error')
          throw new Error(`OpenCode task failed: ${JSON.stringify(last.error ?? last.finish)}`)
        const stdout = opencodeMessagesToStream(messages)
        return { stdout, timedOut: false }
      }
      await bounded(Bun.sleep(100))
    }
  } finally {
    clearTimeout(timer)
    input.signal?.removeEventListener('abort', cancel)
    if (!controller.signal.aborted) controller.abort(new Error('OpenCode task finished'))
    if (proc && !stopped) {
      proc.kill('SIGTERM')
      const child = proc
      killTimer = setTimeout(() => {
        if (!stopped) child.kill('SIGKILL')
      }, 1000)
      await proc.exited
      clearTimeout(killTimer)
    }
  }
}
