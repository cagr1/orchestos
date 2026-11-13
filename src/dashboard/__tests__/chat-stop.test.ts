import { expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// The isolated child may have a cold Bun transpilation cache in CI.
const ISOLATED_TIMEOUT_MS = 30_000

async function isolated(body: string): Promise<any> {
  const home = mkdtempSync(join(tmpdir(), 'chat-stop-'))
  try {
    const child = Bun.spawn(
      [
        process.execPath,
        '-e',
        `
      const originalWhich = Bun.which
      Bun.which = (name, options) => name === 'claude' || name === 'codex' ? null : originalWhich(name, options)
      const { runMigrations } = await import('./src/db/migrate.ts')
      runMigrations()
      const sessions = await import('./src/db/chat-sessions.ts')
      const turns = await import('./src/db/chat-turns.ts')
      const registry = await import('./src/dashboard/handlers/chat-turn-registry.ts')
      const { handleApiChatSessionStop, handleApiChatSessionMessages, handleApiChatSessionArchive } = await import('./src/dashboard/handlers/chat-sessions.ts')
      const { db } = await import('./src/db/sqlite.ts')
      const session = sessions.createChatSession({ agent: 'codex' })
      const stop = (turnId, id = session.id) => {
        const url = new URL('http://localhost/api/chat/sessions/' + id + '/stop')
        return handleApiChatSessionStop(new Request(url, { method: 'POST', body: JSON.stringify(turnId ? { turnId } : {}) }), url)
      }
      ${body}
      db.close()
    `,
      ],
      { env: { ...process.env, ORCHESTOS_HOME: home }, stdout: 'pipe', stderr: 'pipe' },
    )
    const [code, out, err] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ])
    expect(code, err).toBe(0)
    return JSON.parse(out)
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
}

test(
  'SES.1c reconciles expired leases without interrupting another live owner',
  async () => {
    const result = await isolated(`
    const input = { sessionId: session.id, projectId: null, requestKey: 'expired', inputFingerprint: 'fp', owner: 'dead-owner', userContent: 'original', hasAttachments: true }
    const expired = turns.beginTurn({ ...input, leaseMs: -1 }).turn
    const other = sessions.createChatSession({ agent: 'codex' })
    const live = turns.beginTurn({ ...input, sessionId: other.id, requestKey: 'live', owner: 'other-process' }).turn
    const count = turns.reconcileChatTurns()
    console.log(JSON.stringify({ count, expired: turns.getTurn(expired.id), live: turns.getTurn(live.id) }))
  `)
    expect(result.count).toBe(1)
    expect(result.expired).toMatchObject({
      status: 'interrupted',
      user_content: 'original',
      has_attachments: 1,
    })
    expect(result.live.status).toBe('pending')
  },
  ISOLATED_TIMEOUT_MS,
)

test(
  'SES.1c shutdown marks registered turns before abort and reports their titles',
  async () => {
    const result = await isolated(`
    const turn = turns.beginTurn({ sessionId: session.id, projectId: null, requestKey: 'shutdown', inputFingerprint: 'fp', owner: 'worker' }).turn
    const signal = registry.registerChatTurn(session.id, turn.id)
    let atAbort
    signal.addEventListener('abort', () => atAbort = turns.getTurn(turn.id).status)
    const logs = []
    const log = console.log
    console.log = text => logs.push(text)
    registry.interruptActiveChatTurns()
    console.log = log
    registry.unregisterChatTurn(session.id, turn.id)
    console.log(JSON.stringify({ status: turns.getTurn(turn.id).status, aborted: signal.aborted, atAbort, logs, title: sessions.getChatSession(session.id).title }))
  `)
    expect(result.status).toBe('interrupted')
    expect(result.aborted).toBe(true)
    expect(result.atAbort).toBe('interrupted')
    expect(result.logs).toEqual([`[dashboard] Stopped chat turn: ${result.title}`])
  },
  ISOLATED_TIMEOUT_MS,
)

