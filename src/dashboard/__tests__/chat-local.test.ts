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
      const { createChatSession } = await import('./src/db/chat-sessions.ts')
      const { readCliModelCatalogsCached } = await import('./src/dashboard/chat-cli-models.ts')
      await readCliModelCatalogsCached({ read: async () => [] })
      const calls = []
      const ollama = { first: 'ollama/test-model:1b' }
      mock.module('./src/dashboard/llm/clients.ts', () => ({
        firstOllamaModel: async () => ollama.first,
        ollamaChat: async (opts) => {
          calls.push(opts.model)
          return { text: 'LOCAL', model: 'ollama/' + opts.model }
        },
      }))
      const { handleApiChat } = await import('./src/dashboard/handlers/chat.ts')
      runMigrations()
      const send = async (sessionId, extra = {}) => {
        const response = await handleApiChat(
          new Request('http://localhost/api/chat', {
            method: 'POST',
            body: JSON.stringify({ sessionId, message: 'hola', ...extra }),
          }),
        )
        assert.equal(response.status, 200, JSON.stringify(await response.clone().json()))
      }
      ${script}
      console.log(JSON.stringify({ calls }))
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
