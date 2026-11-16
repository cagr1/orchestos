import { expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/** Runs `script` in a fresh Bun with ORCHESTOS_HOME, `orchestrator` as the global role and Ollama mocked. */
async function runLocalChat(orchestrator: string, script: string): Promise<unknown> {
  const home = mkdtempSync(join(tmpdir(), 'chat-local-test-'))
  mkdirSync(join(home, '.orchestos', 'cache'), { recursive: true })
  writeFileSync(
    join(home, '.orchestos', 'cache', 'models.json'),
    JSON.stringify({ schemaVersion: 2, fetchedAt: Date.now(), models: {} }),
  )
  writeFileSync(
    join(home, '.orchestos', 'config.yaml'),
    `roles:\n  orchestrator: ${orchestrator}\n`,
  )
  try {
    const child = Bun.spawn(
      [
        process.execPath,
        '-e',
        String.raw`
      const assert = (await import('node:assert/strict')).default
      const { mock } = await import('bun:test')
      const { runMigrations } = await import('./src/db/migrate.ts')
      const { db } = await import('./src/db/sqlite.ts')
      const { createChatSession, listChatMessages } = await import('./src/db/chat-sessions.ts')
      const { getLastTurn } = await import('./src/db/chat-turns.ts')
      const { listChatTurnSteps } = await import('./src/db/chat-turn-steps.ts')
      const { readCliModelCatalogsCached } = await import('./src/dashboard/chat-cli-models.ts')
      await readCliModelCatalogsCached({ read: async () => [] })
      const calls = []
      const ollama = { first: 'ollama/test-model:1b', error: null }
      mock.module('./src/dashboard/llm/clients.ts', () => ({
        firstOllamaModel: async () => ollama.first,
        ollamaChat: async (opts) => {
          calls.push(opts.model)
          if (ollama.error) throw new Error(ollama.error)
          return { text: 'LOCAL', model: 'ollama/' + opts.model }
        },
      }))
      const defaultAgent = await import('./src/dashboard/default-chat-agent.ts')
      const resolveError = defaultAgent.resolveChatErrorMessage
      mock.module('./src/dashboard/default-chat-agent.ts', () => ({
        ...defaultAgent,
        resolveChatErrorMessage: (message) => resolveError(message, {
          detect: () => [], health: async () => [], key: () => undefined,
        }),
      }))
      const { handleApiChat } = await import('./src/dashboard/handlers/chat.ts')
      runMigrations()
      const send = async (sessionId, extra = {}, expectedStatus = 200) => {
        const response = await handleApiChat(
          new Request('http://localhost/api/chat', {
            method: 'POST',
            body: JSON.stringify({ sessionId, message: 'hola', ...extra }),
          }),
        )
        assert.equal(response.status, expectedStatus, JSON.stringify(await response.clone().json()))
        return response
      }
      ${script}
      console.log(JSON.stringify({ calls }))
      db.close()
      `,
      ],
      {
        env: {
          ...process.env,
          ORCHESTOS_HOME: home,
          ORCHESTOS_CLAUDE_USAGE_LIVE: '0',
          OPENROUTER_API_KEY: '',
        },
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
    return JSON.parse(stdout.trim().split('\n').at(-1) ?? '{}')
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
}

test('WIN.13 — a local chat without a model uses the first Ollama model, even with a CLI orchestrator', async () => {
  const result = await runLocalChat(
    '{ agent: claude, model: claude-opus-5-5 }',
    String.raw`
      const session = createChatSession({ projectId: null, agent: 'local' })
      await send(session.id, { agent: 'local' })
      // An identical retry (same requestKey) returns the saved turn even if Ollama's first model changed.
      await send(session.id, { agent: 'local', requestKey: 'k1' })
      ollama.first = 'ollama/other-model:2b'
      await send(session.id, { agent: 'local', requestKey: 'k1' })
      // A session that already used a model keeps it when a later message omits the model.
      const chosen = createChatSession({ projectId: null, agent: 'local' })
      await send(chosen.id, { agent: 'local', model: 'ollama/chosen:4b' })
      await send(chosen.id)
    `,
  )
  expect(result).toEqual({
    calls: ['test-model:1b', 'test-model:1b', 'chosen:4b', 'chosen:4b'],
  })
}, 30_000)

test('USO.18 — an unreachable Ollama returns and persists a network notice and two messages', async () => {
  const result = await runLocalChat(
    '{ agent: claude, model: claude-opus-5-5 }',
    String.raw`
      const session = createChatSession({ projectId: null, agent: 'local' })
      ollama.error = 'Unable to connect. Is the computer able to access the url?'
      const response = await send(session.id, { agent: 'local' }, 502)
      const body = await response.json()
      assert.equal(body.notice.kind, 'network')
      assert.equal(body.error, body.notice.message)
      assert.match(body.notice.message, /Ollama/)
      assert.match(body.notice.detail, /ollama\/test-model:1b/)
      assert.ok(body.notice.detail.includes(ollama.error))
      assert.match(body.notice.detail, /Check that Ollama is running/)
      const turn = getLastTurn(session.id)
      assert.equal(turn.status, 'failed')
      assert.equal(turn.error, body.error)
      const steps = listChatTurnSteps(session.id)
      assert.equal(steps.length, 1)
      assert.equal(steps[0].turn_id, turn.id)
      assert.equal(steps[0].type, 'notice')
      assert.deepEqual(JSON.parse(steps[0].detail), body.notice)
      const messages = listChatMessages(session.id)
      assert.equal(messages.length, 2)
      assert.deepEqual(messages.map(m => m.role), ['user', 'assistant'])
      assert.equal(messages[0].content, 'hola')
      assert.equal(messages[1].content, '')
      assert.ok(messages.every(m => m.turn_id === turn.id))
    `,
  )
  expect(result).toEqual({ calls: ['test-model:1b'] })
}, 30_000)

test('USO.18 — a missing OpenRouter key retains its setup notice', async () => {
  const result = await runLocalChat(
    '{ agent: api, model: anthropic/claude-sonnet-5 }',
    String.raw`
      const session = createChatSession({ projectId: null, agent: 'api' })
      const response = await send(session.id, { agent: 'api', model: 'anthropic/claude-sonnet-5' }, 502)
      const body = await response.json()
      assert.equal(body.error, body.notice.message)
      assert.match(body.notice.message, /Sign in to a CLI or add the key/)
      assert.equal(getLastTurn(session.id).status, 'failed')
      assert.deepEqual(JSON.parse(listChatTurnSteps(session.id)[0].detail), body.notice)
    `,
  )
  expect(result).toEqual({ calls: [] })
}, 30_000)
