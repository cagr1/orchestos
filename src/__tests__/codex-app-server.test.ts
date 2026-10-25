import { Database } from 'bun:sqlite'
import { describe, expect, spyOn, test } from 'bun:test'
import { EventEmitter } from 'node:events'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PassThrough } from 'node:stream'
import type { TimelineTurn } from '../dashboard/app/src/api/chat.ts'
import { livePhase } from '../dashboard/app/src/components/thread/thinking.ts'
import { codexMcpThreadConfig, taskProposalFromStep } from '../mcp/adapters.ts'
import { CliFailure } from '../run/executors/cli-failure.ts'
import {
  CodexAppServer,
  type CodexAppServerThreadStore,
  codexContextHash,
} from '../run/executors/codex-app-server.ts'

function fakeProcess(onRequest: (request: any, stdout: PassThrough) => void) {
  const stdin = new PassThrough()
  const stdout = new PassThrough()
  const child = new EventEmitter() as any
  child.stdin = stdin
  child.stdout = stdout
  child.stderr = new PassThrough()
  child.kill = () => {
    child.emit('exit', 0, null)
    return true
  }
  let pending = ''
  stdin.on('data', (chunk) => {
    pending += String(chunk)
    for (;;) {
      const end = pending.indexOf('\n')
      if (end < 0) break
      const line = pending.slice(0, end)
      pending = pending.slice(end + 1)
      if (!line) continue
      const request = JSON.parse(line)
      if (request.id !== undefined) onRequest(request, stdout)
    }
  })
  return child
}

function reply(stdout: PassThrough, request: any, result: unknown) {
  stdout.write(`${JSON.stringify({ jsonrpc: '2.0', id: request.id, result })}\n`)
}

function store() {
  const rows = new Map<string, { threadId: string | null; contextHash: string | null }>()
  const api: CodexAppServerThreadStore = {
    get: (id) => rows.get(id) ?? { threadId: null, contextHash: null },
    set: (id, threadId, contextHash) => rows.set(id, { threadId, contextHash }),
  }
  return { api, rows }
}

