import { expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('LIMP.3 — config import does not open the database', async () => {
  const proc = Bun.spawn(['bun', '-e', 'await import("./src/config/load.ts")'], {
    cwd: process.cwd(),
    env: { ...process.env, ORCHESTOS_HOME: '/dev/null' },
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const [stderr, code] = await Promise.all([new Response(proc.stderr).text(), proc.exited])
  expect(code, stderr).toBe(0)
})

test('LIMP.3 — registered chat adapters persist in sessions but are rejected for tasks', async () => {
  const home = mkdtempSync(join(tmpdir(), 'orchestos-agent-choice-'))
  try {
    const proc = Bun.spawn(
      [
        'bun',
        '-e',
        `
      const assert = (await import('node:assert/strict')).default
      const { writeFileSync } = await import('node:fs')
      const { join } = await import('node:path')
      const { runMigrations } = await import('./src/db/migrate.ts')
      const { db } = await import('./src/db/sqlite.ts')
      const { loadOrcheConfig, agentChoices } = await import('./src/config/load.ts')
      const { KNOWN_CLIS } = await import('./src/run/executors/cli-registry.ts')
      const { cliChatAdapterFor, registerCliChatAdapter } = await import('./src/run/executors/chat-adapters.ts')
      const { createChatSession, getChatSession } = await import('./src/db/chat-sessions.ts')
      const { handleApiChatSessionsCreate } = await import('./src/dashboard/handlers/chat-sessions.ts')
      const { handleApiConfigSet } = await import('./src/dashboard/handlers/config.ts')
      runMigrations()
      const root = process.env.ORCHESTOS_HOME
      const post = body => new Request('http://localhost/api/config', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      assert.deepEqual(agentChoices(), ['local', 'claude', 'opencode', 'codex', 'api'])
      const unknown = await handleApiConfigSet(post({ agent: 'unknown-cli' }), root)
      assert.equal(unknown.status, 400)
      assert.equal((await unknown.json()).error, 'agent must be one of: local, claude, opencode, codex, api')
      const warnings = []
      const originalError = console.error
      console.error = (...args) => warnings.push(args.join(' '))
      writeFileSync(join(root, 'orchestos.config.yaml'), 'agent: unknown-cli\\n')
      assert.equal(loadOrcheConfig(root).agent, undefined)
      console.error = originalError
      assert.deepEqual(warnings, ["[config] ignorando agent: 'unknown-cli' no es un valor válido — se usará el default. Valores permitidos: local, claude, opencode, codex, api."])
      for (const agent of agentChoices()) {
        writeFileSync(join(root, 'orchestos.config.yaml'), 'agent: ' + agent + '\\n')
        assert.equal(loadOrcheConfig(root).agent, agent)
      }
      // Chat registration must not expand the task engines supported by config.
      KNOWN_CLIS.push({ ...KNOWN_CLIS.find(c => c.id === 'gemini'), id: 'fake-cli', binary: 'fake-cli' })
      registerCliChatAdapter('fake-cli', { ...cliChatAdapterFor('claude'), label: 'Fake CLI' })
      writeFileSync(join(root, 'orchestos.config.yaml'), 'agent: fake-cli\\ntaskAgentRules:\\n  - match: { skill: fake }\\n    agent: fake-cli\\n')
      assert.deepEqual(agentChoices(), ['local', 'claude', 'opencode', 'codex', 'api'])
      const taskWarnings = []
      console.error = (...args) => taskWarnings.push(args.join(' '))
      const cfg = loadOrcheConfig(root)
      console.error = originalError
      assert.equal(cfg.agent, undefined)
      assert.equal(cfg.taskAgentRules, undefined)
      assert.deepEqual(taskWarnings, [
        "[config] ignorando agent: 'fake-cli' no es un valor válido — se usará el default. Valores permitidos: local, claude, opencode, codex, api.",
        "[config] ignorando taskAgentRules[].agent: 'fake-cli' no es un valor válido — se usará el default. Valores permitidos: local, claude, opencode, codex, api.",
      ])
      const saved = await handleApiConfigSet(post({ agent: 'fake-cli', taskAgentRules: [{ match: { skill: 'fake' }, agent: 'fake-cli' }] }), root)
      assert.equal(saved.status, 400)
      assert.equal((await saved.json()).error, 'agent must be one of: local, claude, opencode, codex, api')
      const session = createChatSession({ projectId: null, agent: 'fake-cli' })
      assert.equal(getChatSession(session.id).agent, 'fake-cli')
      for (const agent of ['fake-cli', 'local', 'api']) {
        const response = await handleApiChatSessionsCreate(post({ projectId: null, agent }))
        assert.equal(response.status, 201)
        assert.equal((await response.json()).agent, agent)
      }
      const rejected = await handleApiChatSessionsCreate(post({ projectId: null, agent: 'unknown-cli' }))
      assert.equal(rejected.status, 400)
      assert.equal((await rejected.json()).error, 'chat no soportado')
      for (const agent of ['unknown-cli', 'fake-cli']) {
        const invalidRule = await handleApiConfigSet(post({ taskAgentRules: [{ match: { skill: 'fake' }, agent }] }), root)
        assert.equal(invalidRule.status, 400)
        assert.equal((await invalidRule.json()).error, 'taskAgentRules[0].agent must be one of: local, claude, opencode, codex, api')
      }
      db.close()
      console.log('LIMP.3 assertions passed')
    `,
      ],
      {
        cwd: process.cwd(),
        env: { ...process.env, HOME: home, ORCHESTOS_HOME: home },
        stdout: 'pipe',
        stderr: 'pipe',
      },
    )
    const [stdout, stderr, code] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ])
    expect(code, stderr).toBe(0)
    expect(stdout).toContain('LIMP.3 assertions passed')
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})

test('AT.11 — public CLI registration drives session → turn → persistence without API fallback', async () => {
  const home = mkdtempSync(join(tmpdir(), 'orchestos-chat-adapter-'))
  try {
    const proc = Bun.spawn(
      [
        'bun',
        '-e',
        `
      const { runMigrations } = await import('./src/db/migrate.ts')
      const { db } = await import('./src/db/sqlite.ts')
      const { KNOWN_CLIS } = await import('./src/run/executors/cli-registry.ts')
      const { cliChatAdapterFor, registerCliChatAdapter } = await import('./src/run/executors/chat-adapters.ts')
      const { uninstrumentedReadAudit } = await import('./src/run/read-audit.ts')
      const { readCliModelCatalogs, readCliModelCatalogsCached } = await import('./src/dashboard/chat-cli-models.ts')
      const { handleApiChat, handleApiChatCliModels, chatEffortLevelsForAgent } = await import('./src/dashboard/handlers/chat.ts')
      const { handleApiChatSessionsCreate, handleApiChatSessionTimeline } = await import('./src/dashboard/handlers/chat-sessions.ts')
      const { listChatMessages } = await import('./src/db/chat-sessions.ts')
      runMigrations()
      let apiCalls = 0
      globalThis.fetch = async () => { apiCalls++; throw new Error('API must never be called') }
      const definition = (id) => ({ ...KNOWN_CLIS.find(c => c.id === 'gemini'), id, binary: id, label: id })
      KNOWN_CLIS.push(definition('fixture-chat'), definition('fixture-no-chat'))
      let turnInput
      let turns = 0
      registerCliChatAdapter('fixture-chat', {
        chat: true, label: 'Fixture CLI', efforts: ['fixture-effort'], taskToolRequiresSession: false,
        validateModel: (model, models) => model === 'fixture-model' && models.some(m => m.id === model) ? null : 'invalid fixture model',
        async runTurn(input) {
          turns++
          turnInput = { model: input.model, effort: input.effort, sessionId: input.sessionId, message: input.message }
          input.onStep({ type: 'text', label: 'fixture step', detail: 'fixture reply' })
          input.onText('fixture reply')
          return { text: 'fixture reply', resultLabel: 'fixture-observed via Fixture CLI', model: 'fixture-observed',
            inputTokens: 17, outputTokens: 9, usd: 0.012, readAudit: uninstrumentedReadAudit(), cliSessionId: 'fixture-native-session' }
        },
        async runRole() { throw new Error('role runner must not be used by chat') },
        failure: e => ({ message: e.message }),
      })
      const registeredFixture = cliChatAdapterFor('fixture-chat')
      let duplicateRegistrationRejected = false
      try { registerCliChatAdapter('fixture-chat', { ...registeredFixture, label: 'replacement' }) }
      catch (error) { duplicateRegistrationRejected = error.message === 'CLI chat adapter already registered: fixture-chat' }
      const fixture = { ...definition('fixture-chat'), installed: true, path: '/fixture' }
      const unsupported = { ...definition('fixture-no-chat'), installed: true, path: '/fixture' }
      const catalogs = await readCliModelCatalogs(async () => { throw new Error('no real binary allowed') }, [fixture, unsupported])
      catalogs.find(c => c.id === 'fixture-chat').models = [{ id: 'fixture-model', name: 'Fixture', short: 'Fixture' }]
      await readCliModelCatalogsCached({ read: async () => catalogs })
      const endpoint = await (await handleApiChatCliModels()).json()
      const post = (path, body) => new Request('http://localhost/api/chat' + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const createResponse = await handleApiChatSessionsCreate(post('/sessions', { projectId: null, agent: 'fixture-chat' }))
      const session = await createResponse.json()
      const root = { id: null, root: process.env.HOME, source: 'legacy-cwd' }
      const response = await handleApiChat(post('', { sessionId: session.id, agent: 'fixture-chat', model: 'fixture-model', effort: 'fixture-effort', message: 'hello fixture' }), root)
      const reply = await response.json()
      const messages = listChatMessages(session.id)
      const timeline = await handleApiChatSessionTimeline(new URL('http://localhost/api/chat/sessions/' + session.id + '/timeline')).json()
      const run = db.query('SELECT provider, model, input_tokens, output_tokens, usd_cost, cli_session_id FROM runs WHERE task_class = ?').get('chat')
      const rejectedResponse = await handleApiChat(post('', { sessionId: session.id, agent: 'fixture-chat', model: 'wrong-model', message: 'invalid' }), root)
      const rejected = await rejectedResponse.json()
      const noChatCreate = await handleApiChatSessionsCreate(post('/sessions', { projectId: null, agent: 'fixture-no-chat' }))
      const noChatCreateReply = await noChatCreate.json()
      const unsupportedResponse = await handleApiChat(post('', { agent: 'fixture-no-chat', model: 'fixture-model', message: 'hello' }), root)
      const unsupportedReply = await unsupportedResponse.json()
      const unknownResponse = await handleApiChat(post('', { agent: 'unregistered-cli', model: 'fixture-model', message: 'hello' }), root)
      const unknownReply = await unknownResponse.json()
      const opencodeResponse = await handleApiChat(post('', { agent: 'opencode', model: 'fixture-model', message: 'hello' }), root)
      const opencodeReply = await opencodeResponse.json()
      process.stdout.write(JSON.stringify({ createStatus: createResponse.status, status: response.status, reply, endpoint, messages, timeline, run, turnInput, turns,
        efforts: chatEffortLevelsForAgent('fixture-chat'), duplicateRegistrationRejected, duplicateKeptOriginal: cliChatAdapterFor('fixture-chat') === registeredFixture, rejectedStatus: rejectedResponse.status, rejected, unsupportedStatus: unsupportedResponse.status, unsupportedReply,
        noChatCreateStatus: noChatCreate.status, noChatCreateReply, unknownStatus: unknownResponse.status, unknownReply, opencodeStatus: opencodeResponse.status, opencodeReply, apiCalls }))
      db.close()
    `,
      ],
      {
        cwd: process.cwd(),
        env: { ...process.env, HOME: home, ORCHESTOS_HOME: home },
        stdout: 'pipe',
        stderr: 'pipe',
      },
    )
    const [stdout, stderr, code] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ])
    expect(code, stderr).toBe(0)
    const result = JSON.parse(stdout)
    expect(result.createStatus).toBe(201)
    expect(result.status).toBe(200)
    expect(result.reply).toMatchObject({
      text: 'fixture reply',
      model: 'fixture-observed via Fixture CLI',
    })
    expect(result.endpoint).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'fixture-chat', installed: true, chat: true }),
        expect.objectContaining({ id: 'fixture-no-chat', installed: true, chat: false }),
      ]),
    )
    expect(result.turnInput).toMatchObject({
      model: 'fixture-model',
      effort: 'fixture-effort',
      message: 'hello fixture',
    })
    expect(result.turnInput.sessionId).toBeString()
    expect(result.efforts).toEqual(['fixture-effort'])
    expect(result.duplicateRegistrationRejected).toBe(true)
    expect(result.duplicateKeptOriginal).toBe(true)
    expect(result.turns).toBe(1)
    expect(
      result.messages.map((m: { role: string; content: string }) => [m.role, m.content]),
    ).toEqual([
      ['user', 'hello fixture'],
      ['assistant', 'fixture reply'],
    ])
    expect(result.run).toMatchObject({
      provider: 'fixture-chat',
      model: 'fixture-observed',
      input_tokens: 17,
      output_tokens: 9,
      usd_cost: 0.012,
      cli_session_id: 'fixture-native-session',
    })
    expect(result.timeline.turns).toHaveLength(1)
    expect(result.timeline.turns[0]).toMatchObject({
      status: 'completed',
      steps: [expect.objectContaining({ type: 'text', detail: 'fixture reply' })],
    })
    expect(result.rejectedStatus).toBe(400)
    expect(result.rejected.error).toBe('invalid fixture model')
    expect(result.noChatCreateStatus).toBe(400)
    expect(result.noChatCreateReply.error).toBe('chat no soportado')
    expect(result.unsupportedStatus).toBe(400)
    expect(result.unsupportedReply.error).toBe('chat no soportado')
    expect(result.unknownStatus).toBe(400)
    expect(result.unknownReply.error).toBe('chat no soportado')
    expect(result.opencodeStatus).toBe(400)
    expect(result.opencodeReply.error).toBe(
      'OpenCode se usa como terminal en el tab Dev; el chat no lo ejecuta.',
    )
    expect(result.apiCalls).toBe(0)
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})
