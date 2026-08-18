import { describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

async function runIsolated(body: string): Promise<Record<string, unknown>> {
  const home = mkdtempSync(join(tmpdir(), 'orchestos-chat-sessions-'))
  try {
    const proc = Bun.spawn(['bun', '-e', body], {
      cwd: process.cwd(),
      env: { ...process.env, ORCHESTOS_HOME: home, OPENROUTER_API_KEY: 'test-key' },
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const [exitCode, stdout, stderr] = await Promise.all([
      proc.exited,
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ])
    expect(exitCode, stderr).toBe(0)
    return JSON.parse(stdout) as Record<string, unknown>
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
}

describe('CC.2 — chat sessions backend', () => {
  it('implements CRUD, immutable agent, persistence and cascade delete', async () => {
    const result = await runIsolated(`
      const { runMigrations } = await import('./src/db/migrate.ts')
      const { db } = await import('./src/db/sqlite.ts')
      const handlers = await import('./src/dashboard/handlers/chat-sessions.ts')
      const sessions = await import('./src/db/chat-sessions.ts')
      const { route } = await import('./src/dashboard/server.ts')
      runMigrations()
      db.run('INSERT INTO projects (id, path, stack_profile, agents_md, last_updated) VALUES (?, ?, ?, ?, ?)', ['p1', '/tmp/p1', '{}', '', new Date().toISOString()])

      const createdResponse = await handlers.handleApiChatSessionsCreate(new Request('http://localhost/api/chat/sessions', {
        method: 'POST', body: JSON.stringify({ projectId: 'p1', agent: 'claude', mode: 'chat', title: 'Session one' })
      }))
      const created = await createdResponse.json()
      const routedListResponse = await route(new Request('http://localhost:50852/api/chat/sessions'), 50852)
      const routedList = await routedListResponse.json()
      const immutableResponse = await handlers.handleApiChatSessionPatch(new Request('http://localhost/api/chat/sessions/' + created.id, {
        method: 'PATCH', body: JSON.stringify({ agent: 'api' })
      }), new URL('http://localhost/api/chat/sessions/' + created.id))
      const updatedResponse = await handlers.handleApiChatSessionPatch(new Request('http://localhost/api/chat/sessions/' + created.id, {
        method: 'PATCH', body: JSON.stringify({ mode: 'code', title: 'Renamed' })
      }), new URL('http://localhost/api/chat/sessions/' + created.id))
      const updated = await updatedResponse.json()

      sessions.appendChatExchange({ sessionId: created.id, userContent: 'hola', assistantContent: 'respuesta', model: 'test-model', ocrUsed: ['image.png'] })
      const messagesResponse = handlers.handleApiChatSessionMessages(new URL('http://localhost/api/chat/sessions/' + created.id + '/messages'))
      const messages = await messagesResponse.json()
      const invalidProject = await handlers.handleApiChatSessionsCreate(new Request('http://localhost/api/chat/sessions', {
        method: 'POST', body: JSON.stringify({ projectId: 'missing', agent: 'api' })
      }))
      const deleted = handlers.handleApiChatSessionDelete(new URL('http://localhost/api/chat/sessions/' + created.id))
      const remainingMessages = db.query('SELECT COUNT(*) AS count FROM chat_messages WHERE session_id = ?').get(created.id).count

      process.stdout.write(JSON.stringify({
        createStatus: createdResponse.status,
        created,
        routedListStatus: routedListResponse.status,
        routedList,
        immutableStatus: immutableResponse.status,
        updatedStatus: updatedResponse.status,
        updated,
        messagesStatus: messagesResponse.status,
        messages,
        invalidProjectStatus: invalidProject.status,
        deleteStatus: deleted.status,
        remainingMessages,
        chatAllowsExecution: sessions.sessionAllowsTaskExecution('chat'),
        codeAllowsExecution: sessions.sessionAllowsTaskExecution('code'),
      }))
      db.close()
    `)

    expect(result.createStatus).toBe(201)
    expect(result.created).toMatchObject({ projectId: 'p1', agent: 'claude', mode: 'chat', title: 'Session one' })
    expect(result.routedListStatus).toBe(200)
    expect(result.routedList).toEqual([expect.objectContaining({ id: expect.any(String), agent: 'claude' })])
    expect(result.immutableStatus).toBe(400)
    expect(result.updatedStatus).toBe(200)
    expect(result.updated).toMatchObject({ agent: 'claude', mode: 'code', title: 'Renamed' })
    expect(result.messagesStatus).toBe(200)
    expect(result.messages).toEqual([
      expect.objectContaining({ role: 'user', content: 'hola', ocrUsed: ['image.png'] }),
      expect.objectContaining({ role: 'assistant', content: 'respuesta', model: 'test-model', ocrUsed: ['image.png'] }),
    ])
    expect(result.invalidProjectStatus).toBe(400)
    expect(result.deleteStatus).toBe(200)
    expect(result.remainingMessages).toBe(0)
    expect(result.chatAllowsExecution).toBe(false)
    expect(result.codeAllowsExecution).toBe(true)
  })

  it('POST /api/chat uses persisted history and never writes from Chat mode', async () => {
    const result = await runIsolated(`
      const { mkdirSync, writeFileSync, existsSync } = await import('fs')
      const { join } = await import('path')
      const home = process.env.ORCHESTOS_HOME
      const cacheDir = join(home, '.orchestos', 'cache')
      mkdirSync(cacheDir, { recursive: true })
      writeFileSync(join(cacheDir, 'models.json'), JSON.stringify({
        fetchedAt: Date.now(),
        models: { 'deepseek/deepseek-v4-flash': { contextLength: 64000, priceIn: 0, priceOut: 0, supportsReasoning: false, supportsTools: false, maxOutputTokens: 8192, supportsVision: false } }
      }))
      const projectDir = join(home, 'empty-project')
      mkdirSync(projectDir, { recursive: true })

      const { runMigrations } = await import('./src/db/migrate.ts')
      const { db } = await import('./src/db/sqlite.ts')
      const { createChatSession, listChatMessages } = await import('./src/db/chat-sessions.ts')
      const { handleApiChat } = await import('./src/dashboard/handlers/chat.ts')
      runMigrations()
      const session = createChatSession({ projectId: null, agent: 'api', mode: 'chat', title: 'Read only' })
      process.chdir(projectDir)

      const requests = []
      let call = 0
      globalThis.fetch = async (_url, init) => {
        requests.push(JSON.parse(String(init.body)))
        call += 1
        const content = call === 1
          ? JSON.stringify({ isTask: true, reason: 'Pide modificar código' })
          : 'No inicié cambios porque esta sesión está en modo Chat.'
        return new Response(JSON.stringify({ choices: [{ message: { content } }], usage: { prompt_tokens: 10, completion_tokens: 5 }, model: 'deepseek/deepseek-v4-flash' }), { status: 200 })
      }

      const response = await handleApiChat(new Request('http://localhost/api/chat', {
        method: 'POST',
        body: JSON.stringify({ sessionId: session.id, history: [{ role: 'user', content: 'INJECTED-HISTORY' }], message: 'modifica un archivo' })
      }))
      const payload = await response.json()
      const messages = listChatMessages(session.id)
      const finalRequest = requests[1]
      const unsupportedSession = createChatSession({ projectId: null, agent: 'codex', mode: 'chat', title: 'Unsupported transport' })
      const unsupportedResponse = await handleApiChat(new Request('http://localhost/api/chat', {
        method: 'POST', body: JSON.stringify({ sessionId: unsupportedSession.id, message: 'hola' })
      }))
      process.stdout.write(JSON.stringify({
        status: response.status,
        payload,
        messages,
        tasksFileCreated: existsSync(join(projectDir, 'tasks.yaml')),
        injectedHistoryForwarded: JSON.stringify(finalRequest).includes('INJECTED-HISTORY'),
        fetchCalls: call,
        unsupportedStatus: unsupportedResponse.status,
      }))
      db.close()
    `)

    expect(result.status).toBe(200)
    expect(result.payload).toMatchObject({ autoTask: null, taskSuggestion: { reason: 'Pide modificar código' } })
    expect(result.messages).toEqual([
      expect.objectContaining({ role: 'user', content: 'modifica un archivo' }),
      expect.objectContaining({ role: 'assistant', content: 'No inicié cambios porque esta sesión está en modo Chat.' }),
    ])
    expect(result.tasksFileCreated).toBe(false)
    expect(result.injectedHistoryForwarded).toBe(false)
    expect(result.fetchCalls).toBe(2)
    expect(result.unsupportedStatus).toBe(422)
  })
})