test(
  'stop without a turn id stops the active turn or reports idle',
  async () => {
    const result = await isolated(`
    const turn = turns.beginTurn({ sessionId: session.id, projectId: null, requestKey: 'key', inputFingerprint: 'fp', owner: 'worker' }).turn
    const signal = registry.registerChatTurn(session.id, turn.id)
    const active = await stop()
    registry.unregisterChatTurn(session.id, turn.id)
    const idle = await stop()
    console.log(JSON.stringify({ active: [active.status, await active.json()], aborted: signal.aborted, idle: [idle.status, await idle.json()] }))
  `)
    expect(result).toEqual({
      active: [202, { status: 'stopping' }],
      aborted: true,
      idle: [200, { status: 'idle' }],
    })
  },
  ISOLATED_TIMEOUT_MS,
)

test(
  'Stop is idempotent, scopes the turn to its session and replays cancelled results',
  async () => {
    const result = await isolated(`
    const input = { sessionId: session.id, projectId: null, requestKey: 'key', inputFingerprint: 'fp', owner: 'worker' }
    const turn = turns.beginTurn(input).turn
    const signal = registry.registerChatTurn(session.id, turn.id)
    const first = await stop(turn.id)
    const second = await stop(turn.id)
    const other = sessions.createChatSession({ agent: 'codex' })
    const wrongSession = await stop(turn.id, other.id)
    const absentTurn = await stop('missing')
    const absentSession = await stop(turn.id, 'missing')
    const aborted = signal.aborted
    turns.commitTurnCancelled({ turnId: turn.id, owner: 'worker', userContent: 'question', text: 'partial', model: 'fake' })
    registry.unregisterChatTurn(session.id, turn.id)
    const final = await stop(turn.id)
    const replay = turns.beginTurn(input)
    const messages = await handleApiChatSessionMessages(new URL('http://localhost/api/chat/sessions/' + session.id + '/messages')).json()
    console.log(JSON.stringify({ first: [first.status, await first.json()], second: second.status, final: [final.status, await final.json()], missing: [wrongSession.status, absentTurn.status, absentSession.status], aborted, turn: turns.getTurn(turn.id), replay: replay.kind, messages }))
  `)
    expect(result.first).toEqual([202, { status: 'stopping' }])
    expect(result.second).toBe(202)
    expect(result.final).toEqual([200, { status: 'cancelled' }])
    expect(result.missing).toEqual([404, 404, 404])
    expect(result.aborted).toBe(true)
    expect(result.turn.error).toBeNull()
    expect(result.replay).toBe('duplicate-result')
    expect(JSON.parse(result.turn.response_envelope_json)).toMatchObject({
      text: 'partial',
      stopped: true,
    })
    expect(result.messages[1]).toMatchObject({ content: 'partial', stopped: true })
  },
  ISOLATED_TIMEOUT_MS,
)

