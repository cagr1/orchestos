import { describe, expect, test } from 'bun:test'
import { execCommand, getConsole, mapMessage, mapSessionToThread, sendMessage } from './chat'

describe('chat API mapping', () => {
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
