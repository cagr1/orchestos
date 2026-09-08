import { expect, it } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

async function isolated(body: string): Promise<any> {
  const home = mkdtempSync(join(tmpdir(), 'orchestos-r5-test-'))
  try {
    const child = Bun.spawn(
      [
        process.execPath,
        '-e',
        `
      const { mkdirSync, writeFileSync, readFileSync } = await import('node:fs')
      const { join } = await import('node:path')
      const { db } = await import('./src/db/sqlite.ts')
      const { runMigrations } = await import('./src/db/migrate.ts')
      const { createChatSession } = await import('./src/db/chat-sessions.ts')
      const { handleApiChat } = await import('./src/dashboard/handlers/chat.ts')
      const { createTaskRecord } = await import('./src/dashboard/handlers/tasks.ts')
      const turns = await import('./src/db/chat-turns.ts')
      runMigrations()
      const home = process.env.ORCHESTOS_HOME
      const root = join(home, 'project')
      mkdirSync(root)
      mkdirSync(join(home, '.orchestos/cache'), { recursive: true })
      writeFileSync(join(home, '.orchestos/cache/models.json'), JSON.stringify({ fetchedAt: Date.now(), models: {
        'deepseek/deepseek-v4-flash': { contextLength: 64000, priceIn: 0, priceOut: 0, supportsTools: false, maxOutputTokens: 8192 }
      }}))
      writeFileSync(join(root, 'orchestos.config.yaml'), 'agent: api\\n')
      writeFileSync(join(root, 'tasks.yaml'), 'version: 1\\nproject: fixture\\ntasks: []\\n')
      writeFileSync(join(root, 'existing.txt'), 'unchanged')
      db.run('INSERT INTO projects (id,path,stack_profile,agents_md,last_updated) VALUES (?,?,?,?,?)', ['fixture', root, '{}', '', new Date().toISOString()])
      process.chdir(root)
      let calls = 0
      let isTask = false
      let beforeResponse = () => {}
      globalThis.fetch = async (url, init) => {
        if (String(url).includes('11434')) return new Response('{}', { status: 503 })
        const payload = JSON.parse(init.body)
        const system = payload.messages.find(m => m.role === 'system')?.content || ''
        calls++
        const content = system.includes('skill_candidates')
          ? JSON.stringify({ id: 'draft-id', description: 'Modify existing fixture', output: ['existing.txt'], executor: 'openrouter', skill_candidates: [] })
          : system.includes('isTask') ? JSON.stringify({ isTask, reason: 'fixture' }) : 'fixture response'
        if (content === 'fixture response') await beforeResponse()
        return new Response(JSON.stringify({ choices: [{ message: { content } }], usage: { prompt_tokens: 1, completion_tokens: 1 } }))
      }
      const session = createChatSession({ projectId: 'fixture', agent: 'api', mode: 'code' })
      const request = key => handleApiChat(new Request('http://localhost/api/chat', { method: 'POST', body: JSON.stringify({ sessionId: session.id, message: 'fixture request', requestKey: key }) }))
      ${body}
      db.close()
    `,
      ],
      {
        env: { ...process.env, ORCHESTOS_HOME: home, OPENROUTER_API_KEY: 'test-key' },
        stdout: 'pipe',
        stderr: 'pipe',
      },
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

it('rejects concurrent HTTP requests and replays committed results without provider calls', async () => {
  const result = await isolated(`
    let entered, release
    const waiting = new Promise(resolve => entered = resolve)
    const blocker = new Promise(resolve => release = resolve)
    beforeResponse = async () => { entered(); await blocker }
    const first = request('first')
    await waiting
    const duplicate = await request('first')
    const other = await request('other')
    const before = calls
    release()
    const response = await first
    const payload = await response.json()
    const replay = await request('first')
    console.log(JSON.stringify({ statuses: [response.status, duplicate.status, other.status, replay.status], before, after: calls, same: JSON.stringify(payload) === JSON.stringify(await replay.json()), turns: db.query('SELECT COUNT(*) AS n FROM chat_turns').get().n }))
  `)
  expect(result.statuses).toEqual([200, 409, 409, 200])
  expect(result.after).toBe(result.before)
  expect(result.same).toBe(true)
  expect(result.turns).toBe(1)
})

it('returns an HTTP error and rolls back run/messages when the final write fails', async () => {
  const result = await isolated(`
    db.exec("CREATE TRIGGER fail_messages BEFORE INSERT ON chat_messages BEGIN SELECT RAISE(ABORT, 'injected message failure'); END")
    const response = await request('rollback')
    console.log(JSON.stringify({ status: response.status, runs: db.query('SELECT COUNT(*) AS n FROM runs').get().n, messages: db.query('SELECT COUNT(*) AS n FROM chat_messages').get().n }))
  `)
  expect(result.status).toBeGreaterThanOrEqual(500)
  expect(result.runs).toBe(0)
  expect(result.messages).toBe(0)
})

it('reserves before YAML creation and never renames a colliding reservation', async () => {
  const result = await isolated(`
    isTask = true
    const before = readFileSync(join(root, 'tasks.yaml'), 'utf8')
    db.exec("CREATE TRIGGER fail_reservation BEFORE UPDATE OF task_id ON chat_turns BEGIN SELECT RAISE(ABORT, 'injected reservation failure'); END")
    const response = await request('reserve-fails')
    const payload = await response.json()
    const unchanged = before === readFileSync(join(root, 'tasks.yaml'), 'utf8')
    db.exec('DROP TRIGGER fail_reservation')
    const response2 = await request('reserve-works')
    const payload2 = await response2.json()
    const turn = turns.getTurnByRequestKey(session.id, 'reserve-works')
    const yaml = readFileSync(join(root, 'tasks.yaml'), 'utf8')
    const collision = createTaskRecord(root, { id: turn.task_id, description: 'duplicate', output: ['existing.txt'] }, { reservedId: true })
    db.run('UPDATE chat_turns SET status = ?, owner_expires_at = ? WHERE id = ?', ['pending', '2000-01-01', turn.id])
    const beforeRetry = calls
    const retry = await request('reserve-works')
    console.log(JSON.stringify({ unchanged, failure: payload.autoTask, held: payload2.autoTask, reserved: turn.task_id, collision, sameYaml: yaml === readFileSync(join(root, 'tasks.yaml'), 'utf8'), retryStatus: retry.status, noCalls: calls === beforeRetry }))
  `)
  expect(result.unchanged).toBe(true)
  expect(result.failure.error).toContain('injected reservation failure')
  expect(result.held).toMatchObject({ id: result.reserved, held: true })
  expect(result.collision.status).toBe(409)
  expect(result.sameYaml).toBe(true)
  expect(result.retryStatus).toBe(409)
  expect(result.noCalls).toBe(true)
})
