import { randomBytes } from 'node:crypto'
import type { ApprovalAdapter } from '../approvals.ts'
import { safeChildEnv } from '../path-policy.ts'
import { type OpencodePermission, opencodeApprovalRequest } from './opencode-approval.ts'
import { type ExecutorStepEvent, opencodeEventToStep } from './step-event.ts'

interface SessionMessage {
  info: { role: string; time?: { completed?: number }; error?: unknown }
  parts: Array<{ type: string; [key: string]: unknown }>
}

/** Session storage uses the same parts as run --format json. Ignore user parts. */
export function opencodeMessagesToStream(messages: SessionMessage[]): string {
  const types: Record<string, string> = {
    tool: 'tool_use',
    'step-finish': 'step_finish',
    'step-start': 'step_start',
  }
  return messages
    .filter((message) => message.info.role === 'assistant')
    .flatMap((message) =>
      message.parts.map((part) => JSON.stringify({ type: types[part.type] ?? part.type, part })),
    )
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
            /opencode server listening on (http:\/\/127\.0\.0\.1:\d+)\r?\n/,
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
    const api = async <T>(path: string, body?: unknown): Promise<T> => {
      const response = await bounded(
        probe.fetch(`${base}${path}?directory=${encodeURIComponent(input.cwd)}`, {
          method: body === undefined ? 'GET' : 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: authorization },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          signal: controller.signal,
        }),
      )
      if (!response.ok) throw new Error(`OpenCode ${path}: HTTP ${response.status}`)
      return response.status === 204 ? (undefined as T) : (bounded(response.json()) as Promise<T>)
    }
    const session = await api<{ id: string }>('/session', {
      title: `OrchestOS ${input.approvals.runId}`,
      permission: [
        { permission: '*', pattern: '*', action: 'ask' },
        ...['read', 'glob', 'grep', 'list'].map((permission) => ({
          permission,
          pattern: '*',
          action: 'allow',
        })),
      ],
    })
    if (typeof session.id !== 'string' || !session.id)
      throw new Error('OpenCode returned no session id')
    const path = `/session/${encodeURIComponent(session.id)}`
    const slash = input.model?.indexOf('/') ?? -1
    await api(`${path}/prompt_async`, {
      ...(input.model && slash > 0
        ? {
            model: {
              providerID: input.model.slice(0, slash),
              modelID: input.model.slice(slash + 1),
            },
          }
        : {}),
      ...(input.variant ? { variant: input.variant } : {}),
      parts: [{ type: 'text', text: input.prompt }],
    })
    const replied = new Set<string>()
    const emitted = new Set<string>()
    while (true) {
      for (const permission of await api<OpencodePermission[]>('/permission')) {
        if (permission.sessionID !== session.id || replied.has(permission.id)) continue
        const decision = await bounded(
          input.approvals.requestApproval(opencodeApprovalRequest(permission, input.cwd)),
        )
        // Never send OpenCode's pattern-wide "always", even for an OrchestOS grant.
        await api(`/permission/${encodeURIComponent(permission.id)}/reply`, {
          reply: decision === 'approve' ? 'once' : 'reject',
        })
        replied.add(permission.id)
      }
      const statuses = await api<Record<string, { type: string }>>('/session/status')
      // Read after status: an idle transition must not finalize an older snapshot.
      const messages = await api<SessionMessage[]>(`${path}/message`)
      for (const [messageIndex, message] of messages.entries()) {
        if (message.info.role !== 'assistant') continue
        for (const [partIndex, part] of message.parts.entries()) {
          const state = part.state as { status?: string } | undefined
          if (part.type === 'tool' && state?.status !== 'completed' && state?.status !== 'error')
            continue
          if (
            (part.type === 'text' || part.type === 'reasoning') &&
            !message.info.time?.completed &&
            !(part.time as { end?: number } | undefined)?.end
          )
            continue
          const id = typeof part.id === 'string' ? part.id : `${messageIndex}:${partIndex}`
          if (emitted.has(id)) continue
          const stream = opencodeMessagesToStream([{ ...message, parts: [part] }])
          for (const step of opencodeEventToStep(JSON.parse(stream))) input.onStep?.(step)
          emitted.add(id)
        }
      }
      const last = messages.filter((message) => message.info.role === 'assistant').at(-1)
      // A fresh session is also idle: require a completed assistant message before accepting idle.
      if (
        (!statuses[session.id] || statuses[session.id]?.type === 'idle') &&
        last?.info.time?.completed
      ) {
        if (last.info.error)
          throw new Error(`OpenCode task failed: ${JSON.stringify(last.info.error)}`)
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