for (const partial of ['', 'partial'])
  test(
    `chat persists cancelled ${partial ? 'partial' : 'empty'} response and ignores late create_task`,
    async () => {
      const result = await isolated(`
    const { handleApiChat } = await import('./src/dashboard/handlers/chat.ts')
    const { cliChatAdapterFor } = await import('./src/run/executors/chat-adapters.ts')
    const { mkdirSync, writeFileSync, readFileSync } = await import('node:fs')
    const root = process.env.ORCHESTOS_HOME + '/project'
    mkdirSync(root)
    writeFileSync(root + '/orchestos.config.yaml', 'roles:\\n  orchestrator: { agent: api, provider: openrouter, model: mock/model }\\n')
    writeFileSync(root + '/tasks.yaml', 'version: 1\\nproject: fixture\\ntasks: []\\n')
    const originalTasks = readFileSync(root + '/tasks.yaml', 'utf8')
    db.run('INSERT INTO projects (id,path,stack_profile,agents_md,last_updated) VALUES (?,?,?,?,?)', ['fixture', root, '{}', '', new Date().toISOString()])
    db.run('UPDATE chat_sessions SET project_id = ?, mode = ? WHERE id = ?', ['fixture', 'code', session.id])
    let first, second, calls = 0
    cliChatAdapterFor('codex').runTurn = async i => {
      calls++
      i.onText(${JSON.stringify(partial)})
      const turn = turns.getActiveTurn(session.id)
      first = (await stop(turn.id)).status
      second = (await stop(turn.id)).status
      i.onStep({ type: 'tool_use', label: 'mcp__orchestos__create_task', detail: JSON.stringify({ description: 'late', outputs: ['late.txt'] }) })
      i.onText('late text must not be saved')
      return { text: 'late result', inputTokens: 1, outputTokens: 1, model: 'fake', resultLabel: 'fake', readAudit: { kind: 'uninstrumented' } }
    }
    const response = await handleApiChat(new Request('http://localhost/api/chat', { method: 'POST', body: JSON.stringify({ sessionId: session.id, message: 'question', requestKey: 'stop', model: 'gpt-6-luna' }) }))
    const turn = turns.getLastTurn(session.id)
    console.log(JSON.stringify({ status: response.status, body: await response.json(), turn, messages: sessions.listChatMessages(session.id), first, second, calls, tasksUnchanged: readFileSync(root + '/tasks.yaml', 'utf8') === originalTasks, finalStop: (await stop(turn.id)).status }))
  `)
      expect(result.status).toBe(200)
      expect(result.body).toMatchObject({ text: partial, stopped: true })
      expect(result.turn.status).toBe('cancelled')
      expect(result.turn.error).toBeNull()
      expect(result.turn.task_id).toBeNull()
      expect(result.messages[1]).toMatchObject({ content: partial, stopped: true })
      expect(result.tasksUnchanged).toBe(true)
      expect([result.first, result.second, result.calls, result.finalStop]).toEqual([
        202, 202, 1, 200,
      ])
    },
    ISOLATED_TIMEOUT_MS,
  )

test(
  'Claude stopped session clears persisted resume id and next turn resends transcript',
  async () => {
    const result = await isolated(`
    const { cliChatAdapterFor } = await import('./src/run/executors/chat-adapters.ts')
    const { chatContextHash } = await import('./src/run/executors/codex-app-server.ts')
    sessions.setClaudeChatSession(session.id, 'old-id', chatContextHash('rules'), 2)
    const controller = new AbortController()
    const calls = []
    const adapter = cliChatAdapterFor('claude')
    const input = { cwd: '/tmp', system: 'rules', message: 'question', timeout: 1000, model: 'fake', hasProjectContext: true, sessionId: session.id, historyLength: 2, transcript: 'previous transcript\\n', imagePaths: [], onStep() {}, onText() {}, deps: { claude: async (...args) => {
      calls.push({ text: args[2], resume: args[9] ?? null })
      if (calls.length === 1) { controller.abort(); throw new Error('aborted') }
      return { text: 'answer', inputTokens: 0, outputTokens: 0, model: 'fake' }
    } } }
    try { await adapter.runTurn({ ...input, signal: controller.signal }) } catch {}
    const stored = sessions.getClaudeChatSession(session.id)
    await adapter.runTurn(input)
    console.log(JSON.stringify({ stored, calls }))
  `)
    expect(result.stored.sessionId).toBeNull()
    expect(result.calls[0].resume).toBe('old-id')
    expect(result.calls[1]).toEqual({ text: 'previous transcript\nquestion', resume: null })
  },
  ISOLATED_TIMEOUT_MS,
)