describe('Codex app-server', () => {
  test('ignores only the generated Now line when hashing context', () => {
    expect(codexContextHash('rules\nNow: today')).toBe(codexContextHash('rules\nNow: tomorrow'))
    expect(codexContextHash('task: update timeout title')).not.toBe(
      codexContextHash('task: update request title'),
    )
  })

  const codexBinary = Bun.which('codex')

  test.skipIf(!codexBinary)(
    'protocol method and notification names exist in installed generated types',
    () => {
      const outputDir = mkdtempSync(join(tmpdir(), 'orchestos-codex-protocol-'))
      try {
        const generated = Bun.spawnSync([
          codexBinary!,
          'app-server',
          'generate-ts',
          '--out',
          outputDir,
        ])
        expect(generated.exitCode, new TextDecoder().decode(generated.stderr)).toBe(0)
        const requests = readFileSync(join(outputDir, 'ClientRequest.ts'), 'utf8')
        const notifications = readFileSync(join(outputDir, 'ServerNotification.ts'), 'utf8')
        const interruptParams = readFileSync(
          join(outputDir, 'v2', 'TurnInterruptParams.ts'),
          'utf8',
        )
        expect(requests).toContain('"method": "thread/start"')
        expect(requests).toContain('"method": "thread/resume"')
        expect(requests).toContain('"method": "turn/start"')
        expect(requests).toContain('"method": "turn/interrupt"')
        expect(notifications).toContain('"method": "item/agentMessage/delta"')
        expect(notifications).toContain('"method": "item/reasoning/summaryTextDelta"')
        expect(notifications).toContain('"method": "thread/tokenUsage/updated"')
        expect(notifications).toContain('"method": "turn/completed"')
        expect(interruptParams).toContain('turnId: string')
      } finally {
        rmSync(outputDir, { recursive: true, force: true })
      }
    },
  )

  test('streams ordered deltas; subsequent turn reuses the live thread and sends only the new message', async () => {
    const calls: any[] = []
    const saved = store()
    let n = 0
    const server = new CodexAppServer({
      binary: 'codex',
      env: {},
      store: saved.api,
      spawnProcess: () =>
        fakeProcess((request, stdout) => {
          calls.push(request)
          if (request.method === 'initialize') reply(stdout, request, {})
          if (request.method === 'thread/start')
            reply(stdout, request, {
              thread: { id: 'thread-1', model: 'gpt-6-luna' },
              model: 'gpt-6-luna',
            })
          if (request.method === 'turn/start') {
            const id = `turn-${++n}`
            reply(stdout, request, { turn: { id } })
            queueMicrotask(() => {
              for (const delta of ['uno ', 'dos ', 'tres'])
                stdout.write(
                  `${JSON.stringify({ method: 'item/agentMessage/delta', params: { threadId: 'thread-1', turnId: id, delta } })}\n`,
                )
              stdout.write(
                `${JSON.stringify({ method: 'thread/tokenUsage/updated', params: { threadId: 'thread-1', turnId: id, tokenUsage: { last: { inputTokens: 5, cachedInputTokens: 2, cacheWriteInputTokens: 1, outputTokens: 3 } } } })}\n`,
              )
              stdout.write(
                `${JSON.stringify({ method: 'turn/completed', params: { threadId: 'thread-1', turn: { id, status: 'completed' } } })}\n`,
              )
            })
          }
        }),
    })
    const log = spyOn(console, 'error').mockImplementation(() => {})
    try {
      const phases = () =>
        log.mock.calls.map(([line]) => JSON.parse(String(line).replace('[codex-turn] ', '')))
      const deltas: string[] = []
      const first = await server.turn({
        sessionId: 's',
        cwd: '/p',
        systemPrompt: 'rules',
        message: 'first',
        transcript: 'Conversation so far\nUser: prior\nCurrent message:\n',
        timeoutMs: 1000,
        onDelta: (x) => deltas.push(x),
      })
      expect(phases().map((phase) => phase.event)).toEqual([
        'thread-start',
        'turn-start',
        'first-delta',
        'turn-completed',
      ])
      const firstPhases = phases()
      expect(
        firstPhases.every(
          (phase) => phase.threadId === 'thread-1' && Number.isFinite(phase.ms) && phase.ms >= 0,
        ),
      ).toBe(true)
      expect(firstPhases.map((phase) => phase.ms)).toEqual(
        firstPhases.map((phase) => phase.ms).sort((a, b) => a - b),
      )
      expect(
        firstPhases.every(
          (phase) =>
            Object.keys(phase).sort().join(',') ===
            (['turn-completed', 'turn-error'].includes(phase.event)
              ? 'dropped,event,ms,notifications,stderrBytes,stdoutBytes,threadId'
              : 'event,ms,threadId'),
        ),
      ).toBe(true)
      log.mockClear()
      const second = await server.turn({
        sessionId: 's',
        cwd: '/p',
        systemPrompt: 'rules',
        message: 'second',
        transcript: 'must not duplicate',
        timeoutMs: 1000,
      })
      expect(phases().map((phase) => phase.event)).toEqual([
        'turn-start',
        'first-delta',
        'turn-completed',
      ])
      expect(deltas).toEqual(['uno ', 'dos ', 'tres'])
      expect(first.text).toBe('uno dos tres')
      expect(first.inputTokens).toBe(3)
      expect(first.cacheReadTokens).toBe(2)
      expect(first.cacheWriteTokens).toBe(1)
      expect(second.text).toBe('uno dos tres')
      expect(calls.filter((x) => x.method === 'thread/resume')).toHaveLength(0)
      expect(calls.filter((x) => x.method === 'thread/start')).toHaveLength(1)
      expect(calls.filter((x) => x.method === 'turn/start')[0].params.input[0].text).toBe(
        'Conversation so far\nUser: prior\nCurrent message:\nfirst',
      )
      expect(calls.filter((x) => x.method === 'turn/start')[1].params.input).toEqual([
        { type: 'text', text: 'second' },
      ])
    } finally {
      log.mockRestore()
      server.kill()
    }
  })

  test('drains large chat stderr and counts bytes per turn without logging its text', async () => {
    let child: ReturnType<typeof fakeProcess>
    let turn = 0
    const payload = Buffer.alloc(256 * 1024, 'x')
    const server = new CodexAppServer({
      binary: 'codex',
      env: {},
      store: store().api,
      spawnProcess: () => {
        child = fakeProcess((request, stdout) => {
          if (request.method === 'initialize') reply(stdout, request, {})
          if (request.method === 'thread/start') reply(stdout, request, { thread: { id: 't' } })
          if (request.method === 'turn/start') {
            const id = `u-${++turn}`
            reply(stdout, request, { turn: { id } })
            setTimeout(() => {
              child.stderr.write(payload, () => {
                stdout.write(
                  `${JSON.stringify({ method: 'turn/completed', params: { threadId: 't', turn: { id, status: 'completed' } } })}\n`,
                )
              })
            }, 0)
          }
        })
        return child
      },
    })
    const log = spyOn(console, 'error').mockImplementation(() => {})
    try {
      for (let i = 0; i < 2; i++)
        await server.turn({
          sessionId: 's',
          cwd: '/p',
          systemPrompt: 'rules',
          message: 'm',
          timeoutMs: 1000,
        })
      const phases = log.mock.calls
        .filter(([line]) => String(line).startsWith('[codex-turn] '))
        .map(([line]) => JSON.parse(String(line).replace('[codex-turn] ', '')))
      const completed = phases.filter((phase) => phase.event === 'turn-completed')
      expect(completed).toHaveLength(2)
      for (const phase of completed) {
        expect(phase.stderrBytes).toBe(payload.length)
        expect(phase.stdoutBytes).toBeGreaterThan(0)
        expect(phase.notifications).toEqual({ 'turn/completed': 1 })
        expect(phase.dropped).toEqual({})
      }
      expect(JSON.stringify(phases)).not.toContain('xxxxxxxx')
    } finally {
      log.mockRestore()
      server.kill()
    }
  })

  test('counts foreign turn deltas before filtering and keeps them out of the callback', async () => {
    const server = new CodexAppServer({
      binary: 'codex',
      env: {},
      store: store().api,
      spawnProcess: () =>
        fakeProcess((request, stdout) => {
          if (request.method === 'initialize') reply(stdout, request, {})
          if (request.method === 'thread/start') reply(stdout, request, { thread: { id: 't' } })
          if (request.method === 'turn/start') {
            reply(stdout, request, { turn: { id: 'u' } })
            setTimeout(() => {
              const send = (method: string, params: unknown) =>
                stdout.write(`${JSON.stringify({ method, params })}\n`)
              send('item/agentMessage/delta', {
                threadId: 't',
                turnId: 'foreign',
                delta: 'private foreign text',
              })
              send('item/agentMessage/delta', {
                threadId: 'other',
                turnId: 'u',
                delta: 'other thread',
              })
              send('item/agentMessage/delta', { threadId: 't', turnId: 'u', delta: 123 })
              send('item/agentMessage/delta', { threadId: 't', turnId: 'u', delta: 'ok' })
              send('turn/completed', { threadId: 't', turn: { id: 'u', status: 'completed' } })
            }, 0)
          }
        }),
    })
    const log = spyOn(console, 'error').mockImplementation(() => {})
    const deltas: string[] = []
    try {
      const result = await server.turn({
        sessionId: 's',
        cwd: '/p',
        systemPrompt: 'rules',
        message: 'm',
        timeoutMs: 1000,
        onDelta: (delta) => deltas.push(delta),
      })
      expect(deltas).toEqual(['ok'])
      expect(result.text).toBe('ok')
      const completed = log.mock.calls
        .filter(([line]) => String(line).startsWith('[codex-turn] '))
        .map(([line]) => JSON.parse(String(line).replace('[codex-turn] ', '')))
        .find((phase) => phase.event === 'turn-completed')
      expect(completed.notifications).toEqual({ 'item/agentMessage/delta': 4, 'turn/completed': 1 })
      expect(completed.dropped).toEqual({
        'turnId-mismatch': 1,
        'no-state': 1,
        'no-delta-string': 1,
      })
      expect(JSON.stringify(completed)).not.toContain('private foreign text')
    } finally {
      log.mockRestore()
      server.kill()
    }
  })

  test('turn-error omits private remote error messages', async () => {
    const server = new CodexAppServer({
      binary: 'codex',
      env: {},
      store: store().api,
      spawnProcess: () =>
        fakeProcess((request, stdout) => {
          if (request.method === 'initialize') reply(stdout, request, {})
          if (request.method === 'thread/start')
            reply(stdout, request, { thread: { id: 'thread-private' } })
          if (request.method === 'turn/start')
            stdout.write(
              `${JSON.stringify({ jsonrpc: '2.0', id: request.id, error: { code: -1, message: 'PRIVATE_CHAT_123' } })}\n`,
            )
        }),
    })
    const log = spyOn(console, 'error').mockImplementation(() => {})
    try {
      await expect(
        server.turn({
          sessionId: 's',
          cwd: '/p',
          systemPrompt: 'rules',
          message: 'private message',
          timeoutMs: 1000,
        }),
      ).rejects.toThrow('PRIVATE_CHAT_123')
      const codexLines = log.mock.calls
        .map(([line]) => String(line))
        .filter((line) => line.startsWith('[codex-turn] '))
      expect(codexLines.some((line) => line.includes('PRIVATE_CHAT_123'))).toBe(false)
      expect(codexLines.some((line) => line.includes('"event":"turn-error"'))).toBe(true)
    } finally {
      log.mockRestore()
      server.kill()
    }
  })

  test('remote error ending in timed out is not reported as a local timeout', async () => {
    const server = new CodexAppServer({
      binary: 'codex',
      env: {},
      store: store().api,
      spawnProcess: () =>
        fakeProcess((request, stdout) => {
          if (request.method === 'initialize') reply(stdout, request, {})
          if (request.method === 'thread/start')
            reply(stdout, request, { thread: { id: 'thread-private' } })
          if (request.method === 'turn/start')
            stdout.write(
              `${JSON.stringify({ jsonrpc: '2.0', id: request.id, error: { code: -1, message: 'secret words timed out' } })}\n`,
            )
        }),
    })
    const log = spyOn(console, 'error').mockImplementation(() => {})
    try {
      await expect(
        server.turn({
          sessionId: 's',
          cwd: '/p',
          systemPrompt: 'rules',
          message: 'private message',
          timeoutMs: 1000,
        }),
      ).rejects.toThrow('secret words timed out')
      const codexLines = log.mock.calls
        .map(([line]) => String(line))
        .filter((line) => line.startsWith('[codex-turn] '))
      expect(codexLines.some((line) => line.includes('secret'))).toBe(false)
      expect(codexLines.some((line) => line.includes('"event":"turn-error"'))).toBe(true)
      expect(codexLines.some((line) => line.includes('"kind":"error"'))).toBe(true)
      expect(codexLines.some((line) => line.includes('"method"'))).toBe(false)
    } finally {
      log.mockRestore()
      server.kill()
    }
  })

  test('CX.6.1 — el costo suma cada llamada del turno; el contexto es el del último evento', async () => {
    const usageEvent = (
      id: string,
      input: number,
      cached: number,
      total: number,
      window: number | null,
    ) =>
      `${JSON.stringify({ method: 'thread/tokenUsage/updated', params: { threadId: 'thread-1', turnId: id, tokenUsage: { last: { totalTokens: total, inputTokens: input, cachedInputTokens: cached, cacheWriteInputTokens: 0, outputTokens: 0 }, modelContextWindow: window } } })}\n`
    const run = async (window: number | null) => {
      const server = new CodexAppServer({
        binary: 'codex',
        env: {},
        store: store().api,
        spawnProcess: () =>
          fakeProcess((request, stdout) => {
            if (request.method === 'initialize') reply(stdout, request, {})
            if (request.method === 'thread/start')
              reply(stdout, request, { thread: { id: 'thread-1', model: 'm' }, model: 'm' })
            if (request.method === 'turn/start') {
              reply(stdout, request, { turn: { id: 'turn-1' } })
              queueMicrotask(() => {
                stdout.write(usageEvent('turn-1', 23567, 0, 23623, window))
                stdout.write(usageEvent('turn-1', 23833, 0, 23919, window))
                stdout.write(usageEvent('turn-1', 32529, 11648, 32569, window))
                stdout.write(
                  `${JSON.stringify({ method: 'turn/completed', params: { threadId: 'thread-1', turn: { id: 'turn-1', status: 'completed' } } })}\n`,
                )
              })
            }
          }),
      })
      const result = await server.turn({
        sessionId: 's',
        cwd: '/p',
        systemPrompt: 'rules',
        message: 'm',
        timeoutMs: 1000,
      })
      server.kill()
      return result
    }
    const measured = await run(258400)
    expect(measured.inputTokens + measured.cacheReadTokens).toBe(79929)
    expect(measured.cacheReadTokens).toBe(11648)
    expect(measured.contextUsed).toBe(32569)
    expect(measured.contextWindow).toBe(258400)
    expect((await run(null)).contextWindow).toBeNull()
  })

  test('AT.20 — threadConfig va en thread/start y la llamada MCP real (codex-cli 0.163.0) llega como paso create_task', async () => {
    const calls: any[] = []
    const fixture = await Bun.file(
      join(import.meta.dir, '..', 'mcp', '__fixtures__', 'codex-create-task-completed.json'),
    ).json()
    const steps: any[] = []
    const server = new CodexAppServer({
      binary: 'codex',
      env: {},
      store: store().api,
      spawnProcess: () =>
        fakeProcess((request, stdout) => {
          calls.push(request)
          if (request.method === 'initialize') reply(stdout, request, {})
          if (request.method === 'thread/start')
            reply(stdout, request, { thread: { id: 'thread-1' } })
          if (request.method === 'turn/start') {
            reply(stdout, request, { turn: { id: 'turn-1' } })
            queueMicrotask(() => {
              fixture.params.threadId = 'thread-1'
              fixture.params.turnId = 'turn-1'
              stdout.write(`${JSON.stringify(fixture)}\n`)
              stdout.write(
                `${JSON.stringify({ method: 'turn/completed', params: { threadId: 'thread-1', turn: { id: 'turn-1', status: 'completed' } } })}\n`,
              )
            })
          }
        }),
    })
    const threadConfig = codexMcpThreadConfig({ tools: ['create_task'], root: '/p' })
    await server.turn({
      sessionId: 's',
      cwd: '/p',
      systemPrompt: 'rules',
      message: 'm',
      threadConfig,
      timeoutMs: 1000,
      onStep: (step) => steps.push(step),
    })
    expect(calls.find((x) => x.method === 'thread/start').params.config).toEqual(threadConfig)
    expect(steps.map(taskProposalFromStep).filter(Boolean)).toEqual([
      {
        ok: true,
        args: {
          title: 'Create hello.txt',
          description: 'Create hello.txt in the project root containing exactly hi.',
          outputs: ['hello.txt'],
        },
      },
    ])
  })

  test('AT.20 — cambio de modo: hilo ya reanudado sin herramienta se reabre con ella y transcripción', async () => {
    const calls: any[] = []
    const steps: any[] = []
    let started = 0
    const server = new CodexAppServer({
      binary: 'codex',
      env: {},
      store: store().api,
      spawnProcess: () =>
        fakeProcess((request, stdout) => {
          calls.push(request)
          if (request.method === 'initialize') reply(stdout, request, {})
          if (request.method === 'thread/start')
            reply(stdout, request, { thread: { id: `thread-${++started}` } })
          if (request.method === 'turn/start') {
            const threadId = request.params.threadId
            reply(stdout, request, { turn: { id: 'turn-1' } })
            queueMicrotask(() =>
              stdout.write(
                `${JSON.stringify({ method: 'turn/completed', params: { threadId, turn: { id: 'turn-1', status: 'completed' } } })}\n`,
              ),
            )
          }
        }),
    })
    const base = { sessionId: 's', cwd: '/p', systemPrompt: 'rules', timeoutMs: 1000 }
    await server.turn({ ...base, message: 'one' })
    await server.turn({
      ...base,
      message: 'two',
      transcript: 'earlier turns\n',
      threadConfig: codexMcpThreadConfig({ tools: ['create_task'], root: '/p' }),
      onStep: (step) => steps.push(step),
    })
    const starts = calls.filter((x) => x.method === 'thread/start')
    expect(starts).toHaveLength(2)
    expect(starts[0].params.config).toBeUndefined()
    expect(starts[1].params.config).toEqual(
      codexMcpThreadConfig({ tools: ['create_task'], root: '/p' }),
    )
    expect(calls.filter((x) => x.method === 'thread/resume')).toHaveLength(0)
    const secondTurn = calls.filter((x) => x.method === 'turn/start')[1]
    expect(secondTurn.params.threadId).toBe('thread-2')
    expect(secondTurn.params.input[0].text).toContain('earlier turns')
    expect(steps.some((s) => String(s.label).includes('restarted to change its tools'))).toBe(true)
    // Mismo estado de herramienta en el turno siguiente: sin reabrir.
    await server.turn({
      ...base,
      message: 'three',
      threadConfig: codexMcpThreadConfig({ tools: ['create_task'], root: '/p' }),
    })
    expect(calls.filter((x) => x.method === 'thread/start')).toHaveLength(2)
    server.kill()
  })

  test('UI.24.7.1 — dos agentMessage del mismo turno se separan con una línea en blanco', async () => {
    const server = new CodexAppServer({
      binary: 'codex',
      env: {},
      store: store().api,
      spawnProcess: () =>
        fakeProcess((request, stdout) => {
          if (request.method === 'initialize') reply(stdout, request, {})
          if (request.method === 'thread/start')
            reply(stdout, request, { thread: { id: 'thread-1', model: 'm' }, model: 'm' })
          if (request.method === 'turn/start') {
            reply(stdout, request, { turn: { id: 'turn-1' } })
            queueMicrotask(() => {
              const send = (method: string, params: unknown) =>
                stdout.write(`${JSON.stringify({ method, params })}\n`)
              const base = { threadId: 'thread-1', turnId: 'turn-1' }
              send('item/agentMessage/delta', { ...base, itemId: 'a', delta: 'Voy a correr `ls`.' })
              send('item/agentMessage/delta', { ...base, itemId: 'b', delta: 'Hay 8 entradas.' })
              send('item/agentMessage/delta', { ...base, itemId: 'b', delta: ' Fin.' })
              send('turn/completed', {
                threadId: 'thread-1',
                turn: { id: 'turn-1', status: 'completed' },
              })
            })
          }
        }),
    })
    const deltas: string[] = []
    const result = await server.turn({
      sessionId: 's',
      cwd: '/p',
      systemPrompt: 'rules',
      message: 'm',
      timeoutMs: 1000,
      onDelta: (x) => deltas.push(x),
    })
    expect(result.text).toBe('Voy a correr `ls`.\n\nHay 8 entradas. Fin.')
    expect(deltas.join('')).toBe(result.text)
    server.kill()
  })

  test('UI.24.6a — imagePaths entran al turn/start como ítems localImage', async () => {
    const calls: any[] = []
    const server = new CodexAppServer({
      binary: 'codex',
      env: {},
      store: store().api,
      spawnProcess: () =>
        fakeProcess((request, stdout) => {
          calls.push(request)
          if (request.method === 'initialize') reply(stdout, request, {})
          if (request.method === 'thread/start') reply(stdout, request, { thread: { id: 't' } })
          if (request.method === 'turn/start') {
            reply(stdout, request, { turn: { id: 'u' } })
            queueMicrotask(() =>
              stdout.write(
                `${JSON.stringify({ method: 'turn/completed', params: { threadId: 't', turn: { id: 'u', status: 'completed' } } })}\n`,
              ),
            )
          }
        }),
    })
    await server.turn({
      sessionId: 's',
      cwd: '/p',
      systemPrompt: 'rules',
      message: 'look',
      imagePaths: ['/tmp/a.png', '/tmp/b.jpg'],
      timeoutMs: 1000,
    })
    expect(calls.find((x) => x.method === 'turn/start').params.input).toEqual([
      { type: 'text', text: 'look' },
      { type: 'localImage', path: '/tmp/a.png' },
      { type: 'localImage', path: '/tmp/b.jpg' },
    ])
    server.kill()
  })

  test('relaunch resumes persisted thread and changed context is sent as an update block', async () => {
    const saved = store()
    const requests: any[] = []
    const launch = () =>
      new CodexAppServer({
        binary: 'codex',
        env: {},
        store: saved.api,
        spawnProcess: () =>
          fakeProcess((request, stdout) => {
            requests.push(request)
            if (request.method === 'initialize') reply(stdout, request, {})
            if (request.method === 'thread/start')
              reply(stdout, request, { thread: { id: 'thread-persisted' }, model: 'gpt-6-luna' })
            if (request.method === 'thread/resume')
              reply(stdout, request, { thread: { id: 'thread-persisted' } })
            if (request.method === 'turn/start') {
              const id = 'turn'
              reply(stdout, request, { turn: { id } })
              queueMicrotask(() =>
                stdout.write(
                  `${JSON.stringify({ method: 'turn/completed', params: { threadId: 'thread-persisted', turn: { id, status: 'completed' } } })}\n`,
                ),
              )
            }
          }),
      })
    const firstServer = launch()
    await firstServer.turn({
      sessionId: 's',
      cwd: '/p',
      systemPrompt: 'system\nNow: 2026-09-28 10:00',
      message: 'one',
      timeoutMs: 1000,
    })
    firstServer.kill()
    const server = launch()
    await server.turn({
      sessionId: 's',
      cwd: '/p',
      systemPrompt: 'system\nNow: 2026-09-28 11:00',
      message: 'two',
      transcript: 'must not duplicate',
      timeoutMs: 1000,
    })
    expect(requests.filter((x) => x.method === 'thread/resume')[0].params).toMatchObject({
      threadId: 'thread-persisted',
      excludeTurns: true,
      sandbox: 'read-only',
      approvalPolicy: 'never',
    })
    expect(requests.filter((x) => x.method === 'turn/start')[1].params.input[0].text).toBe('two')
    await server.turn({
      sessionId: 's',
      cwd: '/p',
      systemPrompt: 'changed rules\nNow: 2026-09-28 11:01',
      message: 'three',
      timeoutMs: 1000,
    })
    expect(requests.filter((x) => x.method === 'turn/start')[2].params.input[0].text).toContain(
      '<orchestos-context-update>',
    )
    server.kill()
  })

  test('expired persisted thread starts a replacement with the full developer prompt', async () => {
    const saved = store()
    saved.api.set('s', 'thread-expired', 'old-context-hash')
    const requests: any[] = []
    const steps: any[] = []
    const server = new CodexAppServer({
      binary: 'codex',
      env: {},
      store: saved.api,
      spawnProcess: () =>
        fakeProcess((request, stdout) => {
          requests.push(request)
          if (request.method === 'initialize') reply(stdout, request, {})
          if (request.method === 'thread/resume')
            stdout.write(
              `${JSON.stringify({ jsonrpc: '2.0', id: request.id, error: { code: -32000, message: 'thread not found' } })}\n`,
            )
          if (request.method === 'thread/start')
            reply(stdout, request, { thread: { id: 'thread-replacement', model: 'gpt-6-luna' } })
          if (request.method === 'turn/start') {
            reply(stdout, request, { turn: { id: 'turn-new' } })
            queueMicrotask(() =>
              stdout.write(
                `${JSON.stringify({ method: 'turn/completed', params: { threadId: 'thread-replacement', turn: { id: 'turn-new', status: 'completed' } } })}\n`,
              ),
            )
          }
        }),
    })
    await server.turn({
      sessionId: 's',
      cwd: '/p',
      systemPrompt: 'current system prompt',
      message: 'new user message',
      transcript: 'Conversation so far\nUser: earlier\nCurrent message:\n',
      timeoutMs: 1000,
      onStep: (step) => steps.push(step),
    })
    expect(requests.filter((x) => x.method === 'thread/start')).toHaveLength(1)
    expect(requests.find((x) => x.method === 'thread/start').params.developerInstructions).toBe(
      'current system prompt',
    )
    expect(requests.find((x) => x.method === 'turn/start').params.input).toEqual([
      {
        type: 'text',
        text: 'Conversation so far\nUser: earlier\nCurrent message:\nnew user message',
      },
    ])
    expect(saved.api.get('s')).toEqual({
      threadId: 'thread-replacement',
      contextHash: codexContextHash('current system prompt'),
    })
    expect(steps).toContainEqual(
      expect.objectContaining({
        type: 'reasoning',
        label: 'Codex thread expired — started a new one (earlier turns were resent)',
      }),
    )
    server.kill()
  })
})

