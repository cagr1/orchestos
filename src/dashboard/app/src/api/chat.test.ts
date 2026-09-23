import { describe, expect, test } from 'bun:test'
import {
  attachTurnDetails,
  createSession,
  execCommand,
  getConsole,
  mapMessage,
  mapSessionToThread,
  newChatProjectId,
  runProjectTask,
  sendMessage,
  sessionListQueries,
  toTimestamp,
} from './chat'

describe('chat API mapping', () => {
  test('requests the visible project and general chats, or only general chats without projects', () => {
    expect(sessionListQueries('project-1')).toEqual(['?project=project-1', '?project=none'])
    expect(sessionListQueries(null)).toEqual(['?project=none'])
  })

  test('binds New chat to the visible project unless No project is explicit', () => {
    expect(newChatProjectId('project-1')).toBe('project-1')
    expect(newChatProjectId(undefined)).toBeNull()
    expect(newChatProjectId('project-1', null)).toBeNull()
    expect(newChatProjectId('project-1', 'project-2')).toBe('project-2')
  })

  test('runs an approved task until the server leaves pending', async () => {
    const originalFetch = globalThis.fetch
    const statuses = ['pending', 'running', 'done']
    const calls: string[] = []
    let started = false
    globalThis.fetch = (async (input) => {
      const path = String(input)
      calls.push(path)
      if (path.endsWith('/run')) return new Response(JSON.stringify({ ok: true }), { status: 200 })
      const status = statuses.shift() ?? 'done'
      return new Response(
        JSON.stringify({ tasks: [{ id: 'task-1', description: 'x', status, retryReason: null }] }),
        { status: 200 },
      )
    }) as typeof fetch
    try {
      await runProjectTask('task-1', 'project-1', () => {
        started = true
      })
    } finally {
      globalThis.fetch = originalFetch
    }
    expect(calls.filter((path) => path.endsWith('/api/tasks')).length).toBe(3)
    expect(started).toBe(true)
  })

  test('surfaces the persisted task failure reason', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async (input) => {
      if (String(input).endsWith('/run'))
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      return new Response(
        JSON.stringify({
          tasks: [
            {
              id: 'task-1',
              description: 'x',
              status: 'failed',
              retryReason: 'sandbox refused dirty tree',
            },
          ],
        }),
        { status: 200 },
      )
    }) as typeof fetch
    try {
      await expect(runProjectTask('task-1', 'project-1')).rejects.toThrow(
        'sandbox refused dirty tree',
      )
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('creates project chats without forcing chat mode', async () => {
    const originalFetch = globalThis.fetch
    let body: Record<string, unknown> | undefined
    globalThis.fetch = (async (_input, init) => {
      body = JSON.parse(String(init?.body)) as Record<string, unknown>
      return new Response(
        JSON.stringify({
          id: 'session-1',
          projectId: 'project-1',
          agent: 'codex',
          mode: 'code',
          title: 'New chat',
          createdAt: '2026-09-23T12:00:00.000Z',
          updatedAt: '2026-09-23T12:00:00.000Z',
        }),
        { status: 200 },
      )
    }) as typeof fetch
    try {
      await createSession({ agent: 'codex', projectId: 'project-1' })
    } finally {
      globalThis.fetch = originalFetch
    }
    expect(body).toEqual({ agent: 'codex', projectId: 'project-1' })
  })

  test('maps persisted session and message rows to the prototype types', () => {
    const thread = mapSessionToThread(
      {
        id: 'session-1',
        projectId: null,
        agent: 'api',
        mode: 'chat',
        title: 'Real chat',
        createdAt: '2026-09-21T12:00:00.000Z',
        updatedAt: '2026-09-21T12:01:00.000Z',
      },
      [
        {
          id: 1,
          sessionId: 'session-1',
          role: 'assistant',
          content: 'Persisted answer',
          model: 'model-x',
          taskId: null,
          ocrUsed: [],
          taskHeld: false,
          existingFiles: [],
          createdAt: '2026-09-21T12:01:00.000Z',
        },
      ],
    )
    expect(thread).toMatchObject({ id: 'session-1', title: 'Real chat', agent: 'api' })
    expect(thread.messages[0]).toMatchObject({
      id: '1',
      content: 'Persisted answer',
      model: 'model-x',
    })
  })

  test('sends the same session/message controls as the legacy composer', async () => {
    const calls: RequestInit[] = []
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async (_input, init) => {
      calls.push(init ?? {})
      return new Response(JSON.stringify({ text: 'ok' }), { status: 200 })
    }) as typeof fetch
    try {
      await sendMessage({
        sessionId: 'session-1',
        message: 'hello',
        agent: 'api',
        model: 'provider/model',
        effort: 'High',
        attachments: [{ id: 'file-1', name: 'notes.txt', size: '1 KB', type: 'file' }],
      })
    } finally {
      globalThis.fetch = originalFetch
    }
    const body = JSON.parse(String(calls[0].body))
    expect(body).toMatchObject({
      sessionId: 'session-1',
      history: [],
      message: 'hello',
      model: 'provider/model',
      effort: 'high',
      fileIds: ['file-1'],
    })
    expect(typeof body.requestKey).toBe('string')
  })

  test('maps held tasks without inventing a response body', () => {
    expect(
      mapMessage({
        id: 7,
        sessionId: 's',
        role: 'assistant',
        content: 'Review this',
        model: null,
        taskId: 'task-7',
        ocrUsed: [],
        taskHeld: true,
        existingFiles: ['src/a.ts'],
        createdAt: '2026-09-21T12:00:00.000Z',
      }),
    ).toMatchObject({ taskHeld: true, heldTask: { taskId: 'task-7' } })
  })

  test('attaches ordered reasoning and tool statuses to the assistant turn', () => {
    const rows = [
      {
        id: 1,
        sessionId: 's',
        role: 'assistant' as const,
        content: 'done',
        model: null,
        taskId: null,
        ocrUsed: [],
        taskHeld: false,
        existingFiles: [],
        turnId: 'turn-1',
        createdAt: '2026-09-21T12:00:00.000Z',
      },
    ]
    const message = mapMessage(rows[0])
    const detailed = attachTurnDetails([message], rows, {
      turns: [
        {
          id: 'turn-1',
          status: 'completed',
          createdAt: '',
          updatedAt: '',
          error: null,
          steps: [
            {
              seq: 2,
              type: 'tool_use',
              tool: 'command',
              target: null,
              added: null,
              removed: null,
              exitCode: 1,
              ok: false,
              output: 'nope',
              detail: 'ls missing',
              durationMs: 4,
              createdAt: '',
            },
            {
              seq: 0,
              type: 'reasoning',
              tool: null,
              target: null,
              added: null,
              removed: null,
              exitCode: null,
              ok: null,
              output: null,
              detail: '**inspect repo**',
              durationMs: null,
              createdAt: '',
            },
            {
              seq: 1,
              type: 'tool_use',
              tool: 'command',
              target: 'README.md',
              added: null,
              removed: null,
              exitCode: 0,
              ok: true,
              output: 'ok',
              detail: null,
              durationMs: 2,
              createdAt: '',
            },
          ],
        },
      ],
      messages: rows,
      commands: [],
      pending: false,
      events: [],
    })
    expect(detailed[0]).toMatchObject({ reasoning: ['inspect repo'] })
    expect(detailed[0]?.toolCalls).toEqual([
      {
        name: 'command',
        args: { target: 'README.md' },
        result: 'ok',
        status: 'success',
        durationMs: 2,
      },
      {
        name: 'command',
        args: { command: 'ls missing' },
        result: 'nope',
        status: 'failed',
        durationMs: 4,
      },
    ])
  })

  test('leaves messages without a turn id unchanged', () => {
    const message = mapMessage({
      id: 1,
      sessionId: 's',
      role: 'assistant',
      content: 'plain',
      model: null,
      taskId: null,
      ocrUsed: [],
      taskHeld: false,
      existingFiles: [],
      turnId: null,
      createdAt: '2026-09-21T12:00:00.000Z',
    })
    expect(
      attachTurnDetails([message], [{ ...message, id: 1 } as never], {
        turns: [],
        messages: [],
        commands: [],
        pending: false,
        events: [],
      }),
    ).toEqual([message])
  })

  test('renders SQLite UTC timestamps in the browser local timezone', () => {
    const sqliteValue = '2026-09-21 12:00:00'
    expect(toTimestamp(sqliteValue)).toBe(
      new Date('2026-09-21T12:00:00Z').toLocaleString([], { hour: '2-digit', minute: '2-digit' }),
    )
  })

  test('loads the real console and executes a command for a session', async () => {
    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = []
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async (input, init) => {
      calls.push({ input, init })
      const body =
        calls.length === 1
          ? { lines: [{ at: '2026-09-22T12:00:00Z', kind: 'output', text: 'ok' }], pending: false }
          : {
              id: 1,
              cmd: 'ls',
              exitCode: 0,
              stdout: 'src',
              stderr: '',
              elapsedMs: 4,
              timedOut: false,
            }
      return new Response(JSON.stringify(body), { status: 200 })
    }) as typeof fetch
    try {
      await expect(getConsole('session-1')).resolves.toMatchObject({ pending: false })
      await expect(execCommand('session-1', 'ls')).resolves.toMatchObject({ exitCode: 0 })
    } finally {
      globalThis.fetch = originalFetch
    }
    expect(String(calls[0]?.input)).toContain('/console')
    expect(String(calls[1]?.input)).toContain('/exec')
    expect(JSON.parse(String(calls[1]?.init?.body))).toEqual({ cmd: 'ls' })
  })
})