test(
  'API fetch receives the turn signal; late create_task in tool response is never executed',
  async () => {
    const result = await isolated(`
    const { chat } = await import('./src/providers/openrouter.ts')
    const { runToolLoop } = await import('./src/providers/tool-call.ts')
    process.env.OPENROUTER_API_KEY = 'fixture-key'
    const controller = new AbortController()
    let received, calls = 0
    globalThis.fetch = async (_url, init) => {
      received = init.signal
      controller.abort()
      received.throwIfAborted()
    }
    let rejected = false
    try { await chat({ model: 'fake', system: '', messages: [], signal: controller.signal }) } catch { rejected = true }
    const toolController = new AbortController()
    globalThis.fetch = async (_url, init) => {
      toolController.abort()
      return new Response(JSON.stringify({ choices: [{ message: { content: '', tool_calls: [{ id: 'late', function: { name: 'create_task', arguments: '{}' } }] } }] }))
    }
    let toolRejected = false
    try { await runToolLoop('openrouter', 'fake', { system: '', messages: [], tools: [], signal: toolController.signal, executeTool: async () => { calls++; return 'created' } }) } catch { toolRejected = true }
    console.log(JSON.stringify({ sameSignal: received === controller.signal, aborted: received.aborted, rejected, toolRejected, calls }))
  `)
    expect(result).toEqual({
      sameSignal: true,
      aborted: true,
      rejected: true,
      toolRejected: true,
      calls: 0,
    })
  },
  ISOLATED_TIMEOUT_MS,
)

test(
  'Codex abort never falls back to exec or retries a protocol failure',
  async () => {
    const result = await isolated(`
    const { CodexAppServer, stopCodexAppServers } = await import('./src/run/executors/codex-app-server.ts')
    const { runCodexChat } = await import('./src/run/executors/codex.ts')
    const { mkdirSync } = await import('node:fs')
    const root = process.env.ORCHESTOS_HOME + '/project'
    mkdirSync(root)
    const controller = new AbortController()
    let turnsCalled = 0, spawns = 0
    Bun.which = () => process.execPath
    Bun.spawn = () => { spawns++; throw new Error('unexpected exec fallback') }
    CodexAppServer.prototype.turn = async () => {
      turnsCalled++
      controller.abort()
      throw Object.assign(new Error('stopped protocol failure'), { protocol: true })
    }
    let error
    try { await runCodexChat(root, 'rules', 'question', 1000, undefined, undefined, undefined, session.id, undefined, undefined, undefined, [], undefined, controller.signal) } catch (e) { error = e.message }
    stopCodexAppServers()
    console.log(JSON.stringify({ turnsCalled, spawns, error }))
  `)
    expect(result).toEqual({ turnsCalled: 1, spawns: 0, error: 'stopped protocol failure' })
  },
  ISOLATED_TIMEOUT_MS,
)