for (const scenario of ['retry', 'quota', 'quota-future', 'timeout', 'normal'] as const) {
  test(`CHAT.3 ${scenario}: notices arrive before completion`, async () => {
    const resetAt = new Date()
    resetAt.setHours(23, 59, 0, 0)
    if (scenario === 'quota-future') resetAt.setDate(resetAt.getDate() + 2)
    const steps: import('../run/executors/step-event.ts').ExecutorStepEvent[] = []
    const server = new CodexAppServer({
      binary: 'fake',
      env: {},
      store: store().api,
      spawnProcess: () =>
        fakeProcess((request, stdout) => {
          if (request.method === 'initialize') reply(stdout, request, {})
          if (request.method === 'thread/start') reply(stdout, request, { thread: { id: 't' } })
          if (request.method === 'turn/interrupt') reply(stdout, request, {})
          if (request.method !== 'turn/start') return
          reply(stdout, request, { turn: { id: 'u' } })
          queueMicrotask(() => {
            const send = (method: string, params: any) =>
              stdout.write(`${JSON.stringify({ method, params })}\n`)
            send('turn/started', { threadId: 't', turn: { id: 'u' } })
            if (scenario === 'retry')
              send('error', {
                threadId: 't',
                turnId: 'u',
                willRetry: true,
                error: { message: 'stream disconnected — reconnecting 1/5' },
              })
            if (scenario === 'quota' || scenario === 'quota-future')
              send('account/rateLimits/updated', {
                rateLimits: {
                  primary: { usedPercent: 100, resetsAt: resetAt.getTime() / 1000 },
                  secondary: { usedPercent: 30 },
                },
              })
            if (scenario !== 'timeout')
              setTimeout(() => {
                if (scenario === 'normal')
                  send('item/agentMessage/delta', { threadId: 't', turnId: 'u', delta: 'ok' })
                send('turn/completed', { threadId: 't', turn: { id: 'u', status: 'completed' } })
              }, 5)
          })
        }),
    })
    try {
      const pending = server.turn({
        sessionId: 's',
        cwd: '/p',
        model: 'gpt-test',
        systemPrompt: '',
        message: 'hello',
        timeoutMs: 25,
        onStep: (step) => steps.push(step),
      })
      if (scenario === 'timeout')
        await expect(pending).rejects.toThrow('Codex timed out after 25ms')
      else await pending
      expect(steps.find((step) => step.notice?.kind === 'no-response')?.notice?.message).toContain(
        'gpt-test',
      )
      const notices = steps.flatMap((step) =>
        step.notice && step.notice.kind !== 'no-response' ? [step.notice] : [],
      )
      if (scenario === 'normal') expect(notices).toEqual([])
      if (scenario === 'retry')
        expect(notices[0]).toMatchObject({
          kind: 'retrying',
          message: 'stream disconnected — reconnecting 1/5',
        })
      if (scenario === 'quota' || scenario === 'quota-future')
        expect(notices[0]?.message).toBe(
          `Codex usage limit reached — resets at ${scenario === 'quota-future' ? `${resetAt.toLocaleDateString('en-US')} ` : ''}23:59`,
        )
      if (scenario === 'timeout')
        expect(notices[0]).toMatchObject({
          kind: 'timeout',
          message: 'No response from gpt-test in 0.025 s. Codex reported no error.',
        })
    } finally {
      server.kill()
    }
  })
}

