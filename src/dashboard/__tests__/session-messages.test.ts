import { expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('MSG.1 API turn collects first valid proposal, rejects bad destinations, and consumes inbound only on success', async () => {
  const home = mkdtempSync(join(tmpdir(), 'orchestos-message-test-'))
  mkdirSync(join(home, '.orchestos/cache'), { recursive: true })
  writeFileSync(
    join(home, '.orchestos/cache/models.json'),
    JSON.stringify({
      schemaVersion: 2,
      fetchedAt: Date.now(),
      models: {
        'test/model': {
          contextLength: 64000,
          priceIn: 0,
          priceOut: 0,
          supportsTools: true,
          supportsReasoning: false,
          maxOutputTokens: 8192,
        },
      },
    }),
  )
  writeFileSync(
    join(home, 'orchestos.config.yaml'),
    'roles:\n  orchestrator: { agent: api, model: test/model, provider: openrouter }\n  auxiliary: { agent: api, model: test/model, provider: openrouter }\n',
  )
  try {
    const proc = Bun.spawn(
      [
        'bun',
        '-e',
        String.raw`
      import assert from 'node:assert/strict'
      import { runMigrations } from './src/db/migrate.ts'
      import { db } from './src/db/sqlite.ts'
      import { createChatSession, archiveChatSession, listChatMessages } from './src/db/chat-sessions.ts'
      import { listSessionMessagesForTurn, listUnconsumedInbound, approveSessionMessage } from './src/db/session-messages.ts'
      import { listChatTurnSteps } from './src/db/chat-turn-steps.ts'
      import { listChatTurns } from './src/db/chat-turns.ts'
      import { decideClaudeResume } from './src/chat/claude-resume.ts'
      import { handleApiChat } from './src/dashboard/handlers/chat.ts'
      import { handleApiChatSessionTimeline } from './src/dashboard/handlers/chat-sessions.ts'
      import { readCliModelCatalogsCached } from './src/dashboard/chat-cli-models.ts'
      await readCliModelCatalogsCached({ read: async () => [] })
      runMigrations()
      const root = process.env.ORCHESTOS_HOME
      for (const id of ['p', 'other']) db.run('INSERT INTO projects (id,path,stack_profile,agents_md,last_updated) VALUES (?,?,?,?,?)', [id, root + (id === 'other' ? '/other' : ''), '{}', '', new Date().toISOString()])
      const a = createChatSession({ projectId: 'p', agent: 'api', title: 'A' })
      const b = createChatSession({ projectId: 'p', agent: 'api', title: 'B' })
      const archived = createChatSession({ projectId: 'p', agent: 'api' })
      archiveChatSession(archived.id)
      const other = createChatSession({ projectId: 'other', agent: 'api' })
      let proposals = []
      let fail = false
      let abort = null
      let requests = []
      globalThis.fetch = async (_url, init) => {
        const body = JSON.parse(init.body)
        requests.push(body)
        if (abort) { abort.abort(); throw new Error('stopped') }
        if (fail) throw new Error('provider failure')
        const toolCalls = proposals.map((input, i) => ({ id: 'call-' + i, type: 'function', function: { name: 'message_session', arguments: JSON.stringify(input) } }))
        proposals = []
        return new Response(JSON.stringify({ choices: [{ message: toolCalls.length ? { content: null, tool_calls: toolCalls } : { content: 'ok' } }], model: 'test/model', usage: { prompt_tokens: 10, completion_tokens: 2 } }))
      }
      const send = async (session, signal) => {
        const response = await handleApiChat(new Request('http://localhost/api/chat?project=p', { method: 'POST', headers: { 'x-orchestos-project-id': 'p' }, body: JSON.stringify({ sessionId: session.id, message: 'original', requestKey: crypto.randomUUID() }), signal }))
        const payload = await response.json()
        return { response, payload }
      }
      for (const target of [a.id, archived.id, other.id, 'missing']) {
        proposals = [{ session_id: target, content: 'review' }]
        const { response, payload } = await send(a)
        assert.equal(response.status, 200, JSON.stringify(payload))
        const turn = listChatTurns(a.id).at(-1)
        assert.equal(listSessionMessagesForTurn(turn.id).length, 0)
        assert.ok(listChatTurnSteps(a.id).some(step => step.turn_id === turn.id && step.type === 'notice' && step.detail.includes('Message not proposed:')))
      }
      proposals = [{ session_id: a.id, content: 'invalid' }, { session_id: b.id, content: 'first valid' }, { session_id: b.id, content: 'ignored' }]
      const sent = await send(a)
      assert.equal(sent.response.status, 200, JSON.stringify(sent.payload))
      const turn = listChatTurns(a.id).at(-1)
      const rows = listSessionMessagesForTurn(turn.id)
      assert.equal(rows.length, 1)
      assert.equal(rows[0].content, 'first valid')
      const historyLength = listChatMessages(b.id).length
      const stored = { sessionId: 'claude-resume', contextHash: 'hash', messageCount: historyLength }
      approveSessionMessage(rows[0].id)
      assert.equal(listChatMessages(b.id).length, historyLength)
      assert.equal(decideClaudeResume({ hasSession: true, hasProjectContext: true, stored, historyLength: listChatMessages(b.id).length, contextHash: 'hash' }).resume, 'claude-resume')
      assert.equal(listChatTurns(b.id).length, 0)
      let timeline = await handleApiChatSessionTimeline(new URL('http://localhost/api/chat/sessions/' + b.id + '/timeline')).json()
      assert.ok(timeline.events.some(row => row.kind === 'session-message' && row.content === 'first valid' && !row.consumed))
      fail = true
      const failed = await send(b)
      assert.ok(failed.response.status >= 400)
      assert.equal(listUnconsumedInbound(b.id).length, 1)
      fail = false
      abort = new AbortController()
      try { await send(b, abort.signal) } catch {}
      assert.equal(listUnconsumedInbound(b.id).length, 1)
      abort = null
      requests = []
      const done = await send(b)
      assert.equal(done.response.status, 200, JSON.stringify(done.payload))
      const delivered = requests[0].messages.at(-1).content
      assert.ok(delivered.startsWith('Messages delivered from other sessions'))
      assert.ok(delivered.includes('<untrusted-data source="session-message:A">\nfirst valid\n</untrusted-data>'))
      assert.ok(delivered.endsWith('original'))
      assert.equal(listUnconsumedInbound(b.id).length, 0)
      assert.equal(listChatMessages(b.id).filter(row => row.role === 'user').at(-1).content, 'original')
      timeline = await handleApiChatSessionTimeline(new URL('http://localhost/api/chat/sessions/' + b.id + '/timeline')).json()
      assert.ok(timeline.events.some(row => row.kind === 'session-message' && row.consumed))
      const origin = await handleApiChatSessionTimeline(new URL('http://localhost/api/chat/sessions/' + a.id + '/timeline')).json()
      assert.equal(origin.messages.find(row => row.turnId === turn.id && row.role === 'assistant').sessionMessage.status, 'approved')
      console.log('MSG.1 handler assertions passed')
      db.close()
    `,
      ],
      {
        env: {
          ...process.env,
          ORCHESTOS_HOME: home,
          OPENROUTER_API_KEY: 'test-key',
          ORCHESTOS_CLAUDE_USAGE_LIVE: '0',
        },
        stdout: 'pipe',
        stderr: 'pipe',
      },
    )
    const [code, out, err] = await Promise.all([
      proc.exited,
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ])
    expect(code, out + err).toBe(0)
    expect(out).toContain('MSG.1 handler assertions passed')
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
}, 20000)