test(
  'migration 33 preserves populated turns, indexes and dependent rows and accepts cancelled',
  async () => {
    const result = await isolated(`
    const { applyMigrationSteps, FUTURE_MIGRATIONS } = await import('./src/db/migrate.ts')
    const turn = turns.beginTurn({ sessionId: session.id, projectId: null, requestKey: 'key', inputFingerprint: 'fp', owner: 'worker' }).turn
    sessions.appendChatExchange({ sessionId: session.id, turnId: turn.id, userContent: 'question', assistantContent: 'answer' })
    db.run("INSERT INTO chat_turn_steps (session_id, turn_id, seq, type, detail, created_at) VALUES (?, ?, 1, 'text', 'partial', 'created')", [session.id, turn.id])
    const sql = db.query("SELECT sql FROM sqlite_master WHERE name = 'chat_turns'").get().sql
    const indexes = db.query("SELECT sql FROM sqlite_master WHERE type = 'index' AND tbl_name = 'chat_turns' AND sql IS NOT NULL ORDER BY name").all()
    db.exec('PRAGMA foreign_keys = OFF')
    db.exec(sql.replace(/CREATE TABLE ["\x60]?chat_turns["\x60]?/i, 'CREATE TABLE old_turns').replace(",'cancelled'", ''))
    db.exec('INSERT INTO old_turns SELECT * FROM chat_turns; DROP TABLE chat_turns; ALTER TABLE old_turns RENAME TO chat_turns')
    for (const row of indexes) db.exec(row.sql)
    db.exec('DELETE FROM schema_migrations WHERE version = 33; PRAGMA foreign_keys = ON')
    const before = turns.getTurn(turn.id)
    applyMigrationSteps(FUTURE_MIGRATIONS)
    const after = turns.getTurn(turn.id)
    const indexesAfter = db.query("SELECT sql FROM sqlite_master WHERE type = 'index' AND tbl_name = 'chat_turns' AND sql IS NOT NULL ORDER BY name").all()
    db.run("UPDATE chat_turns SET status = 'cancelled' WHERE id = ?", [turn.id])
    console.log(JSON.stringify({ before, after, indexes, indexesAfter, status: turns.getTurn(turn.id).status, messages: sessions.listChatMessages(session.id).length, steps: db.query('SELECT COUNT(*) AS n FROM chat_turn_steps WHERE turn_id = ?').get(turn.id).n, foreignKeys: db.query('PRAGMA foreign_keys').get().foreign_keys, violations: db.query('PRAGMA foreign_key_check').all() }))
  `)
    expect(result.after).toEqual(result.before)
    expect(result.indexesAfter).toEqual(result.indexes)
    expect(result.status).toBe('cancelled')
    expect([result.messages, result.steps, result.foreignKeys]).toEqual([2, 1, 1])
    expect(result.violations).toEqual([])
  },
  ISOLATED_TIMEOUT_MS,
)

const aud24Fixture = `
  const { mkdirSync, writeFileSync } = await import('node:fs')
  const root = process.env.ORCHESTOS_HOME + '/project'
  mkdirSync(root)
  writeFileSync(root + '/orchestos.config.yaml', 'roles:\\n  orchestrator: { agent: api, provider: openrouter, model: mock/model }\\n')
  writeFileSync(root + '/tasks.yaml', 'version: 1\\nproject: fixture\\ntasks: []\\n')
  db.run('INSERT INTO projects (id,path,stack_profile,agents_md,last_updated) VALUES (?,?,?,?,?)', ['fixture', root, '{}', '', new Date().toISOString()])
  db.run('UPDATE chat_sessions SET project_id = ?, mode = ? WHERE id = ?', ['fixture', 'code', session.id])
  const { cliChatAdapterFor } = await import('./src/run/executors/chat-adapters.ts')
  let calls = 0
  cliChatAdapterFor('codex').runTurn = async () => {
    calls++
    await Bun.sleep(900)
    return { text: 'durable answer', inputTokens: 1, outputTokens: 1, model: 'fake', resultLabel: 'fake', readAudit: { kind: 'uninstrumented' } }
  }
  const request = (extra = {}) => new Request('http://localhost/api/chat', { method: 'POST', body: JSON.stringify({ sessionId: session.id, message: 'question', requestKey: 'aud24', model: 'gpt-6-luna', ...extra }) })
`

test(
  'AUD.24 renews a short lease throughout a long provider call',
  async () => {
    const result = await isolated(
      aud24Fixture +
        `
    const { handleApiChat, setChatTurnLeaseForTests } = await import('./src/dashboard/handlers/chat.ts')
    setChatTurnLeaseForTests(300, 50)
    const response = await handleApiChat(request())
    console.log(JSON.stringify({ status: response.status, body: await response.json(), turn: turns.getLastTurn(session.id), messages: sessions.listChatMessages(session.id), calls }))
  `,
    )
    expect(result.status).toBe(200)
    expect(result.turn.status).toBe('completed')
    expect(result.messages[1].content).toBe('durable answer')
    expect(result.calls).toBe(1)
  },
  ISOLATED_TIMEOUT_MS,
)