for (const scenario of ['system-error', 'no-auth', 'healthy', 'unknown-enums'] as const) {
  test(`CHAT.3 status diagnostics ${scenario}: safe values and truthful timeout`, async () => {
    const steps: import('../run/executors/step-event.ts').ExecutorStepEvent[] = []
    const logs: string[] = []
    const logger = spyOn(console, 'error').mockImplementation((line) => logs.push(String(line)))
    const server = new CodexAppServer({
      binary: 'fake',
      env: {},
      store: store().api,
      spawnProcess: () =>
        fakeProcess((request, stdout) => {
          if (request.method === 'initialize') reply(stdout, request, {})
          if (request.method === 'thread/start') reply(stdout, request, { thread: { id: 't' } })
          if (request.method === 'turn/interrupt') reply(stdout, request, {})
          if (request.method !== 'turn/start') return
          reply(stdout, request, { turn: { id: 'u' } })
          queueMicrotask(() => {
            const send = (method: string, params: any) =>
              stdout.write(`${JSON.stringify({ method, params })}\n`)
            send('turn/started', { threadId: 't', turn: { id: 'u' } })
            send('thread/status/changed', {
              threadId: 't',
              status: {
                type: scenario === 'system-error' ? 'systemError' : 'active',
                activeFlags: ['waitingOnApproval', 'waitingOnUserInput', 'secret-flag'],
              },
            })
            send('account/updated', {
              authMode:
                scenario === 'no-auth'
                  ? null
                  : scenario === 'unknown-enums'
                    ? 'secret-auth'
                    : 'chatgpt',
              planType: scenario === 'unknown-enums' ? 'secret-plan' : 'pro',
              email: 'secret-email',
              accessToken: 'secret-token',
            })
          })
        }),
    })
    try {
      let failure: CliFailure | undefined
      try {
        await server.turn({
          sessionId: 's',
          cwd: '/p',
          systemPrompt: '',
          message: 'secret-prompt',
          model: 'gpt-test',
          timeoutMs: 25,
          onStep: (step) => steps.push(step),
        })
      } catch (error) {
        expect(error).toBeInstanceOf(CliFailure)
        failure = error as CliFailure
      }
      expect(failure).toBeDefined()
      const notices = steps.flatMap((step) =>
        step.notice && step.notice.kind !== 'no-response' ? [step.notice] : [],
      )
      if (scenario === 'system-error' || scenario === 'no-auth') {
        expect(notices[0]?.kind).toBe(scenario === 'system-error' ? 'unknown' : 'auth')
        expect(failure?.notice.message).toBe(notices[0]?.message)
        expect(failure?.notice.message).not.toContain('Codex reported no error')
      } else {
        expect(notices).toHaveLength(1)
        expect(failure?.notice.message).toBe(
          'No response from gpt-test in 0.025 s. Codex reported no error.',
        )
      }
      const diagnostics = logs
        .filter((line) => line.includes('[codex-turn]'))
        .map((line) => JSON.parse(line.slice('[codex-turn] '.length)))
      expect(diagnostics.find((entry) => entry.event === 'thread/status/changed')?.status).toEqual({
        type: scenario === 'system-error' ? 'systemError' : 'active',
        activeFlags: ['waitingOnApproval', 'waitingOnUserInput'],
      })
      expect(diagnostics.find((entry) => entry.event === 'account/updated')).toMatchObject({
        fields: ['authMode', 'planType', 'email', 'accessToken'],
        authMode:
          scenario === 'no-auth' ? null : scenario === 'unknown-enums' ? 'unknown' : 'chatgpt',
        planType: scenario === 'unknown-enums' ? 'unknown' : 'pro',
      })
      expect(logs.join('\n')).not.toContain('secret-')
      expect(JSON.stringify(notices)).not.toContain('secret-')
    } finally {
      server.kill()
      logger.mockRestore()
    }
  })
}

