import { describe, expect, test } from 'bun:test'
import { EventEmitter } from 'node:events'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PassThrough } from 'node:stream'
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
      // console.debug('fake codex request', request.method)
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
    const second = await server.turn({
      sessionId: 's',
      cwd: '/p',
      systemPrompt: 'rules',
      message: 'second',
      transcript: 'must not duplicate',
      timeoutMs: 1000,
    })
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
