import { expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { db } from '../../db/sqlite.ts'
import { handleApiUsage } from '../handlers/usage.ts'
import { route } from '../server.ts'

// The suite preload sets ORCHESTOS_HOME before the DB is imported.
test('otra ruta responde en menos de 200 ms durante el parseo grande de /api/usage', async () => {
  expect(process.env.ORCHESTOS_HOME).toBeTruthy()
  const base = mkdtempSync(join(tmpdir(), 'usage-responsive-'))
  const root = join(base, 'project')
  const agentHome = join(base, 'agent-home')
  mkdirSync(root)
  const dir = join(
    agentHome,
    '.claude',
    'projects',
    realpathSync(root).replace(/[^a-zA-Z0-9]/g, '-'),
  )
  mkdirSync(dir, { recursive: true })
  const id = `usage-responsive-${Date.now()}`
  const record = JSON.stringify({
    type: 'assistant',
    sessionId: id,
    timestamp: '2026-10-26T10:00:00Z',
    message: { id: 'same-message', model: 'unpriced-fixture', usage: { input_tokens: 7 } },
  })
  // Duplicate messages force real JSON parsing but keep the response tiny.
  writeFileSync(join(dir, 'large.jsonl'), `${record}\n`.repeat(750_000))
  db.run(
    "INSERT INTO projects (id, path, stack_profile, agents_md, last_updated) VALUES (?, ?, '{}', '', ?)",
    [id, root, new Date().toISOString()],
  )
  let started = false
  let finished = false
  let server: ReturnType<typeof Bun.serve> | undefined
  let usage: Promise<Response> | undefined
  try {
    server = Bun.serve({
      hostname: '127.0.0.1',
      port: 0,
      async fetch(req, server) {
        if (new URL(req.url).pathname === '/api/usage') {
          started = true
          try {
            return await handleApiUsage(agentHome)
          } finally {
            finished = true
          }
        }
        return route(req, server.port ?? 0)
      },
    })
    usage = fetch(new URL('/api/usage', server.url))
    while (!started) await Bun.sleep(1)
    await Bun.sleep(50)
    expect(finished).toBe(false)
    const start = performance.now()
    const response = await fetch(new URL('/api/projects', server.url))
    await response.json()
    const elapsed = performance.now() - start
    console.log(`SET.0 concurrent GET /api/projects: ${elapsed.toFixed(2)} ms`)
    expect(response.status).toBe(200)
    expect(elapsed).toBeLessThan(200)
    expect(finished).toBe(false)
    const body = await (await usage).json()
    expect(
      body.byDayModel.find((row: { model: string }) => row.model === 'unpriced-fixture'),
    ).toEqual({
      date: '2026-10-26',
      model: 'unpriced-fixture',
      provider: 'claude',
      source: 'cli',
      usd: null,
      priced: false,
      runs: 1,
      inputTokens: 7,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    })
    expect(body.totals.cli).toEqual({ usd: 0, sessions: 1, tokens: 7, unpricedSessions: 1 })
    expect(await (await fetch(new URL('/api/usage', server.url))).json()).toEqual(body)
  } finally {
    await usage?.catch(() => {})
    await server?.stop(true)
    db.run('DELETE FROM projects WHERE id = ?', [id])
    rmSync(base, { recursive: true, force: true })
  }
}, 20_000)
