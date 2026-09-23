import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { createChatSession, deleteChatSession } from './chat-sessions.ts'
import { insertChatTurnStep, listChatTurnSteps } from './chat-turn-steps.ts'
import { beginTurn } from './chat-turns.ts'
import { db } from './sqlite.ts'

const sessionIds: string[] = []

beforeAll(async () => {
  const { runMigrations } = await import('./migrate.ts')
  runMigrations()
})

afterAll(() => {
  for (const id of sessionIds) deleteChatSession(id)
})

describe('chat-turn-steps', () => {
  it('inserta y lee pasos por sesión en orden, con resultado y diff', () => {
    const session = createChatSession({ agent: 'api', mode: 'code' })
    sessionIds.push(session.id)
    const claimed = beginTurn({
      sessionId: session.id,
      projectId: null,
      requestKey: `steps-${session.id}`,
      inputFingerprint: 'steps',
      owner: 'test',
    })
    if (claimed.kind !== 'claimed') throw new Error('test turn was not claimed')
    const first = insertChatTurnStep({
      sessionId: session.id,
      turnId: claimed.turn.id,
      seq: 0,
      type: 'tool_use',
      tool: 'Edit',
      target: 'src/a.ts',
      added: 3,
      removed: 2,
    })
    const second = insertChatTurnStep({
      sessionId: session.id,
      turnId: claimed.turn.id,
      seq: 1,
      type: 'tool_use',
      tool: 'Bash',
      exitCode: 0,
      ok: true,
      output: 'done',
    })
    const rows = listChatTurnSteps(session.id)
    expect(rows.map((row) => row.id)).toEqual([first.id, second.id])
    expect(rows[0]).toMatchObject({ tool: 'Edit', added: 3, removed: 2 })
    expect(rows[1]).toMatchObject({ tool: 'Bash', exit_code: 0, ok: 1, output: 'done' })
  })

  it('no mezcla pasos de otra sesión', () => {
    const session = createChatSession({ agent: 'api' })
    sessionIds.push(session.id)
    const claimed = beginTurn({
      sessionId: session.id,
      projectId: null,
      requestKey: `steps-${session.id}`,
      inputFingerprint: 'steps',
      owner: 'test',
    })
    if (claimed.kind !== 'claimed') throw new Error('test turn was not claimed')
    insertChatTurnStep({
      sessionId: session.id,
      turnId: claimed.turn.id,
      seq: 0,
      type: 'text',
      detail: 'x',
    })
    expect(listChatTurnSteps(session.id)).toHaveLength(1)
    expect(
      db
        .query('SELECT COUNT(*) AS count FROM chat_turn_steps WHERE session_id = ?')
        .get(session.id),
    ).toEqual({ count: 1 })
  })
})
