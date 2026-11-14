import { randomUUID } from 'node:crypto'
import { getChatSession } from './chat-sessions.ts'
import { db } from './sqlite.ts'

export interface SessionMessageRecord {
  id: string
  project_id: string
  from_session_id: string
  from_turn_id: string | null
  to_session_id: string
  content: string
  status: 'pending' | 'approved' | 'discarded'
  created_at: string
  decided_at: string | null
  consumed_turn_id: string | null
  fromTitle: string
  fromAgent: string
  toTitle: string
  toAgent: string
}
const SELECT = `SELECT m.*, f.title AS fromTitle, f.agent AS fromAgent,
  t.title AS toTitle, t.agent AS toAgent FROM session_messages m
  JOIN chat_sessions f ON f.id = m.from_session_id
  JOIN chat_sessions t ON t.id = m.to_session_id`

export function sessionMessageDestinationError(
  projectId: string,
  fromSessionId: string,
  toSessionId: string,
): string | null {
  const destination = getChatSession(toSessionId)
  if (!destination) return 'Destination session does not exist'
  if (toSessionId === fromSessionId) return 'Destination must be another session'
  if (destination.project_id !== projectId) return 'Destination belongs to another project'
  if (destination.archived_at) return 'Destination session is archived'
  return null
}
export function proposeSessionMessage(input: {
  projectId: string
  fromSessionId: string
  fromTurnId: string
  toSessionId: string
  content: string
}): SessionMessageRecord {
  return db.transaction(() => {
    const error = sessionMessageDestinationError(
      input.projectId,
      input.fromSessionId,
      input.toSessionId,
    )
    if (error) throw new Error(error)
    const id = randomUUID()
    db.run(
      `INSERT INTO session_messages (id, project_id, from_session_id, from_turn_id, to_session_id, content, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
      [
        id,
        input.projectId,
        input.fromSessionId,
        input.fromTurnId,
        input.toSessionId,
        input.content,
        new Date().toISOString(),
      ],
    )
    const row = db.query<SessionMessageRecord, [string]>(`${SELECT} WHERE m.id = ?`).get(id)
    if (!row) throw new Error('Inserted session message was not found')
    return row
  })()
}
export function listSessionMessagesForTurn(turnId: string): SessionMessageRecord[] {
  return db
    .query<SessionMessageRecord, [string]>(
      `${SELECT} WHERE m.from_turn_id = ? ORDER BY m.created_at, m.id`,
    )
    .all(turnId)
}
export class SessionMessageError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
  }
}
function decide(id: string, status: 'approved' | 'discarded'): SessionMessageRecord {
  return db.transaction(() => {
    const row = db.query<SessionMessageRecord, [string]>(`${SELECT} WHERE m.id = ?`).get(id)
    if (!row) throw new SessionMessageError('Session message not found', 404)
    if (row.status !== 'pending')
      throw new SessionMessageError('Session message already decided', 409)
    if (status === 'approved') {
      const error = sessionMessageDestinationError(
        row.project_id,
        row.from_session_id,
        row.to_session_id,
      )
      if (error) throw new SessionMessageError(error, 409)
      // D4 — ambas sesiones activas: una propuesta de una sesión archivada no se entrega (qa MSG.1).
      if (getChatSession(row.from_session_id)?.archived_at)
        throw new SessionMessageError('Source session is archived', 409)
    }
    const at = new Date().toISOString()
    db.run('UPDATE session_messages SET status = ?, decided_at = ? WHERE id = ?', [status, at, id])
    if (status === 'approved')
      db.run('UPDATE chat_sessions SET updated_at = ? WHERE id = ?', [at, row.to_session_id])
    return { ...row, status, decided_at: at }
  })()
}
export function approveSessionMessage(id: string): SessionMessageRecord {
  return decide(id, 'approved')
}
export function discardSessionMessage(id: string): SessionMessageRecord {
  return decide(id, 'discarded')
}
export function listApprovedInbound(toSessionId: string): SessionMessageRecord[] {
  return db
    .query<SessionMessageRecord, [string]>(
      `${SELECT} WHERE m.to_session_id = ? AND m.status = 'approved' ORDER BY m.decided_at, m.created_at, m.id`,
    )
    .all(toSessionId)
}
export function listUnconsumedInbound(toSessionId: string): SessionMessageRecord[] {
  return db
    .query<SessionMessageRecord, [string]>(
      `${SELECT} WHERE m.to_session_id = ? AND m.status = 'approved' AND m.consumed_turn_id IS NULL ORDER BY m.decided_at, m.created_at, m.id LIMIT 3`,
    )
    .all(toSessionId)
}
export function markConsumed(ids: string[], turnId: string): void {
  for (const id of ids)
    db.run(
      "UPDATE session_messages SET consumed_turn_id = ? WHERE id = ? AND status = 'approved' AND consumed_turn_id IS NULL",
      [turnId, id],
    )
}
