import { expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('USO.10 general and unscoped turns isolate CLI/API cwd and use global config', async () => {
  const home = mkdtempSync(join(tmpdir(), 'chat-general-test-'))
  mkdirSync(join(home, '.orchestos', 'cache'), { recursive: true })
  writeFileSync(
    join(home, '.orchestos', 'cache', 'models.json'),
    JSON.stringify({ schemaVersion: 2, fetchedAt: Date.now(), models: {} }),
  )
  try {
    const child = Bun.spawn(
      [
        process.execPath,
        '-e',
        String.raw`
      const assert = (await import('node:assert/strict')).default
      const { mock } = await import('bun:test')
      const { mkdirSync, writeFileSync, readFileSync, existsSync, realpathSync } = await import('node:fs')
      const { join } = await import('node:path')
      const { orchestosDir } = await import('./src/config/orchestos-home.ts')
      const { runMigrations } = await import('./src/db/migrate.ts')
      const { db } = await import('./src/db/sqlite.ts')
      const { createChatSession } = await import('./src/db/chat-sessions.ts')
      const { chatDirectory } = await import('./src/chat/documents.ts')
      const { cliChatAdapterFor } = await import('./src/run/executors/chat-adapters.ts')
      const { readCliModelCatalogsCached } = await import('./src/dashboard/chat-cli-models.ts')
      const { uninstrumentedReadAudit } = await import('./src/run/read-audit.ts')
      await readCliModelCatalogsCached({ read: async () => [] })
      const roleRunner = await import('./src/router/role-runner.ts')
      const apiInputs = []
      mock.module('./src/router/role-runner.ts', () => ({ ...roleRunner,
        clientFromAssignment: (role, assignment, options) => {
          apiInputs.push({ assignment, cwd: options.cwd, exists: existsSync(options.cwd) })
          return { provider: { chat: async input => {
            apiInputs.at(-1).system = input.system
            return { text: 'API general response', model: assignment.model, inputTokens: 1, outputTokens: 1 }
          } } }
        }
      }))
      const { handleApiChat } = await import('./src/dashboard/handlers/chat.ts')
      const { handleApiChatSessionsCreate, handleApiChatSessionExec, handleApiChatSessionMessages } = await import('./src/dashboard/handlers/chat-sessions.ts')
      const { handleApiConfigGet } = await import('./src/dashboard/handlers/config.ts')
      const { requestScope } = await import('./src/dashboard/ownership.ts')
      runMigrations()
      const root = join(process.env.ORCHESTOS_HOME, 'startup-project')
      mkdirSync(root)
      writeFileSync(join(root, 'orchestos.config.yaml'), 'roles:\n  orchestrator: { agent: opencode, model: forbidden/project-model }\n')
      const tasks = 'version: 1\nproject: fixture\ntasks: []\n'
      writeFileSync(join(root, 'tasks.yaml'), tasks)
      db.run('INSERT INTO projects (id,path,stack_profile,agents_md,last_updated) VALUES (?,?,?,?,?)', ['fixture', root, '{}', '', new Date().toISOString()])
      process.chdir(root)
      const configPath = join(orchestosDir(), 'config.yaml')
      writeFileSync(configPath, 'roles:\n  orchestrator: { agent: codex, model: gpt-6-luna }\n')
      const cliInputs = []
      cliChatAdapterFor('codex').runTurn = async input => {
        cliInputs.push({ cwd: input.cwd, exists: existsSync(input.cwd), context: input.hasProjectContext, tools: input.mcpOffer, system: input.system, general: input.generalChat })
        if (input.generalChat) writeFileSync(join(input.cwd, 'report.md'), '# Delivered document')
        input.onStep({ type: 'tool_use', label: 'mcp__orchestos__open_in_dev', detail: '{}' })
        input.onStep({ type: 'tool_use', label: 'mcp__orchestos__create_task', detail: JSON.stringify({ description: 'Must not execute', outputs: ['leaked.txt'] }) })
        return { text: 'Use Dev for project files', resultLabel: 'fixture', inputTokens: 1, outputTokens: 1, readAudit: uninstrumentedReadAudit() }
      }
      const general = createChatSession({ projectId: null, agent: 'codex', mode: 'code' })
      const project = createChatSession({ projectId: 'fixture', agent: 'codex', mode: 'code' })
      const post = (sessionId, scope = '') => new Request('http://localhost/api/chat' + scope, { method: 'POST', body: JSON.stringify({ sessionId, message: 'Create leaked.txt in the project' }) })
      for (const request of [post(general.id, '?project=fixture'), post(project.id), post(undefined)]) {
        const response = await handleApiChat(request, { id: 'fixture', root, source: 'legacy-cwd' })
        assert.equal(response.status, 200, JSON.stringify(await response.json()))
      }
      // The unscoped request without a session has no persisted turn.
      assert.equal(db.query("SELECT COUNT(*) AS count FROM chat_turn_steps WHERE tool = 'mcp__orchestos__open_in_dev'").get().count, 2)
      assert.equal(readFileSync(join(root, 'tasks.yaml'), 'utf8'), tasks)
      assert.equal(existsSync(join(root, 'leaked.txt')), false)
      assert.deepEqual(requestScope(post(project.id), false), { kind: 'none' })
      const create = await handleApiChatSessionsCreate(new Request('http://localhost/api/chat/sessions', { method: 'POST', body: JSON.stringify({ agent: 'api' }) }), { id: 'fixture', root, source: 'legacy-cwd' })
      assert.equal((await create.json()).projectId, null)
      const execUrl = new URL('http://localhost/api/chat/sessions/' + project.id + '/exec')
      const denied = await handleApiChatSessionExec(new Request(execUrl, { method: 'POST', body: JSON.stringify({ cmd: 'touch leaked.txt' }) }), execUrl)
      assert.equal(denied.status, 403)
      writeFileSync(configPath, 'roles:\n  orchestrator: { agent: api, provider: openrouter, model: general/model }\n')
      const config = await (await handleApiConfigGet(null)).json()
      assert.equal(config.roleAssignments.orchestrator.model, 'general/model')
      assert.deepEqual(config.pendingRouting, [])
      const apiSession = createChatSession({ projectId: null, agent: 'api' })
      const response = await handleApiChat(post(apiSession.id))
      assert.equal(response.status, 200, JSON.stringify(await response.json()))
      for (const input of [...cliInputs, ...apiInputs]) {
        assert.notEqual(input.cwd, root)
        assert.ok(input.exists)
        if (input.cwd.includes('orchestos-chat-')) assert.equal(existsSync(input.cwd), false)
        else {
          assert.ok(input.cwd.startsWith(realpathSync(join(orchestosDir(), 'chats'))))
          assert.equal(existsSync(input.cwd), true)
        }
        assert.equal(input.system.includes(root), false)
        assert.ok(input.system.includes('must be done in Dev'))
      }
      for (const input of cliInputs) {
        assert.equal(input.context, false)
        assert.deepEqual(input.tools.tools, ['open_in_dev'])
        assert.equal(input.tools.root, input.cwd)
      }
      assert.equal(cliInputs[0].cwd, chatDirectory(general.id))
      assert.ok(cliInputs[0].system.includes('search and read the web'))
      assert.ok(cliInputs[0].system.includes('create or edit documents'))
      const rows = await handleApiChatSessionMessages(new URL('http://localhost/api/chat/sessions/' + general.id + '/messages')).json()
      assert.deepEqual(rows.at(-1).documents, [{ name: 'report.md', path: 'report.md', size: 20 }])
      assert.equal(apiInputs[0].assignment.model, 'general/model')
      assert.equal(readFileSync(join(root, 'tasks.yaml'), 'utf8'), tasks)
      console.log(JSON.stringify({ cliTurns: cliInputs.length, apiTurns: apiInputs.length, isolationAndPersistence: true, globalConfig: true, noTasks: true, execDenied: denied.status }))
      db.close()
      `,
      ],
      {
        env: { ...process.env, ORCHESTOS_HOME: home, ORCHESTOS_CLAUDE_USAGE_LIVE: '0' },
        stdout: 'pipe',
        stderr: 'pipe',
      },
    )
    const [code, stdout, stderr] = await Promise.all([
      child.exited,
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
    ])
    expect(code, stderr).toBe(0)
    expect(JSON.parse(stdout)).toEqual({
      cliTurns: 3,
      apiTurns: 1,
      isolationAndPersistence: true,
      globalConfig: true,
      noTasks: true,
      execDenied: 403,
    })
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
}, 30_000)