test('CHAT.3 CI.11 userMessage items preserve the live waiting phase and no-response timeout', async () => {
  const steps: import('../run/executors/step-event.ts').ExecutorStepEvent[] = []
  const originalSetTimeout = globalThis.setTimeout
  const timer = spyOn(globalThis, 'setTimeout').mockImplementation(((
    handler: TimerHandler,
    delay?: number,
    ...args: any[]
  ) => originalSetTimeout(handler, delay === 120_000 ? 25 : delay, ...args)) as typeof setTimeout)
  const server = new CodexAppServer({
    binary: 'fake',
    env: {},
    store: store().api,
    spawnProcess: () =>
      fakeProcess((request, stdout) => {
        if (request.method === 'initialize') reply(stdout, request, {})
        if (request.method === 'thread/start') reply(stdout, request, { thread: { id: 't' } })
        if (request.method === 'turn/interrupt') reply(stdout, request, {})
        if (request.method !== 'turn/start') return
        reply(stdout, request, { turn: { id: 'u' } })
        queueMicrotask(() => {
          const send = (method: string, params: any) =>
            stdout.write(`${JSON.stringify({ method, params })}\n`)
          send('turn/started', { threadId: 't', turn: { id: 'u' } })
          const params = {
            threadId: 't',
            turnId: 'u',
            item: { id: 'user-1', type: 'userMessage', content: [{ type: 'text', text: 'hello' }] },
          }
          send('item/started', params)
          send('item/completed', params)
        })
      }),
  })
  try {
    const result = server
      .turn({
        sessionId: 's',
        cwd: '/p',
        model: 'gpt-test',
        systemPrompt: '',
        message: 'hello',
        timeoutMs: 120_000,
        onStep: (event) => {
          if (event.notice?.kind === 'timeout') {
            const turn: TimelineTurn = {
              id: 'turn',
              status: 'pending',
              error: null,
              createdAt: '2026-10-25T10:00:00Z',
              updatedAt: '2026-10-25T10:00:00Z',
              steps: steps.map((step, seq) => ({
                seq,
                type: step.type,
                notice: step.notice,
                tool: null,
                target: null,
                added: null,
                removed: null,
                exitCode: null,
                ok: null,
                output: null,
                detail: step.detail ?? null,
                durationMs: null,
                createdAt: '2026-10-25T10:00:00Z',
              })),
            }
            expect(livePhase(turn, false)).toBe(
              'Request sent to gpt-test — no response yet, no error reported by Codex',
            )
          }
          steps.push(event)
        },
      })
      .catch((error) => error)
    const error = await result
    expect(error).toBeInstanceOf(CliFailure)
    expect(error.notice).toEqual({
      kind: 'timeout',
      message: 'No response from gpt-test in 120 s. Codex reported no error.',
      detail: 'Codex timed out after 120000ms',
    })
    expect(steps.map((step) => step.type)).toEqual(['notice', 'notice'])
    expect(steps.some((step) => step.type === 'reasoning')).toBe(false)
  } finally {
    timer.mockRestore()
    server.kill()
  }
})