test(
  'AUD.24 context failure resolves the claimed turn before the inner catch',
  async () => {
    const result = await isolated(
      aud24Fixture +
        `
    const { mock } = await import('bun:test')
    const context = await import('./src/context/load.ts')
    mock.module('./src/context/load.ts', () => ({ ...context, refreshProjectContext: async () => { throw new Error('context fixture failed') } }))
    const { handleApiChat } = await import('./src/dashboard/handlers/chat.ts')
    const response = await handleApiChat(request())
    console.log(JSON.stringify({ status: response.status, body: await response.json(), turn: turns.getLastTurn(session.id), calls }))
  `,
    )
    expect(result.status).toBe(500)
    expect(result.body.error).toBe('Chat failed: context fixture failed')
    expect(result.turn.status).toBe('failed')
    expect(result.calls).toBe(0)
  },
  ISOLATED_TIMEOUT_MS,
)

test(
  'AUD.24 failed request replays as 409 without repeating the provider',
  async () => {
    const result = await isolated(
      aud24Fixture +
        `
    cliChatAdapterFor('codex').runTurn = async () => { calls++; throw new Error('provider fixture failed') }
    const { handleApiChat } = await import('./src/dashboard/handlers/chat.ts')
    await handleApiChat(request())
    const error = turns.getLastTurn(session.id).error
    const response = await handleApiChat(request())
    console.log(JSON.stringify({ status: response.status, body: await response.json(), error, calls }))
  `,
    )
    expect(result.status).toBe(409)
    expect(result.body).toMatchObject({ error: result.error, replayed: true })
    expect(result.calls).toBe(1)
  },
  ISOLATED_TIMEOUT_MS,
)

test(
  'AUD.24 missing attachment fails before calling the provider',
  async () => {
    const result = await isolated(
      aud24Fixture +
        `
    const { handleApiChat } = await import('./src/dashboard/handlers/chat.ts')
    const response = await handleApiChat(request({ fileIds: ['expired-file'] }))
    console.log(JSON.stringify({ status: response.status, body: await response.json(), turn: turns.getLastTurn(session.id), calls }))
  `,
    )
    expect(result.status).toBe(400)
    expect(result.body.error).toBe('Attachment expired or not found: 1 file(s). Attach them again.')
    expect(result.turn.status).toBe('failed')
    expect(result.calls).toBe(0)
  },
  ISOLATED_TIMEOUT_MS,
)

test(
  'AUD.24 registration failure resolves the new turn',
  async () => {
    const result = await isolated(
      aud24Fixture +
        `
    registry.registerChatTurn(session.id, 'older-local-turn')
    const { handleApiChat } = await import('./src/dashboard/handlers/chat.ts')
    const response = await handleApiChat(request())
    registry.unregisterChatTurn(session.id, 'older-local-turn')
    console.log(JSON.stringify({ status: response.status, turn: turns.getLastTurn(session.id), calls }))
  `,
    )
    expect(result.status).toBe(500)
    expect(result.turn.status).toBe('failed')
    expect(result.calls).toBe(0)
  },
  ISOLATED_TIMEOUT_MS,
)

test(
  'Archive stops the running turn before archiving (SES.1)',
  async () => {
    const result = await isolated(`
    const turn = turns.beginTurn({ sessionId: session.id, projectId: null, requestKey: 'k', inputFingerprint: 'fp', owner: 'w' }).turn
    const signal = registry.registerChatTurn(session.id, turn.id)
    const res = handleApiChatSessionArchive(new URL('http://localhost/api/chat/sessions/' + session.id + '/archive'))
    const idle = sessions.createChatSession({ agent: 'codex' })
    const idleRes = handleApiChatSessionArchive(new URL('http://localhost/api/chat/sessions/' + idle.id + '/archive'))
    console.log(JSON.stringify({ status: res.status, aborted: signal.aborted, idle: idleRes.status }))
  `)
    expect(result).toEqual({ status: 200, aborted: true, idle: 200 })
  },
  ISOLATED_TIMEOUT_MS,
)
