import { describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

async function runIsolated(body: string): Promise<Record<string, unknown>> {
  const home = mkdtempSync(join(tmpdir(), 'orchestos-chat-turns-'))
  try {
    const proc = Bun.spawn(['bun', '-e', body], {
      cwd: process.cwd(),
      env: { ...process.env, ORCHESTOS_HOME: home },
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

describe('R.5 — durable chat turns', () => {
  it('claims once, detects pending duplicates, and rejects a changed request', async () => {
    const result = await runIsolated(`
      const { runMigrations } = await import('./src/db/migrate.ts')
      const { createChatSession } = await import('./src/db/chat-sessions.ts')
      const { beginTurn } = await import('./src/db/chat-turns.ts')
      runMigrations()
      const session = createChatSession({ agent: 'api' })
      const input = { sessionId: session.id, projectId: null, requestKey: 'request-1', inputFingerprint: 'fingerprint-1', owner: 'worker-a' }
      const claimed = beginTurn(input)
      const duplicate = beginTurn(input)
      const conflict = beginTurn({ ...input, inputFingerprint: 'other-input' })
      process.stdout.write(JSON.stringify({ claimed, duplicate, conflict }))
    `)

    expect(result.claimed).toMatchObject({ kind: 'claimed', turn: { status: 'pending' } })
    expect(result.duplicate).toMatchObject({
      kind: 'duplicate-pending',
      turn: { status: 'pending' },
    })
    expect(result.conflict).toEqual({ kind: 'conflict' })
  })

  it('commits run, exchange and replay envelope as one completed result', async () => {
    const result = await runIsolated(`
      const { runMigrations } = await import('./src/db/migrate.ts')
      const { db } = await import('./src/db/sqlite.ts')
      const { createChatSession, listChatMessages } = await import('./src/db/chat-sessions.ts')
      const { beginTurn, commitTurnSuccess, getTurn, parseTurnEnvelope } = await import('./src/db/chat-turns.ts')
      runMigrations()
      const session = createChatSession({ agent: 'api' })
      const input = { sessionId: session.id, projectId: null, requestKey: 'request-success', inputFingerprint: 'fingerprint-success', owner: 'worker-a' }
      const started = beginTurn(input)
      const run = {
        project_id: null, prompt: 'hola', task_class: 'chat', model: 'test-model', provider: 'test',
        skill_id: null, task_id: null, allowed_outputs: null, files_attempted: null, files_authorized: null,
        files_blocked: null, snapshot_before: null, snapshot_after: null, qa_verdict: null, qa_reason: null,
        status: 'done', input_tokens: 1, output_tokens: 2, usd_cost: 0, elapsed_ms: 3, result: 'respuesta',
      }
      const committed = commitTurnSuccess({ turnId: started.turn.id, run, userContent: 'hola', assistantContent: 'respuesta', model: 'test-model', envelope: { content: 'respuesta' } })
      const turn = getTurn(started.turn.id)
      const replay = beginTurn(input)
      const runCount = db.query('SELECT COUNT(*) AS count FROM runs WHERE id = ?').get(committed.runId).count
      process.stdout.write(JSON.stringify({ committed, turn, messages: listChatMessages(session.id), replay, runCount, envelope: parseTurnEnvelope(turn) }))
    `)

    expect(result.turn).toMatchObject({
      status: 'completed',
      run_id: result.committed && expect.any(String),
    })
    expect(result.runCount).toBe(1)
    expect(result.messages).toEqual([
      expect.objectContaining({ role: 'user', content: 'hola' }),
      expect.objectContaining({ role: 'assistant', content: 'respuesta', model: 'test-model' }),
    ])
    expect(result.replay).toMatchObject({ kind: 'duplicate-result', turn: { status: 'completed' } })
    expect(result.envelope).toEqual({ content: 'respuesta' })
  })

  it('records a failed turn without inventing a run', async () => {
    const result = await runIsolated(`
      const { runMigrations } = await import('./src/db/migrate.ts')
      const { createChatSession } = await import('./src/db/chat-sessions.ts')
      const { beginTurn, commitTurnFailure, getTurn } = await import('./src/db/chat-turns.ts')
      runMigrations()
      const session = createChatSession({ agent: 'api' })
      const started = beginTurn({ sessionId: session.id, projectId: null, requestKey: 'request-failure', inputFingerprint: 'fingerprint-failure', owner: 'worker-a' })
      commitTurnFailure({ turnId: started.turn.id, error: 'provider unavailable' })
      process.stdout.write(JSON.stringify(getTurn(started.turn.id)))
    `)

    expect(result).toMatchObject({ status: 'failed', run_id: null, error: 'provider unavailable' })
  })

  it('reconciles and reclaims only expired work in the requested session', async () => {
    const result = await runIsolated(`
      const { randomUUID } = await import('crypto')
      const { runMigrations } = await import('./src/db/migrate.ts')
      const { db } = await import('./src/db/sqlite.ts')
      const { createChatSession } = await import('./src/db/chat-sessions.ts')
      const { beginTurn, getTurnByRequestKey } = await import('./src/db/chat-turns.ts')
      runMigrations()
      const first = createChatSession({ agent: 'api' })
      const other = createChatSession({ agent: 'api' })
      const expired = new Date(Date.now() - 1_000).toISOString()
      const now = new Date(Date.now() - 2_000).toISOString()
      for (const [sessionId, key] of [[first.id, 'expired-here'], [other.id, 'expired-there']]) {
        db.run('INSERT INTO chat_turns (id, session_id, project_id, request_key, input_fingerprint, status, owner, owner_expires_at, created_at, updated_at) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?)', [randomUUID(), sessionId, key, 'same-input', 'pending', 'dead-worker', expired, now, now])
      }
      const claimed = beginTurn({ sessionId: first.id, projectId: null, requestKey: 'expired-here', inputFingerprint: 'same-input', owner: 'new-worker' })
      const otherTurn = getTurnByRequestKey(other.id, 'expired-there')
      process.stdout.write(JSON.stringify({ claimed, otherTurn }))
    `)

    expect(result.claimed).toMatchObject({
      kind: 'claimed',
      turn: { status: 'pending', owner: 'new-worker' },
    })
    expect(result.otherTurn).toMatchObject({ status: 'pending', owner: 'dead-worker' })
  })

  it('rolls back run and messages when serializing the final envelope fails', async () => {
    const result = await runIsolated(`
      const { runMigrations } = await import('./src/db/migrate.ts')
      const { db } = await import('./src/db/sqlite.ts')
      const { createChatSession, listChatMessages } = await import('./src/db/chat-sessions.ts')
      const { beginTurn, commitTurnSuccess, getTurn } = await import('./src/db/chat-turns.ts')
      runMigrations()
      const session = createChatSession({ agent: 'api' })
      const started = beginTurn({ sessionId: session.id, projectId: null, requestKey: 'request-rollback', inputFingerprint: 'fingerprint-rollback', owner: 'worker-a' })
      const run = {
        project_id: null, prompt: 'hola', task_class: 'chat', model: 'test-model', provider: 'test',
        skill_id: null, task_id: null, allowed_outputs: null, files_attempted: null, files_authorized: null,
        files_blocked: null, snapshot_before: null, snapshot_after: null, qa_verdict: null, qa_reason: null,
        status: 'done', input_tokens: 0, output_tokens: 0, usd_cost: 0, elapsed_ms: 0, result: 'respuesta',
      }
      let error = ''
      try { commitTurnSuccess({ turnId: started.turn.id, run, userContent: 'hola', assistantContent: 'respuesta', envelope: { impossible: 1n } }) } catch (cause) { error = String(cause) }
      const runCount = db.query('SELECT COUNT(*) AS count FROM runs').get().count
      process.stdout.write(JSON.stringify({ error, runCount, messages: listChatMessages(session.id), turn: getTurn(started.turn.id) }))
    `)

    expect(result.error).toContain('BigInt')
    expect(result.runCount).toBe(0)
    expect(result.messages).toEqual([])
    expect(result.turn).toMatchObject({ status: 'pending', run_id: null })
  })

  // R.5 (decisión 8, hallazgo #7) — un turno reclamado dos veces (lease
  // vencido, mismo request_key) debe ver la tarea reservada en el primer
  // intento; el caller (chat.ts) usa esto para no crear una segunda tarea.
  it('a reclaimed turn carries its task reservation across lease expiry', async () => {
    const result = await runIsolated(`
      const { randomUUID } = await import('crypto')
      const { runMigrations } = await import('./src/db/migrate.ts')
      const { db } = await import('./src/db/sqlite.ts')
      const { createChatSession } = await import('./src/db/chat-sessions.ts')
      const { beginTurn, reserveTurnTask } = await import('./src/db/chat-turns.ts')
      runMigrations()
      const session = createChatSession({ agent: 'api' })
      const started = beginTurn({ sessionId: session.id, projectId: null, requestKey: 'request-reserve', inputFingerprint: 'fingerprint-reserve', owner: 'worker-a' })
      reserveTurnTask(started.turn.id, 'task-created-once')
      // Simula que el proceso murió antes de terminar: vence el lease a mano.
      db.run('UPDATE chat_turns SET owner_expires_at = ? WHERE id = ?', [new Date(Date.now() - 1000).toISOString(), started.turn.id])
      const reclaimed = beginTurn({ sessionId: session.id, projectId: null, requestKey: 'request-reserve', inputFingerprint: 'fingerprint-reserve', owner: 'worker-b' })
      process.stdout.write(JSON.stringify({ reclaimed }))
    `)

    expect(result.reclaimed).toMatchObject({
      kind: 'claimed',
      turn: { id: expect.any(String), task_id: 'task-created-once', owner: 'worker-b' },
    })
  })
})
