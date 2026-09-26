import { describe, expect, it } from 'bun:test'
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { resolveChatCost } from '../handlers/chat.ts'

// CC.1-D1 — este archivo prueba el WIRING (agente → transporte correcto),
// nunca el binario real (eso ya lo cubre el gate en vivo de CC.5). Sin esto,
// una máquina de dev con claude/codex/opencode instalados haría que los
// tests que ejercitan esos agentes spawneen procesos reales y gasten cupo —
// filtrar sus directorios de instalación conocidos del PATH del subproceso
// deja el resultado determinístico (siempre "binary not found") sin importar
// el host, igual que ya pasa naturalmente en CI.
const NO_CLI_PATH = (process.env.PATH ?? '')
  .split(':')
  .filter((dir) => !dir.includes('.local/bin') && !dir.includes('.opencode/bin'))
  .join(':')

async function runIsolated(
  body: string,
  extraEnv: Record<string, string> = {},
): Promise<Record<string, unknown>> {
  const home = mkdtempSync(join(tmpdir(), 'orchestos-chat-sessions-'))
  try {
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      HOME: home,
      ORCHESTOS_HOME: home,
      OPENROUTER_API_KEY: 'test-key',
      PATH: NO_CLI_PATH,
      ...extraEnv,
    }
    if (env.FAKE_CODEX === '1') {
      const bin = join(home, 'bin')
      mkdirSync(bin, { recursive: true })
      writeFileSync(
        join(bin, 'codex'),
        Buffer.from(
          'IyEvYmluL3NoCnByaW50ZiAnJXNcbicgJ3sidHlwZSI6Iml0ZW0uY29tcGxldGVkIiwiaXRlbSI6eyJ0eXBlIjoiYWdlbnRfbWVzc2FnZSIsInRleHQiOiJDb2RleCByZXBseVxuW1tvcmNoZXN0b3M6dGFza11dIn19JyAneyJ0eXBlIjoidHVybi5jb21wbGV0ZWQiLCJ1c2FnZSI6eyJpbnB1dF90b2tlbnMiOjEwLCJvdXRwdXRfdG9rZW5zIjo1fX0nCg==',
          'base64',
        ),
      )
      chmodSync(join(bin, 'codex'), 0o755)
      env.PATH = `${bin}:${NO_CLI_PATH}`
      delete env.FAKE_CODEX
    }
    const proc = Bun.spawn(['bun', '-e', body], {
      cwd: process.cwd(),
      env,
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
  it('ignores legacy auxiliary-unassigned envelope fields', async () => {
    const result = await runIsolated(
      `
      const { runMigrations } = await import('./src/db/migrate.ts')
      const { db } = await import('./src/db/sqlite.ts')
      const sessions = await import('./src/db/chat-sessions.ts')
      const handlers = await import('./src/dashboard/handlers/chat-sessions.ts')
      runMigrations()
      const session = sessions.createChatSession({ projectId: null, agent: 'codex' })
      const now = new Date().toISOString()
      db.run('INSERT INTO chat_turns (id, session_id, project_id, request_key, input_fingerprint, status, response_envelope_json, created_at, updated_at) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?)', ['turn-aux', session.id, 'request-aux', 'fingerprint', 'completed', JSON.stringify({ auxiliaryRoleUnassigned: true }), now, now])
      sessions.appendChatExchange({ sessionId: session.id, userContent: 'build something', assistantContent: 'No task created.', model: 'gpt-6-luna', turnId: 'turn-aux' })
      const response = await handlers.handleApiChatSessionMessages(new URL('http://localhost/api/chat/sessions/' + session.id + '/messages'))
      process.stdout.write(JSON.stringify(await response.json()))
      db.close()
      `,
    )
    const assistantMessage = (result as unknown as Array<Record<string, unknown>>).find(
      (row) => row.role === 'assistant',
    )
    expect(assistantMessage).toMatchObject({ content: 'No task created.' })
    expect(assistantMessage).not.toHaveProperty('auxiliaryRoleUnassigned')
  })

  it('UI.13.4b persists console commands, applies runner boundaries and cascades on delete', async () => {
    const result = await runIsolated(`
      const { mkdirSync, writeFileSync } = await import('fs')
      const { join } = await import('path')
      const home = process.env.ORCHESTOS_HOME
      const projectPath = join(home, 'console-project')
      mkdirSync(join(projectPath, 'src'), { recursive: true })
      writeFileSync(join(projectPath, 'src', 'ok.txt'), 'ok')
      const { runMigrations } = await import('./src/db/migrate.ts')
      const { db } = await import('./src/db/sqlite.ts')
      const sessions = await import('./src/db/chat-sessions.ts')
      const { route } = await import('./src/dashboard/server.ts')
      runMigrations()
      db.run('INSERT INTO projects (id, path, stack_profile, agents_md, last_updated) VALUES (?, ?, ?, ?, ?)', ['console-project', projectPath, '{}', '', new Date().toISOString()])
      const session = sessions.createChatSession({ projectId: 'console-project', agent: 'api', mode: 'code' })
      const post = (cmd) => route(new Request('http://localhost:50852/api/chat/sessions/' + session.id + '/exec', { method: 'POST', headers: { 'X-Orchestos-Project-Id': 'console-project' }, body: JSON.stringify({ cmd }) }), 50852)
      const ok = await post('ls src')
      const pipe = await post('ls | wc')
      const outside = await post('cat ../secret.txt')
      const consoleResponse = await route(new Request('http://localhost:50852/api/chat/sessions/' + session.id + '/console'), 50852)
      const lines = await consoleResponse.json()
      const beforeDelete = db.query('SELECT COUNT(*) AS count FROM console_commands WHERE session_id = ?').get(session.id).count
      sessions.deleteChatSession(session.id)
      const afterDelete = db.query('SELECT COUNT(*) AS count FROM console_commands WHERE session_id = ?').get(session.id).count
      process.stdout.write(JSON.stringify({ statuses: [ok.status, pipe.status, outside.status], ok: await ok.clone().json(), lines, beforeDelete, afterDelete }))
      db.close()
    `)
    expect(result.statuses).toEqual([200, 200, 200])
    expect(result.ok).toMatchObject({ exitCode: 0, stdout: expect.stringContaining('ok.txt') })
    const consoleLines = (result.lines as { lines: Array<{ kind: string; text: string }> }).lines
    expect(consoleLines.some((line) => line.text === '$ ls src')).toBe(true)
    expect(consoleLines.some((line) => line.text.includes('path outside project'))).toBe(true)
    expect(result.beforeDelete).toBe(3)
    expect(result.afterDelete).toBe(0)
  })

  it('lists general sessions separately from project sessions', async () => {
    const result = await runIsolated(`
      const { runMigrations } = await import('./src/db/migrate.ts')
      const { db } = await import('./src/db/sqlite.ts')
      const { mkdirSync } = await import('node:fs')
      const handlers = await import('./src/dashboard/handlers/chat-sessions.ts')
      const sessions = await import('./src/db/chat-sessions.ts')
      runMigrations()
      const root = process.env.ORCHESTOS_HOME + '/ui91-project'
      mkdirSync(root, { recursive: true })
      db.run('INSERT INTO projects (id, path, stack_profile, agents_md, last_updated) VALUES (?, ?, ?, ?, ?)', ['ui91-project', root, '{}', '', new Date().toISOString()])
      const general = sessions.createChatSession({ projectId: null, agent: 'api' })
      const project = sessions.createChatSession({ projectId: 'ui91-project', agent: 'api' })
      const generalResponse = handlers.handleApiChatSessionsList(new Request('http://localhost/api/chat/sessions?project=none'))
      const projectResponse = handlers.handleApiChatSessionsList(new Request('http://localhost/api/chat/sessions?project=ui91-project', { headers: { 'X-Orchestos-Project-Id': 'ui91-project' } }))
      process.stdout.write(JSON.stringify({ general: await generalResponse.json(), project: await projectResponse.json(), ids: [general.id, project.id] }))
      db.close()
    `)
    const ids = result.ids as string[]
    expect((result.general as Array<{ id: string }>).map((row) => row.id)).toEqual([ids[0]!])
    expect((result.project as Array<{ id: string }>).map((row) => row.id)).toEqual([ids[1]!])
  })

  it('R.6 mantiene explícito el origen del costo: reportado, estimado o desconocido', () => {
    expect(resolveChatCost('claude-sonnet-5 via Claude Code CLI', 0.12)).toEqual({
      usd: 0.12,
      source: 'reported',
    })
    expect(resolveChatCost('openai/gpt-4o')).toEqual({ usd: 0, source: 'estimated' })
    expect(resolveChatCost('unrecognized CLI label')).toEqual({ usd: 0, source: 'unknown' })
  })

  it('R.6 persiste el costo canónico del CLI en sesión y legacy, con procedencia real', async () => {
    const result = await runIsolated(
      `
      const { mkdirSync, writeFileSync } = await import('fs')
      const { join } = await import('path')
      const home = process.env.ORCHESTOS_HOME
      const root = join(home, 'r6-chat-project')
      mkdirSync(root, { recursive: true })
      mkdirSync(join(home, '.claude'), { recursive: true })
      writeFileSync(join(home, '.claude', 'stats-cache.json'), JSON.stringify({ modelUsage: { 'claude-sonnet-5': {} } }))
      writeFileSync(join(root, 'orchestos.config.yaml'), 'roles:\\n  orchestrator: { agent: claude, model: claude-sonnet-5 }\\n  auxiliary: { agent: api, model: deepseek/deepseek-v4-flash, provider: openrouter }\\n')
      const { runMigrations } = await import('./src/db/migrate.ts')
      const { db } = await import('./src/db/sqlite.ts')
      const { createChatSession } = await import('./src/db/chat-sessions.ts')
      const { handleApiChat } = await import('./src/dashboard/handlers/chat.ts')
      const { route } = await import('./src/dashboard/server.ts')
      runMigrations(); process.chdir(root)
      globalThis.fetch = async () => new Response(JSON.stringify({ choices: [{ message: { content: '{"isTask":false,"reason":"chat"}' } }] }), { status: 200 })
      const session = createChatSession({ agent: 'claude', mode: 'chat' })
      const post = (body) => handleApiChat(new Request('http://localhost/api/chat', { method: 'POST', body: JSON.stringify(body) }))
      const emptyModelResponse = await post({ sessionId: session.id, message: 'R6 empty model fixture' })
      const emptyModelRunCount = db.query('SELECT COUNT(*) AS count FROM runs').get().count
      const sessionResponse = await post({ sessionId: session.id, requestKey: 'reported', message: 'R6 reported cost fixture', model: 'claude-sonnet-5', effort: 'max' })
      const zeroResponse = await post({ message: 'R6 zero cost fixture', model: 'claude-sonnet-5', effort: 'low' })
      const estimatedResponse = await post({ message: 'R6 estimated cost fixture', model: 'claude-sonnet-5', effort: 'medium' })
      const unknownResponse = await post({ message: 'R6 unknown model fixture', model: 'claude-sonnet-5', effort: 'high' })
      const rows = db.query('SELECT model, usd_cost, cost_breakdown_json FROM runs WHERE task_class = "chat" ORDER BY created_at').all()
      const api = await (await route(new Request('http://localhost:50852/api/runs?limit=10'), 50852)).json()
      process.stdout.write(JSON.stringify({ emptyModelStatus: emptyModelResponse.status, emptyModelRunCount, statuses: [sessionResponse.status, zeroResponse.status, estimatedResponse.status, unknownResponse.status], rows, api }))
      db.close()
    `,
      { PATH: process.cwd() + '/scripts/fixtures:' + NO_CLI_PATH },
    )

    expect(result.emptyModelStatus).toBe(200)
    expect(result.emptyModelRunCount).toBe(1)
    expect(result.statuses).toEqual([200, 200, 200, 200])
    const rows = result.rows as Array<{
      model: string
      usd_cost: number
      cost_breakdown_json: string
    }>
    expect(rows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ model: 'claude-sonnet-5', usd_cost: 0.0123 }),
        expect.objectContaining({ model: 'claude-sonnet-5', usd_cost: 0 }),
        expect.objectContaining({ model: 'openai/gpt-4o', usd_cost: 0.0225 }),
        expect.objectContaining({ model: 'unknown-cli-model', usd_cost: 0 }),
      ]),
    )
    expect(rows.every((row) => !row.model.includes('via Claude Code CLI'))).toBe(true)
    const api = result.api as Array<{ model: string; costUsd: number | null; costSource: string }>
    expect(api).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          model: 'claude-sonnet-5',
          costUsd: 0.0123,
          costSource: 'reported',
        }),
        expect.objectContaining({ model: 'claude-sonnet-5', costUsd: 0, costSource: 'reported' }),
        expect.objectContaining({
          model: 'openai/gpt-4o',
          costUsd: 0.0225,
          costSource: 'estimated',
        }),
        expect.objectContaining({
          model: 'unknown-cli-model',
          costUsd: null,
          costSource: 'unknown',
        }),
      ]),
    )
  })
  it('implements CRUD, immutable agent, persistence and cascade delete', async () => {
    const result = await runIsolated(`
      const { runMigrations } = await import('./src/db/migrate.ts')
      const { db } = await import('./src/db/sqlite.ts')
      const { mkdirSync, writeFileSync } = await import('fs')
      const { join } = await import('path')
      const handlers = await import('./src/dashboard/handlers/chat-sessions.ts')
      const sessions = await import('./src/db/chat-sessions.ts')
      const { route } = await import('./src/dashboard/server.ts')
      runMigrations()
      const projectPath = join(process.env.ORCHESTOS_HOME, 'p1')
      mkdirSync(projectPath, { recursive: true })
      writeFileSync(join(projectPath, 'orchestos.config.yaml'), 'roles:\\n  orchestrator: { agent: codex, model: gpt-6-luna }\\n  auxiliary: { agent: api, model: deepseek/deepseek-v4-flash, provider: openrouter }\\n')
      db.run('INSERT INTO projects (id, path, stack_profile, agents_md, last_updated) VALUES (?, ?, ?, ?, ?)', ['p1', projectPath, '{}', '', new Date().toISOString()])

      const createdResponse = await handlers.handleApiChatSessionsCreate(new Request('http://localhost/api/chat/sessions', {
        method: 'POST', headers: { 'X-Orchestos-Project-Id': 'stale-project' }, body: JSON.stringify({ projectId: 'p1', agent: 'claude', mode: 'chat', title: 'Session one' })
      }))
      const created = await createdResponse.json()
      const projectDefaultResponse = await handlers.handleApiChatSessionsCreate(new Request('http://localhost/api/chat/sessions', {
        method: 'POST', body: JSON.stringify({ projectId: 'p1', agent: 'api' })
      }))
      const projectDefault = await projectDefaultResponse.json()
      const generalDefaultResponse = await handlers.handleApiChatSessionsCreate(new Request('http://localhost/api/chat/sessions', {
        method: 'POST', body: JSON.stringify({ projectId: null, agent: 'api' })
      }))
      const generalDefault = await generalDefaultResponse.json()
      // I.4 (Mes 30) — el listado ahora filtra por proyecto activo (evita
      // mezclar chats de proyectos distintos); sin header/query cae a null
      // (sesiones "generales"), donde esta sesión (project_id='p1') no
      // aparecería — se pasa el header para listar el proyecto correcto.
      const routedListResponse = await route(new Request('http://localhost:50852/api/chat/sessions', {
        headers: { 'X-Orchestos-Project-Id': 'p1' },
      }), 50852)
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
      const sessionBound = sessions.createChatSession({ projectId: 'p1', agent: 'codex', mode: 'chat', title: 'Bound' })
      const sessionBoundResponse = await (await import('./src/dashboard/handlers/chat.ts')).handleApiChat(new Request('http://localhost/api/chat', {
        method: 'POST', headers: { 'X-Orchestos-Project-Id': 'stale-project' }, body: JSON.stringify({ sessionId: sessionBound.id, message: 'hola' })
      }))
      const deleted = handlers.handleApiChatSessionDelete(new URL('http://localhost/api/chat/sessions/' + created.id))
      const remainingMessages = db.query('SELECT COUNT(*) AS count FROM chat_messages WHERE session_id = ?').get(created.id).count

      process.stdout.write(JSON.stringify({
        createStatus: createdResponse.status,
        created,
        projectDefaultStatus: projectDefaultResponse.status,
        projectDefault,
        generalDefaultStatus: generalDefaultResponse.status,
        generalDefault,
        routedListStatus: routedListResponse.status,
        routedList,
        immutableStatus: immutableResponse.status,
        updatedStatus: updatedResponse.status,
        updated,
        messagesStatus: messagesResponse.status,
        messages,
        invalidProjectStatus: invalidProject.status,
        sessionBoundStatus: sessionBoundResponse.status,
        deleteStatus: deleted.status,
        remainingMessages,
        chatAllowsExecution: sessions.sessionAllowsTaskExecution('chat'),
        codeAllowsExecution: sessions.sessionAllowsTaskExecution('code'),
      }))
      db.close()
    `)

    expect(result.createStatus).toBe(201)
    expect(result.created).toMatchObject({
      projectId: 'p1',
      agent: 'claude',
      mode: 'chat',
      title: 'Session one',
    })
    // R.1 — la creación nueva deriva la autoridad del proyecto asociado;
    // el cliente no manda mode y una sesión general jamás recibe ejecución.
    expect(result.projectDefaultStatus).toBe(201)
    expect(result.projectDefault).toMatchObject({ projectId: 'p1', mode: 'code' })
    expect(result.generalDefaultStatus).toBe(201)
    expect(result.generalDefault).toMatchObject({ projectId: null, mode: 'chat' })
    expect(result.routedListStatus).toBe(200)
    expect(result.routedList).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: expect.any(String), agent: 'claude' }),
        expect.objectContaining({ id: expect.any(String), agent: 'api', mode: 'code' }),
      ]),
    )
    expect(result.immutableStatus).toBe(400)
    expect(result.updatedStatus).toBe(200)
    expect(result.updated).toMatchObject({ agent: 'claude', mode: 'code', title: 'Renamed' })
    expect(result.messagesStatus).toBe(200)
    expect(result.messages).toEqual([
      expect.objectContaining({ role: 'user', content: 'hola', ocrUsed: ['image.png'] }),
      expect.objectContaining({
        role: 'assistant',
        content: 'respuesta',
        model: 'test-model',
        ocrUsed: ['image.png'],
      }),
    ])
    expect(result.invalidProjectStatus).toBe(404)
    // H.9.2 — la sesión se crea, pero el binario ausente devuelve su error real
    // cuando se intenta ejecutar el turno.
    expect(result.sessionBoundStatus).toBe(502)
    expect(result.deleteStatus).toBe(200)
    expect(result.remainingMessages).toBe(0)
    expect(result.chatAllowsExecution).toBe(false)
    expect(result.codeAllowsExecution).toBe(true)
  })

  it('creates project sessions without a declared read boundary and returns a warning', async () => {
    const result = await runIsolated(`
      const { runMigrations } = await import('./src/db/migrate.ts')
      const { db } = await import('./src/db/sqlite.ts')
      const { mkdirSync } = await import('fs')
      const { join } = await import('path')
      const handlers = await import('./src/dashboard/handlers/chat-sessions.ts')
      runMigrations()
      const projectPath = join(process.env.ORCHESTOS_HOME, 'p1')
      mkdirSync(projectPath, { recursive: true })
      db.run('INSERT INTO projects (id, path, stack_profile, agents_md, last_updated) VALUES (?, ?, ?, ?, ?)', ['p1', projectPath, '{}', '', new Date().toISOString()])

      const projectResponse = await handlers.handleApiChatSessionsCreate(new Request('http://localhost/api/chat/sessions', {
        method: 'POST', body: JSON.stringify({ projectId: 'p1', agent: 'codex' }),
      }))
      const projectBody = await projectResponse.json()
      const projectRows = db.query('SELECT * FROM chat_sessions WHERE project_id = ?').all('p1')

      const generalResponse = await handlers.handleApiChatSessionsCreate(new Request('http://localhost/api/chat/sessions', {
        method: 'POST', body: JSON.stringify({ projectId: null, agent: 'codex' }),
      }))
      const generalBody = await generalResponse.json()
      const generalRows = db.query('SELECT * FROM chat_sessions WHERE project_id IS NULL').all()

      process.stdout.write(JSON.stringify({
        projectStatus: projectResponse.status,
        projectBody,
        projectRows,
        generalStatus: generalResponse.status,
        generalBody,
        generalRows,
      }))
      db.close()
    `)

    expect(result.projectStatus).toBe(201)
    expect(result.projectBody).toMatchObject({
      projectId: 'p1',
      agent: 'codex',
      readBoundaryWarning: 'Codex no limita la lectura a este proyecto',
    })
    expect(result.projectRows).toHaveLength(1)
    expect(result.generalStatus).toBe(201)
    expect(result.generalBody).toMatchObject({ projectId: null, agent: 'codex' })
    expect(
      (result.generalBody as { readBoundaryWarning?: string }).readBoundaryWarning,
    ).toBeUndefined()
    expect(result.generalRows).toHaveLength(1)
  })

  // I.4 (Mes 30, 2026-09-05) — el aside de conversaciones necesita que el
  // listado no mezcle proyectos, y que cada fila tenga un título usable (no
  // "New conversation" para las N sesiones de siempre).
  it('listChatSessions() filtra por proyecto, y appendChatExchange() pone el título del primer mensaje', async () => {
    const result = await runIsolated(`
      const { runMigrations } = await import('./src/db/migrate.ts')
      const { db } = await import('./src/db/sqlite.ts')
      const sessions = await import('./src/db/chat-sessions.ts')
      runMigrations()
      // FK real (project_id REFERENCES projects(id), foreign_keys=ON en sqlite.ts) —
      // sin estas filas, createChatSession con projectId 'p1'/'p2' explota.
      for (const id of ['p1', 'p2']) {
        db.run('INSERT INTO projects (id, path, stack_profile, agents_md, last_updated) VALUES (?, ?, ?, ?, ?)', [id, '/tmp/' + id, '{}', '', new Date().toISOString()])
      }

      const a1 = sessions.createChatSession({ projectId: 'p1', agent: 'claude', mode: 'chat' })
      const a2 = sessions.createChatSession({ projectId: 'p1', agent: 'claude', mode: 'chat' })
      const b1 = sessions.createChatSession({ projectId: 'p2', agent: 'claude', mode: 'chat' })
      const general = sessions.createChatSession({ projectId: null, agent: 'api', mode: 'chat' })

      const p1List = sessions.listChatSessions('p1').map((s) => s.id).sort()
      const p2List = sessions.listChatSessions('p2').map((s) => s.id)
      const generalList = sessions.listChatSessions(null).map((s) => s.id)
      const allList = sessions.listChatSessions().length

      sessions.appendChatExchange({ sessionId: a1.id, userContent: '  hola   como estas  ', assistantContent: 'bien' })
      const titleAfterFirst = sessions.getChatSession(a1.id).title
      sessions.appendChatExchange({ sessionId: a1.id, userContent: 'segundo mensaje', assistantContent: 'ok' })
      const titleAfterSecond = sessions.getChatSession(a1.id).title
      const longMsg = 'x'.repeat(200)
      sessions.appendChatExchange({ sessionId: a2.id, userContent: longMsg, assistantContent: 'ok' })
      const longTitle = sessions.getChatSession(a2.id).title

      process.stdout.write(JSON.stringify({
        p1List, p2List, generalList, allList,
        a1Id: a1.id, a2Id: a2.id, b1Id: b1.id, generalId: general.id,
        titleAfterFirst, titleAfterSecond, longTitle,
      }))
      db.close()
    `)

    expect(result.p1List).toEqual([result.a1Id, result.a2Id].sort())
    expect(result.p2List).toEqual([result.b1Id])
    expect(result.generalList).toEqual([result.generalId])
    expect(result.allList).toBe(4)
    // espacios colapsados, sin saltos, sin comillas de más
    expect(result.titleAfterFirst).toBe('hola como estas')
    // el segundo intercambio NO pisa el título ya puesto por el primero
    expect(result.titleAfterSecond).toBe('hola como estas')
    expect(result.longTitle).toBe(`${'x'.repeat(59)}…`)
    expect((result.longTitle as string).length).toBe(60)
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
      writeFileSync(join(projectDir, 'orchestos.config.yaml'), 'roles:\\n  orchestrator: { agent: api, model: deepseek/deepseek-v4-flash, provider: openrouter }\\n  auxiliary: { agent: api, model: deepseek/deepseek-v4-flash, provider: openrouter }\\n')

      const { runMigrations } = await import('./src/db/migrate.ts')
      const { db } = await import('./src/db/sqlite.ts')
      const { createChatSession, listChatMessages } = await import('./src/db/chat-sessions.ts')
      const { handleApiChat } = await import('./src/dashboard/handlers/chat.ts')
      runMigrations()
      const session = createChatSession({ projectId: null, agent: 'api', mode: 'chat', title: 'Read only' })
      process.chdir(projectDir)
      writeFileSync(join(projectDir, 'orchestos.config.yaml'), 'roles:\\n  orchestrator: { agent: api, model: deepseek/deepseek-v4-flash, provider: openrouter }\\n  auxiliary: { agent: api, model: deepseek/deepseek-v4-flash, provider: openrouter }\\n')

      const requests = []
      let call = 0
      globalThis.fetch = async (_url, init) => {
        requests.push(JSON.parse(String(init.body)))
        call += 1
        const content = 'No inicié cambios porque esta sesión está en modo Chat.\\n[[orchestos:task]]'
        return new Response(JSON.stringify({ choices: [{ message: { content } }], usage: { prompt_tokens: 10, completion_tokens: 5 }, model: 'deepseek/deepseek-v4-flash' }), { status: 200 })
      }

      const response = await handleApiChat(new Request('http://localhost/api/chat', {
        method: 'POST',
        body: JSON.stringify({ sessionId: session.id, history: [{ role: 'user', content: 'INJECTED-HISTORY' }], message: 'modifica un archivo' })
      }))
      const payload = await response.json()
      const messages = listChatMessages(session.id)
      const finalRequest = requests[0]
      const codexSession = createChatSession({ projectId: null, agent: 'codex', mode: 'chat', title: 'Codex transport' })
      const codexResponse = await handleApiChat(new Request('http://localhost/api/chat', {
        method: 'POST', body: JSON.stringify({ sessionId: codexSession.id, agent: 'codex', model: 'gpt-6-luna', message: 'hola', effort: 'high' })
      }))
      process.stdout.write(JSON.stringify({
        status: response.status,
        payload,
        messages,
        tasksFileCreated: existsSync(join(projectDir, 'tasks.yaml')),
        injectedHistoryForwarded: JSON.stringify(finalRequest).includes('INJECTED-HISTORY'),
        fetchCalls: call,
        codexStatus: codexResponse.status,
      }))
      db.close()
    `)

    expect(result.status).toBe(200)
    expect(result.payload).toMatchObject({
      autoTask: null,
      taskSuggestion: { isTask: true, reason: 'orchestrator-marker' },
    })
    expect(result.messages).toEqual([
      expect.objectContaining({ role: 'user', content: 'modifica un archivo' }),
      expect.objectContaining({
        role: 'assistant',
        content: 'No inicié cambios porque esta sesión está en modo Chat.',
      }),
    ])
    expect(result.tasksFileCreated).toBe(false)
    expect(result.injectedHistoryForwarded).toBe(false)
    // H.9.2 — la advertencia no evita que el flujo llegue al CLI.
    expect(result.fetchCalls).toBe(1)
    // The isolated suite hides the Codex binary, so transport execution returns 502;
    // the important contract here is that effort=high passes request validation.
    expect(result.codexStatus).not.toBe(400)
  })

  it('fails OpenCode without making an Auxiliary provider call', async () => {
    const result = await runIsolated(`
      const { mkdirSync, writeFileSync } = await import('fs')
      const { join } = await import('path')
      const home = process.env.ORCHESTOS_HOME
      const cacheDir = join(home, '.orchestos', 'cache')
      mkdirSync(cacheDir, { recursive: true })
      writeFileSync(join(cacheDir, 'models.json'), JSON.stringify({ fetchedAt: Date.now(), models: {} }))
      const projectDir = join(home, 'opencode-error-project')
      mkdirSync(projectDir, { recursive: true })
      writeFileSync(join(projectDir, 'orchestos.config.yaml'), 'roles:\\n  orchestrator: { agent: opencode, model: opencode/test }\\n  auxiliary: { agent: api, model: deepseek/deepseek-v4-flash, provider: openrouter }\\n')
      const { runMigrations } = await import('./src/db/migrate.ts')
      const { db } = await import('./src/db/sqlite.ts')
      const { createChatSession } = await import('./src/db/chat-sessions.ts')
      const { handleApiChat } = await import('./src/dashboard/handlers/chat.ts')
      runMigrations(); process.chdir(projectDir)
      writeFileSync(join(projectDir, 'orchestos.config.yaml'), 'roles:\\n  orchestrator: { agent: opencode, model: opencode/test }\\n  auxiliary: { agent: api, model: deepseek/deepseek-v4-flash, provider: openrouter }\\n')
      const fetchUrls = []
      globalThis.fetch = async (url) => {
        fetchUrls.push(String(url))
        return new Response(JSON.stringify({ choices: [{ message: { content: '{"isTask":false,"reason":"chat"}' } }] }), { status: 200 })
      }
      const session = createChatSession({ agent: 'opencode', mode: 'chat' })
      const response = await handleApiChat(new Request('http://localhost/api/chat', {
        method: 'POST', body: JSON.stringify({ sessionId: session.id, message: 'opencode failure probe' })
      }))
      const rows = db.query('SELECT provider FROM runs WHERE task_class = "chat" ORDER BY created_at DESC LIMIT 1').all()
      process.stdout.write(JSON.stringify({ status: response.status, fetchUrls, rows }))
      db.close()
    `)
    expect(result.status).toBe(502)
    expect(result.fetchUrls).toHaveLength(0)
    expect(result.rows).toEqual([expect.objectContaining({ provider: 'opencode' })])
  })

  it('never auto-creates a real task for a general project-less session in Code mode', async () => {
    const result = await runIsolated(`
      const { mkdirSync, writeFileSync, readFileSync } = await import('fs')
      const { join } = await import('path')
      const home = process.env.ORCHESTOS_HOME
      const cacheDir = join(home, '.orchestos', 'cache')
      mkdirSync(cacheDir, { recursive: true })
      writeFileSync(join(cacheDir, 'models.json'), JSON.stringify({
        fetchedAt: Date.now(),
        models: { 'deepseek/deepseek-v4-flash': { contextLength: 64000, priceIn: 0, priceOut: 0, supportsReasoning: false, supportsTools: false, maxOutputTokens: 8192, supportsVision: false } }
      }))
      const serverRoot = join(home, 'real-server-project')
      mkdirSync(serverRoot, { recursive: true })
      writeFileSync(join(serverRoot, 'orchestos.config.yaml'), 'roles:\\n  orchestrator: { agent: api, model: deepseek/deepseek-v4-flash, provider: openrouter }\\n  auxiliary: { agent: api, model: deepseek/deepseek-v4-flash, provider: openrouter }\\n')
      const tasksPath = join(serverRoot, 'tasks.yaml')
      const originalTasks = 'version: 1\\ntasks:\\n  - id: existing-real-task\\n    description: Must remain unchanged\\n    output: []\\n    executor: openrouter\\n    status: pending\\n    retry_count: 0\\n'
      writeFileSync(tasksPath, originalTasks)

      const { runMigrations } = await import('./src/db/migrate.ts')
      const { db } = await import('./src/db/sqlite.ts')
      const { createChatSession } = await import('./src/db/chat-sessions.ts')
      const { handleApiChat } = await import('./src/dashboard/handlers/chat.ts')
      runMigrations()
      const session = createChatSession({ projectId: null, agent: 'api', mode: 'code', title: 'General code session' })
      process.chdir(serverRoot)
      writeFileSync(join(serverRoot, 'orchestos.config.yaml'), 'roles:\\n  orchestrator: { agent: api, model: deepseek/deepseek-v4-flash, provider: openrouter }\\n  auxiliary: { agent: api, model: deepseek/deepseek-v4-flash, provider: openrouter }\\n')

      let openRouterCalls = 0
      globalThis.fetch = async (url, init) => {
        if (String(url).includes('localhost:11434')) {
          return new Response(JSON.stringify({ models: [] }), { status: 200 })
        }
        openRouterCalls += 1
        const requestBody = JSON.parse(String(init.body))
        const system = String(requestBody.messages?.[0]?.content ?? '')
        const content = system.includes('convierte instrucciones en lenguaje natural')
          ? JSON.stringify({ id: 'python-hello-world-script', description: 'Create hello.py', output: ['hello.py'], executor: 'openrouter', skill_candidates: [] })
          : 'No se creó una tarea real porque esta sesión general no tiene un proyecto asociado.\\n[[orchestos:task]]'
        return new Response(JSON.stringify({ choices: [{ message: { content } }], usage: { prompt_tokens: 10, completion_tokens: 5 }, model: 'deepseek/deepseek-v4-flash' }), { status: 200 })
      }

      const response = await handleApiChat(new Request('http://localhost/api/chat', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: session.id,
          message: 'build me a python script that prints hello world, save it as hello.py',
        }),
      }))
      const payload = await response.json()
      const finalTasks = readFileSync(tasksPath, 'utf8')
      process.stdout.write(JSON.stringify({
        status: response.status,
        payload,
        tasksUnchanged: finalTasks === originalTasks,
        leakedTask: finalTasks.includes('python-hello-world-script'),
        openRouterCalls,
      }))
      db.close()
    `)

    expect(result.status).toBe(200)
    expect(result.payload).toMatchObject({
      autoTask: null,
      taskSuggestion: { isTask: true, reason: 'orchestrator-marker' },
    })
    expect(String((result.payload as { text?: unknown }).text)).toContain(
      'no tiene un proyecto asociado',
    )
    expect(result.tasksUnchanged).toBe(true)
    expect(result.leakedTask).toBe(false)
    expect(result.openRouterCalls).toBe(1)
  })

  // R.4-bis — taskHeld/existingFiles deben sobrevivir un restore (recarga),
  // que es exactamente lo que se perdía: el mensaje solo guardaba task_id
  // plano, indistinguible de una tarea normal ya en ejecución.
  it('appendChatExchange persists taskHeld/existingFiles and the messages endpoint returns them', async () => {
    const result = await runIsolated(`
      const { runMigrations } = await import('./src/db/migrate.ts')
      const { db } = await import('./src/db/sqlite.ts')
      const handlers = await import('./src/dashboard/handlers/chat-sessions.ts')
      const sessions = await import('./src/db/chat-sessions.ts')
      runMigrations()
      const session = sessions.createChatSession({ agent: 'api', mode: 'chat' })

      sessions.appendChatExchange({
        sessionId: session.id,
        userContent: 'toca archivos existentes',
        assistantContent: 'tarea creada, retenida',
        taskId: 'held-task-1',
        taskHeld: true,
        existingFiles: ['src/a.ts', 'src/b.ts'],
      })
      sessions.appendChatExchange({
        sessionId: session.id,
        userContent: 'segundo turno, tarea normal',
        assistantContent: 'corriendo',
        taskId: 'normal-task-1',
      })

      const messagesResponse = handlers.handleApiChatSessionMessages(
        new URL('http://localhost/api/chat/sessions/' + session.id + '/messages'),
      )
      const messages = await messagesResponse.json()
      process.stdout.write(JSON.stringify({ messages }))
      db.close()
    `)

    const messages = result.messages as Array<Record<string, unknown>>
    const held = messages.find((m) => m.taskId === 'held-task-1')
    const normal = messages.find((m) => m.taskId === 'normal-task-1')
    expect(held).toMatchObject({ taskHeld: true, existingFiles: ['src/a.ts', 'src/b.ts'] })
    expect(normal).toMatchObject({ taskHeld: false, existingFiles: [] })
  })

  it('reports the latest durable turn status for session recovery', async () => {
    const result = await runIsolated(`
      const { runMigrations } = await import('./src/db/migrate.ts')
      const { db } = await import('./src/db/sqlite.ts')
      const handlers = await import('./src/dashboard/handlers/chat-sessions.ts')
      const sessions = await import('./src/db/chat-sessions.ts')
      const { beginTurn, commitTurnFailure, commitTurnSuccess } = await import('./src/db/chat-turns.ts')
      runMigrations()
      const noTurns = sessions.createChatSession({ agent: 'api' })
      const pending = sessions.createChatSession({ agent: 'api' })
      const expired = sessions.createChatSession({ agent: 'api' })
      const failed = sessions.createChatSession({ agent: 'api' })
      const completed = sessions.createChatSession({ agent: 'api' })
      const start = (sessionId, requestKey, leaseMs) => beginTurn({
        sessionId, projectId: null, requestKey, inputFingerprint: requestKey + '-input', owner: 'worker-a', leaseMs,
      })
      const pendingTurn = start(pending.id, 'pending-key', 60_000)
      start(expired.id, 'expired-key', -1_000)
      const failedTurn = start(failed.id, 'failed-key', 60_000)
      commitTurnFailure({ turnId: failedTurn.turn.id, owner: 'worker-a', error: 'provider unavailable exactly' })
      const completedTurn = start(completed.id, 'completed-key', 60_000)
      commitTurnSuccess({
        turnId: completedTurn.turn.id,
        owner: 'worker-a',
        run: {
          project_id: null, prompt: 'hola', task_class: 'chat', model: 'test-model', provider: 'test',
          skill_id: null, task_id: null, allowed_outputs: null, files_attempted: null, files_authorized: null,
          files_blocked: null, snapshot_before: null, snapshot_after: null, qa_verdict: null, qa_reason: null,
          status: 'done', input_tokens: 0, output_tokens: 0, usd_cost: 0, elapsed_ms: 0, result: 'respuesta',
        },
        userContent: 'hola', assistantContent: 'respuesta', envelope: { text: 'respuesta' },
      })
      const turnStatus = async (id) => {
        const response = handlers.handleApiChatSessionTurnStatus(new URL('http://localhost/api/chat/sessions/' + id + '/turn-status'))
        return { status: response.status, body: await response.json() }
      }
      const missing = await turnStatus('does-not-exist')
      const invalidResponse = handlers.handleApiChatSessionTurnStatus(new URL('http://localhost/api/chat/sessions//turn-status'))
      const invalid = { status: invalidResponse.status, body: await invalidResponse.json() }
      process.stdout.write(JSON.stringify({
        missing, invalid, noTurns: await turnStatus(noTurns.id), pending: await turnStatus(pending.id),
        pendingTurnId: pendingTurn.turn.id, expired: await turnStatus(expired.id),
        failed: await turnStatus(failed.id), completed: await turnStatus(completed.id),
      }))
      db.close()
    `)

    expect(result.missing).toMatchObject({ status: 404, body: { error: 'Chat session not found' } })
    expect(result.invalid).toMatchObject({ status: 400, body: { error: 'Invalid session id' } })
    expect(result.noTurns).toEqual({ status: 200, body: { kind: 'none' } })
    expect(result.pending).toEqual({
      status: 200,
      body: { kind: 'pending', turnId: result.pendingTurnId, requestKey: 'pending-key' },
    })
    expect(result.expired).toEqual({ status: 200, body: { kind: 'interrupted' } })
    expect(result.failed).toEqual({
      status: 200,
      body: { kind: 'failed', error: 'provider unavailable exactly' },
    })
    expect(result.completed).toEqual({ status: 200, body: { kind: 'none' } })
  })

  it('auto-created chat tasks defer model choice to the Executor role when no rule matches', async () => {
    const result = await runIsolated(`
      const { mkdirSync, writeFileSync, readFileSync, existsSync } = await import('node:fs')
      const { join } = await import('node:path')
      const home = process.env.ORCHESTOS_HOME
      const root = join(home, 'chat-role-task-project')
      mkdirSync(join(home, '.orchestos', 'cache'), { recursive: true })
      mkdirSync(root, { recursive: true })
      writeFileSync(join(root, 'README.md'), '# Existing file\\n')
      writeFileSync(join(root, 'tasks.yaml'), 'version: 1\\nproject: chat-role-task-project\\ntasks: []\\n')
      writeFileSync(join(root, 'orchestos.config.yaml'), 'roles:\\n  orchestrator: { agent: api, model: deepseek/deepseek-v4-flash, provider: openrouter }\\n  executor: { agent: codex, model: gpt-6-luna }\\n  auxiliary: { agent: api, model: deepseek/auxiliary, provider: openrouter }\\n')
      writeFileSync(join(home, '.orchestos', 'cache', 'models.json'), JSON.stringify({ fetchedAt: Date.now(), models: { 'deepseek/deepseek-v4-flash': { contextLength: 64000, priceIn: 0, priceOut: 0, supportsReasoning: false, supportsTools: false, maxOutputTokens: 8192, supportsVision: false } } }))
      const { runMigrations } = await import('./src/db/migrate.ts')
      const { db } = await import('./src/db/sqlite.ts')
      const { createChatSession } = await import('./src/db/chat-sessions.ts')
      const { handleApiChat } = await import('./src/dashboard/handlers/chat.ts')
      runMigrations()
      db.run('INSERT INTO projects (id, path, stack_profile, agents_md, last_updated) VALUES (?, ?, ?, ?, ?)', ['chat-role-task-project', root, '{}', '', new Date().toISOString()])
      const session = createChatSession({ projectId: 'chat-role-task-project', agent: 'api', mode: 'code' })
      const requests = []
      globalThis.fetch = async (_url, init) => {
        const body = JSON.parse(String(init.body))
        requests.push(body)
        const system = String(body.messages?.[0]?.content ?? '')
        const content = system.includes('convierte instrucciones en lenguaje natural')
            ? JSON.stringify({ id: 'readme-role-task', description: 'Edit README', output: ['README.md'], executor: 'openrouter', skill_candidates: [] })
            : 'Task created and held.\\n[[orchestos:task]]'
        return new Response(JSON.stringify({ choices: [{ message: { content } }], usage: { prompt_tokens: 10, completion_tokens: 5 }, model: body.model }), { status: 200 })
      }
      const response = await handleApiChat(new Request('http://localhost/api/chat', { method: 'POST', body: JSON.stringify({ sessionId: session.id, message: 'Build README.md' }) }))
      const payload = await response.json()
      const tasksYaml = existsSync(join(root, 'tasks.yaml')) ? readFileSync(join(root, 'tasks.yaml'), 'utf8') : null
      process.stdout.write(JSON.stringify({ status: response.status, payload, tasksYaml, models: requests.map((request) => request.model) }))
      db.close()
    `)
    expect(result.status).toBe(200)
    expect(result.payload).toMatchObject({ autoTask: { held: true, existingFiles: ['README.md'] } })
    expect(result.tasksYaml).not.toContain('executor_model:')
    expect(result.tasksYaml).not.toContain('engine:')
    expect(result.models).toEqual(['deepseek/deepseek-v4-flash', 'deepseek/deepseek-v4-flash'])
    expect(String((result.payload as { text: string }).text)).not.toContain('[[orchestos:task]]')
    expect(String((result.payload as { text: string }).text)).toContain('⏸ Created task')
  })

  it('accepts three sequential Codex chat posts while Auxiliary routing is assigned between turns', async () => {
    const result = await runIsolated(
      `
      const { mkdirSync, writeFileSync, readFileSync } = await import('node:fs')
      const { join } = await import('node:path')
      const home = process.env.ORCHESTOS_HOME
      const root = join(home, 'sequential-codex-chat')
      mkdirSync(root, { recursive: true })
      writeFileSync(join(root, 'README.md'), '# Existing file\\n')
      writeFileSync(join(root, 'tasks.yaml'), 'version: 1\\nproject: sequential-codex-chat\\ntasks: []\\n')
      writeFileSync(join(root, 'orchestos.config.yaml'), 'roles:\\n  orchestrator: { agent: api, model: deepseek/orchestrator, provider: openrouter }\\n  executor: { agent: codex, model: gpt-6-luna }\\n')
      const { runMigrations } = await import('./src/db/migrate.ts')
      const { db } = await import('./src/db/sqlite.ts')
      const { createChatSession } = await import('./src/db/chat-sessions.ts')
      const { route } = await import('./src/dashboard/server.ts')
      runMigrations()
      db.run('INSERT INTO projects (id, path, stack_profile, agents_md, last_updated) VALUES (?, ?, ?, ?, ?)', ['sequential-codex-chat', root, '{}', '', new Date().toISOString()])
      globalThis.fetch = async (_url, init) => {
        const body = JSON.parse(String(init.body))
        const system = String(body.messages?.[0]?.content ?? '')
        const content = system.includes('convierte instrucciones en lenguaje natural')
            ? JSON.stringify({ id: 'held-readme-task', description: 'Edit README', output: ['README.md'], executor: 'codex', skill_candidates: [] })
            : 'Codex reply\\n[[orchestos:task]]'
        return new Response(JSON.stringify({ choices: [{ message: { content } }], usage: { prompt_tokens: 10, completion_tokens: 5 }, model: body.model }), { status: 200 })
      }
      const session = createChatSession({ projectId: 'sequential-codex-chat', agent: 'codex', mode: 'code' })
      const post = (message) => route(new Request('http://localhost:50852/api/chat', { method: 'POST', headers: { origin: 'http://localhost:50852', 'x-orchestos-project-id': 'sequential-codex-chat' }, body: JSON.stringify({ sessionId: session.id, agent: 'codex', model: 'gpt-6-luna', message }) }), 50852)
      const first = await post('Build README.md')
      const second = await post('Build README.md')
      const secondMessages = await route(new Request('http://localhost:50852/api/chat/sessions/' + session.id + '/messages'), 50852)
      const config = await route(new Request('http://localhost:50852/api/config', { method: 'PUT', headers: { origin: 'http://localhost:50852', 'x-orchestos-project-id': 'sequential-codex-chat', 'content-type': 'application/json' }, body: JSON.stringify({ roleAssignments: { auxiliary: { agent: 'api', model: 'deepseek/auxiliary', provider: 'openrouter' } } }) }), 50852)
      const third = await post('Build README.md')
      const tasksYaml = readFileSync(join(root, 'tasks.yaml'), 'utf8')
      process.stdout.write(JSON.stringify({ statuses: [first.status, second.status, config.status, third.status], firstBody: await first.json(), secondBody: await second.json(), secondMessages: await secondMessages.json(), thirdBody: await third.json(), tasksYaml }))
      db.close()
      `,
      { FAKE_CODEX: '1' },
    )
    expect(result.statuses, JSON.stringify(result)).toEqual([200, 200, 200, 200])
    expect(result.secondMessages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'assistant',
          content: expect.stringContaining('Codex reply'),
        }),
      ]),
    )
    expect(result.thirdBody).toMatchObject({ autoTask: { held: true } })
    expect(result.tasksYaml).toContain('status: pending')
    expect(result.tasksYaml).toContain('README.md')
  })

  it('returns a clear 400 without calling a provider when Orchestrator is unassigned', async () => {
    const result = await runIsolated(`
      const { mkdirSync } = await import('node:fs')
      const { join } = await import('node:path')
      const root = join(process.env.ORCHESTOS_HOME, 'unassigned-orchestrator')
      mkdirSync(root, { recursive: true })
      const { runMigrations } = await import('./src/db/migrate.ts')
      const { db } = await import('./src/db/sqlite.ts')
      const { handleApiChat } = await import('./src/dashboard/handlers/chat.ts')
      runMigrations()
      process.chdir(root)
      let calls = 0
      globalThis.fetch = async () => {
        calls += 1
        return new Response('{}', { status: 200 })
      }
      const response = await handleApiChat(new Request('http://localhost/api/chat', {
        method: 'POST', body: JSON.stringify({ message: 'hello' }),
      }))
      process.stdout.write(JSON.stringify({ status: response.status, body: await response.json(), calls }))
      db.close()
    `)
    expect(result.status).toBe(400)
    expect(result.body).toMatchObject({
      error: 'Orchestrator role is unassigned — assign it in Settings → Model routing',
    })
    expect(result.calls).toBe(0)
  })

  it('keeps the legacy chat request without sessionId out of chat_turns', async () => {
    const result = await runIsolated(`
      const { mkdirSync, writeFileSync } = await import('fs')
      const { join } = await import('path')
      const home = process.env.ORCHESTOS_HOME
      const cacheDir = join(home, '.orchestos', 'cache')
      mkdirSync(cacheDir, { recursive: true })
      writeFileSync(join(cacheDir, 'models.json'), JSON.stringify({
        fetchedAt: Date.now(),
        models: { 'deepseek/deepseek-v4-flash': { contextLength: 64000, priceIn: 0, priceOut: 0, supportsReasoning: false, supportsTools: false, maxOutputTokens: 8192, supportsVision: false } },
      }))
      const projectDir = join(home, 'legacy-chat-project')
      mkdirSync(projectDir, { recursive: true })
      writeFileSync(join(projectDir, 'orchestos.config.yaml'), 'roles:\\n  orchestrator: { agent: api, model: deepseek/deepseek-v4-flash, provider: openrouter }\\n  auxiliary: { agent: api, model: deepseek/deepseek-v4-flash, provider: openrouter }\\n')
      const { runMigrations } = await import('./src/db/migrate.ts')
      const { db } = await import('./src/db/sqlite.ts')
      const { handleApiChat } = await import('./src/dashboard/handlers/chat.ts')
      runMigrations()
      process.chdir(projectDir)
      writeFileSync(join(projectDir, 'orchestos.config.yaml'), 'roles:\\n  orchestrator: { agent: api, model: deepseek/deepseek-v4-flash, provider: openrouter }\\n  auxiliary: { agent: api, model: deepseek/deepseek-v4-flash, provider: openrouter }\\n')
      let calls = 0
      globalThis.fetch = async (_url, init) => {
        calls += 1
        const request = JSON.parse(String(init.body))
        const content = String(request.messages?.[0]?.content).includes('convierte instrucciones en lenguaje natural')
          ? JSON.stringify({ isTask: false, reason: 'conversational request' })
          : 'respuesta legacy'
        return new Response(JSON.stringify({
          choices: [{ message: { content } }], usage: { prompt_tokens: 1, completion_tokens: 1 }, model: 'deepseek/deepseek-v4-flash',
        }), { status: 200 })
      }
      const response = await handleApiChat(new Request('http://localhost/api/chat', {
        method: 'POST', body: JSON.stringify({ message: 'hola sin sesión', history: [] }),
      }))
      const payload = await response.json()
      const turns = db.query('SELECT COUNT(*) AS count FROM chat_turns').get().count
      process.stdout.write(JSON.stringify({ status: response.status, payload, turns, calls }))
      db.close()
    `)

    expect(result.status).toBe(200)
    expect(result.payload).toMatchObject({ text: 'respuesta legacy' })
    expect(result.turns).toBe(0)
    expect(result.calls).toBe(1)
  })

  // R.5 (decisión 10) — un turno pending con lease vigente es trabajo en
  // vuelo; borrar la sesión bajo eso descartaría evidencia sin que nadie
  // la viera (el CASCADE se lleva chat_turns/chat_messages).
  it('DELETE rejects a session with an in-flight turn, allows it once terminal', async () => {
    const result = await runIsolated(`
      const { runMigrations } = await import('./src/db/migrate.ts')
      const { db } = await import('./src/db/sqlite.ts')
      const handlers = await import('./src/dashboard/handlers/chat-sessions.ts')
      const sessions = await import('./src/db/chat-sessions.ts')
      const turns = await import('./src/db/chat-turns.ts')
      runMigrations()
      const session = sessions.createChatSession({ agent: 'api' })
      const started = turns.beginTurn({
        sessionId: session.id, projectId: null, requestKey: 'request-1',
        inputFingerprint: 'fingerprint-1', owner: 'worker-a',
      })
      const blockedResponse = handlers.handleApiChatSessionDelete(
        new URL('http://localhost/api/chat/sessions/' + session.id),
      )
      const blocked = await blockedResponse.json()
      turns.commitTurnFailure({ turnId: started.turn.id, owner: 'worker-a', error: 'done for this test' })
      const allowedResponse = handlers.handleApiChatSessionDelete(
        new URL('http://localhost/api/chat/sessions/' + session.id),
      )
      const remaining = db.query('SELECT COUNT(*) AS count FROM chat_sessions WHERE id = ?').get(session.id).count
      process.stdout.write(JSON.stringify({ blockedStatus: blockedResponse.status, blocked, allowedStatus: allowedResponse.status, remaining }))
      db.close()
    `)

    expect(result.blockedStatus).toBe(409)
    expect(result.blocked).toMatchObject({ error: expect.stringContaining('progress') })
    expect(result.allowedStatus).toBe(200)
    expect(result.remaining).toBe(0)
  })

  it('archives/restores sessions and soft-removes project registration without touching disk', async () => {
    const result = await runIsolated(`
      const { mkdirSync, writeFileSync, existsSync } = await import('node:fs')
      const { join } = await import('node:path')
      const { runMigrations } = await import('./src/db/migrate.ts')
      const { db } = await import('./src/db/sqlite.ts')
      const sessions = await import('./src/db/chat-sessions.ts')
      const { route } = await import('./src/dashboard/server.ts')
      runMigrations()
      const root = join(process.env.ORCHESTOS_HOME, 'kept-project')
      mkdirSync(root, { recursive: true })
      const marker = join(root, 'keep.txt')
      writeFileSync(marker, 'must survive')
      db.run('INSERT INTO projects (id, path, stack_profile, agents_md, last_updated) VALUES (?, ?, ?, ?, ?)', ['kept', root, '{}', '', new Date().toISOString()])
      const session = sessions.createChatSession({ projectId: 'kept', agent: 'api', title: 'Archived agent' })
      sessions.appendChatExchange({ sessionId: session.id, userContent: 'last request', assistantContent: 'last answer', model: 'test-model' })
      const archive = await route(new Request('http://localhost:4330/api/chat/sessions/' + session.id + '/archive', { method: 'POST' }), 4330)
      const normal = await route(new Request('http://localhost:4330/api/chat/sessions?project=kept', { headers: { 'X-Orchestos-Project-Id': 'kept' } }), 4330)
      const archived = await route(new Request('http://localhost:4330/api/chat/sessions?archived=1&project=kept', { headers: { 'X-Orchestos-Project-Id': 'kept' } }), 4330)
      const restore = await route(new Request('http://localhost:4330/api/chat/sessions/' + session.id + '/restore', { method: 'POST' }), 4330)
      const deleteProject = await route(new Request('http://localhost:4330/api/projects/kept', { method: 'DELETE', headers: { Origin: 'http://localhost:4330' } }), 4330)
      const projects = await route(new Request('http://localhost:4330/api/projects'), 4330)
      process.stdout.write(JSON.stringify({ archive: archive.status, normal: await normal.json(), archived: await archived.json(), restore: restore.status, deleteProject: deleteProject.status, projects: await projects.json(), sessionCount: db.query('SELECT COUNT(*) AS count FROM chat_sessions WHERE project_id = ?').get('kept').count, marker: existsSync(marker) }))
      db.close()
    `)
    expect(result.archive).toBe(200)
    expect(result.normal).toEqual([])
    expect(result.archived).toEqual([
      expect.objectContaining({ id: expect.any(String), archivedAt: expect.any(String) }),
    ])
    expect(result.restore).toBe(200)
    expect(result.deleteProject).toBe(200)
    expect(result.projects).toEqual([])
    expect(result.sessionCount).toBe(1)
    expect(result.marker).toBe(true)
  })

  it('timeline devuelve turnos, pasos y !cmd intercalados por created_at', async () => {
    const result = await runIsolated(`
      const { runMigrations } = await import('./src/db/migrate.ts')
      const { db } = await import('./src/db/sqlite.ts')
      const sessions = await import('./src/db/chat-sessions.ts')
      const turns = await import('./src/db/chat-turns.ts')
      const steps = await import('./src/db/chat-turn-steps.ts')
      const commands = await import('./src/db/console-commands.ts')
      const { handleApiChatSessionTimeline } = await import('./src/dashboard/handlers/chat-sessions.ts')
      runMigrations()
      const session = sessions.createChatSession({ agent: 'api', mode: 'code' })
      const claimed = turns.beginTurn({ sessionId: session.id, projectId: null, requestKey: 'timeline', inputFingerprint: 'timeline', owner: 'test' })
      const step = steps.insertChatTurnStep({ sessionId: session.id, turnId: claimed.turn.id, seq: 0, type: 'tool_use', tool: 'Bash', target: 'pwd', exitCode: 0, ok: true })
      const command = commands.insertConsoleCommand({ sessionId: session.id, cmd: 'ls', exitCode: 0, stdout: 'ok', stderr: '', timedOut: false, elapsedMs: 3 })
      db.run('UPDATE chat_turns SET created_at = ? WHERE id = ?', ['2026-01-01T00:00:00.000Z', claimed.turn.id])
      db.run('UPDATE chat_turn_steps SET created_at = ? WHERE id = ?', ['2026-01-01T00:00:01.000Z', step.id])
      db.run('UPDATE console_commands SET created_at = ? WHERE id = ?', ['2026-01-01T00:00:02.000Z', command.id])
      const response = handleApiChatSessionTimeline(new URL('http://localhost/api/chat/sessions/' + session.id + '/timeline'))
      const body = await response.json()
      process.stdout.write(JSON.stringify({ status: response.status, kinds: body.events.map((event) => event.kind), step: body.turns[0].steps[0], command: body.commands[0] }))
      db.close()
    `)
    expect(result.status).toBe(200)
    expect(result.kinds).toEqual(['turn', 'step', 'command'])
    expect(result.step).toMatchObject({ tool: 'Bash', exitCode: 0, ok: true })
    expect(result.command).toMatchObject({ cmd: 'ls', exitCode: 0 })
  })
})