for (const scenario of [
  '429',
  '503',
  'other-thread',
  'old-turn',
  'old-row',
  'missing',
  'wrong-schema',
  'responded',
] as const) {
  test(`CHAT.3 native Codex retry log: ${scenario}`, async () => {
    const home = mkdtempSync(join(tmpdir(), 'chat3-native-log-'))
    const steps: import('../run/executors/step-event.ts').ExecutorStepEvent[] = []
    const logs = spyOn(console, 'error').mockImplementation(() => {})
    const interval = globalThis.setInterval
    const polling = spyOn(globalThis, 'setInterval').mockImplementation(((
      fn: TimerHandler,
      delay?: number,
      ...args: any[]
    ) => interval(fn, delay === 2_000 ? 5 : delay, ...args)) as typeof setInterval)
    let fixture: Database | undefined
    if (scenario !== 'missing') {
      fixture = new Database(join(home, 'logs_2.sqlite'))
      fixture.exec(
        scenario === 'wrong-schema'
          ? 'CREATE TABLE logs (body TEXT)'
          : `CREATE TABLE logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, ts_nanos INTEGER NOT NULL,
        level TEXT NOT NULL, target TEXT NOT NULL, feedback_log_body TEXT, module_path TEXT,
        file TEXT, line INTEGER, thread_id TEXT, process_uuid TEXT, estimated_bytes INTEGER NOT NULL DEFAULT 0
      ); CREATE INDEX idx_logs_thread_id_ts ON logs(thread_id, ts)`,
      )
    }
    const status = scenario === '503' ? '503 Service Unavailable' : '429 Too Many Requests'
    const server = new CodexAppServer({
      binary: 'fake',
      env: { CODEX_HOME: home },
      store: store().api,
      spawnProcess: () =>
        fakeProcess((request, stdout) => {
          if (request.method === 'initialize' || request.method === 'turn/interrupt')
            reply(stdout, request, {})
          if (request.method === 'thread/start')
            reply(stdout, request, { thread: { id: 'native-thread' } })
          if (request.method !== 'turn/start') return
          reply(stdout, request, { turn: { id: 'native-turn' } })
          if (fixture && scenario !== 'wrong-schema') {
            for (const attempt of [1, 1, 2])
              fixture
                .query(
                  "INSERT INTO logs (ts,ts_nanos,level,target,feedback_log_body,thread_id) VALUES (?,0,'WARN','codex_core',?,?)",
                )
                .run(
                  Math.floor(Date.now() / 1000) - (scenario === 'old-row' ? 10 : 0),
                  `session_loop{private_context=SECRET}: stream disconnected - retrying sampling request (${attempt}/5 in 69.999812541s)... turn_id=${scenario === 'old-turn' ? 'previous-turn' : 'native-turn'} retries=${attempt} max_retries=5 sampling_error=exceeded retry limit, last status: ${status}`,
                  scenario === 'other-thread' ? 'another-thread' : 'native-thread',
                )
          }
          if (scenario === 'responded')
            stdout.write(
              `${JSON.stringify({ method: 'item/agentMessage/delta', params: { threadId: 'native-thread', turnId: 'native-turn', delta: 'hello' } })}\n`,
            )
        }),
    })
    try {
      const error = await server
        .turn({
          sessionId: 's',
          cwd: '/p',
          model: 'gpt-test',
          systemPrompt: '',
          message: 'hello',
          timeoutMs: 45,
          onStep: (step) => steps.push(step),
        })
        .catch((error) => error)
      expect(error).toBeInstanceOf(CliFailure)
      const retries = steps.flatMap((step) =>
        step.notice?.kind === 'retrying' ? [step.notice] : [],
      )
      if (scenario === '429' || scenario === '503') {
        expect(retries.map((notice) => notice.message)).toEqual([
          `Codex got ${status} — retry 1/5 in 70 s`,
          `Codex got ${status} — retry 2/5 in 70 s`,
        ])
        expect(retries[0]?.detail).toBe(
          scenario === '429'
            ? 'Codex request rate limit reached.'
            : 'Codex model provider is overloaded.',
        )
        expect(error.notice.message).toBe(
          `No response from gpt-test in 0.045 s — Codex got ${status} and was waiting to retry (2/5 in 70 s).`,
        )
        expect(JSON.stringify(steps)).not.toContain('SECRET')
        expect(logs.mock.calls.some(([line]) => String(line).includes('nativeLogReadErrors'))).toBe(
          false,
        )
      } else {
        expect(retries).toEqual([])
        expect(error.notice.kind).toBe('timeout')
        expect(error.notice.message).not.toContain('429')
        if (scenario === 'missing' || scenario === 'wrong-schema')
          expect(
            logs.mock.calls.some(([line]) => String(line).includes('nativeLogReadErrors')),
          ).toBe(true)
      }
      expect(steps.filter((step) => step.notice?.kind === 'timeout')).toHaveLength(1)
      // Polling must stop when the turn ends, including failed reads.
      const count = steps.length
      await Bun.sleep(15)
      expect(steps).toHaveLength(count)
    } finally {
      server.kill()
      polling.mockRestore()
      logs.mockRestore()
      fixture?.close()
      rmSync(home, { recursive: true, force: true })
    }
  })
}
