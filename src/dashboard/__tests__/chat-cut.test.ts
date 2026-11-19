import { expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('Dev cut persists the command, expands only the CLI prompt and appends reports on success/error; general Chat stays unchanged', async () => {
  const home = mkdtempSync(join(tmpdir(), 'chat-cut-'))
  try {
    const child = Bun.spawn(
      [
        process.execPath,
        '-e',
        String.raw`
      const assert = (await import('node:assert/strict')).default
      const { mock } = await import('bun:test')
      const { mkdirSync, realpathSync, writeFileSync } = await import('node:fs')
      const { join } = await import('node:path')
      const { runMigrations } = await import('./src/db/migrate.ts')
      const { db } = await import('./src/db/sqlite.ts')
      const { createChatSession, listChatMessages, setClaudeChatSession } = await import('./src/db/chat-sessions.ts')
      const { cliChatAdapterFor } = await import('./src/run/executors/chat-adapters.ts')
      const { readCliModelCatalogsCached } = await import('./src/dashboard/chat-cli-models.ts')
      const { uninstrumentedReadAudit } = await import('./src/run/read-audit.ts')
      const { cutPrompt } = await import('./src/chat/cut-prompt.ts')
      await readCliModelCatalogsCached({ read: async () => [] })
      const checks = []
      let capturedBase = false
      mock.module('./src/dashboard/cut-check.ts', () => ({ cutBaseHead(root) {
        capturedBase = true
        return 'base-head'
      }, cutCheck(root, cliSessionId, options) {
        checks.push({root, cliSessionId, reply: options.reply, baseHead: options.baseHead})
        return { baseHead: options.baseHead, dirty: [], dirtyTotal: 0, branch: 'main', upstream: 'origin/main', ahead: 0, behind: 0, lock: 'none', handoff: 'next steps' }
      }}))
      const { handleApiChat } = await import('./src/dashboard/handlers/chat.ts')
      const { handleApiChatSessionMessages, handleApiChatSessionsList } = await import('./src/dashboard/handlers/chat-sessions.ts')
      runMigrations()
      const root = join(process.env.ORCHESTOS_HOME, 'project')
      mkdirSync(root)
      writeFileSync(join(root, 'orchestos.config.yaml'), 'roles:\n  orchestrator: { agent: codex, model: fixture }\n')
      db.run('INSERT INTO projects (id,path,stack_profile,agents_md,last_updated) VALUES (?,?,?,?,?)', ['fixture', root, '{}', '', new Date().toISOString()])
      const inputs = []
      let fail = false
      for (const cli of ['codex', 'claude']) {
        const adapter = cliChatAdapterFor(cli)
        adapter.validateModel = () => null
        adapter.runTurn = async input => {
          inputs.push(input)
          if (input.message !== '/cut') assert.equal(capturedBase, true, 'capture HEAD before starting the CLI')
          if (fail) throw new Error('fixture failure')
          return { text: '## Handoff\nnext steps', resultLabel: 'fixture', inputTokens: 1, outputTokens: 1, readAudit: uninstrumentedReadAudit() }
        }
      }
      const post = (session, requestKey) => new Request('http://localhost/api/chat?project=' + (session.project_id ?? 'none'), {
        method: 'POST', body: JSON.stringify({ sessionId: session.id, message: ' /cut ', agent: session.agent, model: 'fixture', requestKey }),
      })
      for (const cli of ['codex', 'claude']) {
        const session = createChatSession({ projectId: 'fixture', agent: cli, mode: 'code' })
        if (cli === 'claude') setClaudeChatSession(session.id, 'native-id', 'context', 0)
        const response = await handleApiChat(post(session, 'success'))
        assert.equal(response.status, 200, JSON.stringify(await response.json()))
        assert.equal(inputs.at(-1).message, cutPrompt({ hasNextMd: false }))
        assert.equal(inputs.at(-1).cut, true)
        assert.ok(inputs.at(-1).system.includes('Do not create tasks in this turn'))
        assert.ok(inputs.at(-1).system.includes('git commit and git push'))
        assert.ok(!inputs.at(-1).system.includes('create_task'))
        const messages = listChatMessages(session.id)
        assert.equal(messages[0].content, '/cut')
        assert.equal(messages.at(-1).cutReport.handoff, 'next steps')
        assert.equal(messages.at(-1).cutReport.baseHead, 'base-head')
        assert.equal(messages.at(-1).model, messages.at(-2).model)
        const sessions = handleApiChatSessionsList(new Request('http://localhost/api/chat/sessions?project=fixture'))
        assert.equal((await sessions.json()).find(row => row.id === session.id).lastModel, 'fixture')
        assert.equal(checks.at(-1).root, realpathSync(root))
        assert.equal(checks.at(-1).cliSessionId, cli === 'claude' ? 'native-id' : undefined)
        assert.equal(checks.at(-1).reply, '## Handoff\nnext steps')
        assert.equal(checks.at(-1).baseHead, 'base-head')
        capturedBase = false
        const timeline = await handleApiChatSessionMessages(new URL('http://localhost/api/chat/sessions/' + session.id + '/messages?project=fixture'), post(session, 'read'))
        assert.equal((await timeline.json()).at(-1).cutReport.handoff, 'next steps')
        const checkCount = checks.length
        await handleApiChat(post(session, 'success'))
        assert.equal(checks.length, checkCount, 'replays must not check or release locks twice')
      }
      writeFileSync(join(root, 'NEXT.md'), '# Next')
      const nextSession = createChatSession({ projectId: 'fixture', agent: 'codex', mode: 'code' })
      await handleApiChat(post(nextSession, 'next'))
      assert.equal(inputs.at(-1).message, cutPrompt({ hasNextMd: true }))
      fail = true
      const failed = createChatSession({ projectId: 'fixture', agent: 'codex', mode: 'code' })
      await handleApiChat(post(failed, 'failure'))
      assert.equal(listChatMessages(failed.id).at(-1).cutReport.branch, 'main')
      fail = false
      const general = createChatSession({ projectId: null, agent: 'codex' })
      const checkCount = checks.length
      await handleApiChat(post(general, 'general'))
      assert.equal(inputs.at(-1).message, '/cut')
      assert.equal(inputs.at(-1).cut, false)
      assert.equal(checks.length, checkCount)
      assert.equal(listChatMessages(general.id).some(row => row.cutReport), false)
      db.close()
      console.log('CMD.3 handler assertions passed')
    `,
      ],
      {
        cwd: process.cwd(),
        env: { ...process.env, HOME: home, ORCHESTOS_HOME: home, ORCHESTOS_CLAUDE_USAGE_LIVE: '0' },
        stdout: 'pipe',
        stderr: 'pipe',
      },
    )
    const [stdout, stderr, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ])
    expect(code, stderr + stdout).toBe(0)
    expect(stdout).toContain('CMD.3 handler assertions passed')
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})
