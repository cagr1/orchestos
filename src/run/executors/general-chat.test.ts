import { expect, test } from 'bun:test'
import { EventEmitter } from 'node:events'
import { PassThrough } from 'node:stream'
import { CodexAppServer } from './codex-app-server.ts'
import { buildClaudeChatArgs, CLAUDE_GENERAL_CHAT_TOOLS } from './external.ts'

test('USO.11 Claude general chat allows document/web tools without widening project chat or attachment roots', () => {
  const args = (general: boolean) =>
    buildClaudeChatArgs(
      '',
      undefined,
      undefined,
      '/settings',
      '/chat',
      '/attachments',
      undefined,
      undefined,
      general,
    )
  const project = args(false)
  const general = args(true)
  expect(project[project.indexOf('--tools') + 1]).toBe('Read,Glob,Grep')
  expect(project).not.toContain('--permission-mode')
  expect(project).toContain('/attachments')
  expect(general[general.indexOf('--tools') + 1]).toBe(CLAUDE_GENERAL_CHAT_TOOLS)
  expect(CLAUDE_GENERAL_CHAT_TOOLS).toBe('Read,Glob,Grep,Write,Edit,WebSearch,WebFetch')
  expect(general).toContain('--restricted')
  expect(general).toContain('--strict-mcp-config')
  expect(general).toContain('acceptEdits')
  expect(general).not.toContain('/attachments')
  expect(general).not.toContain('Bash')
})

for (const generalChat of [false, true]) {
  test(`USO.11 Codex ${generalChat ? 'general' : 'project'} thread/turn policy and config`, async () => {
    const calls: { method: string; params: Record<string, unknown> }[] = []
    const stdout = new PassThrough()
    const stdin = new PassThrough()
    const child = Object.assign(new EventEmitter(), {
      stdout,
      stdin,
      stderr: new PassThrough(),
      kill: () => {
        child.emit('exit', 0, null)
        return true
      },
    })
    let buffer = ''
    stdin.on('data', (data) => {
      buffer += String(data)
      while (buffer.includes('\n')) {
        const end = buffer.indexOf('\n')
        const request = JSON.parse(buffer.slice(0, end))
        buffer = buffer.slice(end + 1)
        calls.push(request)
        if (request.id === undefined) continue
        const result =
          request.method === 'thread/start'
            ? { thread: { id: 'thread' } }
            : request.method === 'turn/start'
              ? { turn: { id: 'turn' } }
              : {}
        stdout.write(`${JSON.stringify({ id: request.id, result })}\n`)
        if (request.method === 'turn/start')
          queueMicrotask(() =>
            stdout.write(
              `${JSON.stringify({ method: 'turn/completed', params: { threadId: 'thread', turn: { id: 'turn', status: 'completed' } } })}\n`,
            ),
          )
      }
    })
    const server = new CodexAppServer({
      binary: 'fake',
      env: {},
      store: { get: () => ({ threadId: null, contextHash: null }), set: () => {} },
      spawnProcess: () =>
        child as unknown as import('node:child_process').ChildProcessWithoutNullStreams,
    })
    try {
      await server.turn({
        sessionId: 'session',
        cwd: '/chat',
        systemPrompt: '',
        message: 'hello',
        timeoutMs: 1000,
        generalChat,
        threadConfig: generalChat ? { web_search: 'live' } : undefined,
      })
      const start = calls.find((call) => call.method === 'thread/start')!
      expect(start.params.sandbox).toBe(generalChat ? 'workspace-write' : 'read-only')
      expect(start.params.config).toEqual(generalChat ? { web_search: 'live' } : undefined)
      const turn = calls.find((call) => call.method === 'turn/start')!
      expect(turn.params.sandboxPolicy).toEqual(
        generalChat
          ? { type: 'workspaceWrite', writableRoots: ['/chat'], networkAccess: false }
          : { type: 'readOnly', networkAccess: false },
      )
      expect(turn.params.approvalPolicy).toBe('never')
    } finally {
      server.kill()
    }
  })
}
