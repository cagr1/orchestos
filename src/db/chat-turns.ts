import { randomUUID } from 'crypto'
import { appendChatExchange } from './chat-sessions.ts'
import { insertRun } from './runs.ts'
import { db } from './sqlite.ts'

export type ChatTurnStatus = 'pending' | 'completed' | 'failed' | 'interrupted'

export interface ChatTurnRecord {
  id: string
  session_id: string
  project_id: string | null
  request_key: string
  input_fingerprint: string
  status: ChatTurnStatus
  owner: string | null
  owner_expires_at: string | null
  run_id: string | null
  response_envelope_json: string | null
  error: string | null
  created_at: string
  updated_at: string
}

export interface BeginTurnInput {
  sessionId: string
  projectId: string | null
  requestKey: string
  inputFingerprint: string
  owner: string
  // This outlives the chat provider timeout (120 seconds), avoiding a second
  // claimant while the first process is still allowed to finish its request.
  leaseMs?: number
}

export type BeginTurnResult =
  | { kind: 'claimed'; turn: ChatTurnRecord }
  | { kind: 'duplicate-result'; turn: ChatTurnRecord }
  | { kind: 'duplicate-pending'; turn: ChatTurnRecord }
  | { kind: 'conflict' }

const DEFAULT_LEASE_MS = 150_000

function getTurnRecord(turnId: string): ChatTurnRecord | null {
  return (
    db.query<ChatTurnRecord, string>('SELECT * FROM chat_turns WHERE id = ?').get(turnId) ?? null
  )
}

function getTurnForRequest(sessionId: string, requestKey: string): ChatTurnRecord | null {
  return (
    db
      .query<ChatTurnRecord, [string, string]>(
        'SELECT * FROM chat_turns WHERE session_id = ? AND request_key = ?',
      )
      .get(sessionId, requestKey) ?? null
  )
}

/**
 * Claims a request under the UNIQUE(session_id, request_key) constraint.
 * The constraint, rather than a select-then-insert race, is the authority
 * across dashboard processes. Expired work is marked interrupted locally to
 * this session only; recovery never repeats a provider call by itself.
 */
export function beginTurn(input: BeginTurnInput): BeginTurnResult {
  const claim = db.transaction((): BeginTurnResult => {
    const now = new Date()
    const nowIso = now.toISOString()
    const leaseMs = input.leaseMs ?? DEFAULT_LEASE_MS
    const expiresAt = new Date(now.getTime() + leaseMs).toISOString()

    db.run(
      `UPDATE chat_turns
       SET status = 'interrupted', updated_at = ?
       WHERE session_id = ? AND status = 'pending' AND owner_expires_at < ?`,
      [nowIso, input.sessionId, nowIso],
    )

    const id = randomUUID()
    const inserted = db.run(
      `INSERT OR IGNORE INTO chat_turns (
        id, session_id, project_id, request_key, input_fingerprint, status,
        owner, owner_expires_at, run_id, response_envelope_json, error, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, NULL, NULL, NULL, ?, ?)`,
      [
        id,
        input.sessionId,
        input.projectId,
        input.requestKey,
        input.inputFingerprint,
        input.owner,
        expiresAt,
        nowIso,
        nowIso,
      ],
    )
    if (inserted.changes === 1) {
      const turn = getTurnRecord(id)
      if (!turn) throw new Error('Claimed chat turn was not found')
      return { kind: 'claimed', turn }
    }

    const existing = getTurnForRequest(input.sessionId, input.requestKey)
    if (!existing) throw new Error('Existing chat turn was not found')
    if (existing.input_fingerprint !== input.inputFingerprint) return { kind: 'conflict' }
    if (existing.status === 'completed' || existing.status === 'failed') {
      return { kind: 'duplicate-result', turn: existing }
    }

    const leaseExpired = !existing.owner_expires_at || existing.owner_expires_at < nowIso
    if (existing.status === 'pending' && !leaseExpired) {
      return { kind: 'duplicate-pending', turn: existing }
    }
    if ((existing.status === 'pending' || existing.status === 'interrupted') && leaseExpired) {
      db.run(
        `UPDATE chat_turns
         SET status = 'pending', owner = ?, owner_expires_at = ?, updated_at = ?
         WHERE id = ?`,
        [input.owner, expiresAt, nowIso, existing.id],
      )
      const turn = getTurnRecord(existing.id)
      if (!turn) throw new Error('Reclaimed chat turn was not found')
      return { kind: 'claimed', turn }
    }
    return { kind: 'duplicate-pending', turn: existing }
  })
  return claim()
}

export interface CommitTurnSuccessInput {
  turnId: string
  run: Parameters<typeof import('./runs.ts').insertRun>[0]
  userContent: string
  assistantContent: string
  model?: string | null
  taskId?: string | null
  ocrUsed?: string[]
  taskHeld?: boolean
  existingFiles?: string[]
  envelope: unknown
}

/**
 * The provider has already returned by the time this starts. Keeping only DB
 * writes inside this transaction means a crash cannot leave a durable run or
 * exchange that claims a turn completed when the other records are absent.
 */
export function commitTurnSuccess(input: CommitTurnSuccessInput): { runId: string } {
  const commit = db.transaction(() => {
    const turn = getTurnRecord(input.turnId)
    if (!turn) throw new Error('Chat turn not found while committing success')
    const runId = insertRun(input.run)
    appendChatExchange({
      sessionId: turn.session_id,
      userContent: input.userContent,
      assistantContent: input.assistantContent,
      model: input.model,
      taskId: input.taskId,
      ocrUsed: input.ocrUsed,
      taskHeld: input.taskHeld,
      existingFiles: input.existingFiles,
    })
    // JSON.stringify is deliberately inside the transaction: a malformed
    // envelope must also roll back the run and exchange, not orphan either.
    const changes = db.run(
      `UPDATE chat_turns
       SET status = 'completed', run_id = ?, response_envelope_json = ?, error = NULL, updated_at = ?
       WHERE id = ?`,
      [runId, JSON.stringify(input.envelope), new Date().toISOString(), input.turnId],
    ).changes
    if (changes !== 1) throw new Error('Chat turn not found while committing success')
    return { runId }
  })
  return commit()
}

export interface CommitTurnFailureInput {
  turnId: string
  error: string
  run?: Parameters<typeof import('./runs.ts').insertRun>[0]
}

export function commitTurnFailure(input: CommitTurnFailureInput): void {
  const commit = db.transaction(() => {
    const runId = input.run ? insertRun(input.run) : null
    const changes = db.run(
      `UPDATE chat_turns
       SET status = 'failed', run_id = ?, error = ?, updated_at = ?
       WHERE id = ?`,
      [runId, input.error, new Date().toISOString(), input.turnId],
    ).changes
    if (changes !== 1) throw new Error('Chat turn not found while committing failure')
  })
  commit()
}

export function getTurn(turnId: string): ChatTurnRecord | null {
  return getTurnRecord(turnId)
}

export function getTurnByRequestKey(sessionId: string, requestKey: string): ChatTurnRecord | null {
  return getTurnForRequest(sessionId, requestKey)
}

// A corrupt historical envelope must not make recovery itself fail. Callers
// can show a normal error/retry state rather than treating invalid JSON as a
// second provider request.
export function parseTurnEnvelope(turn: ChatTurnRecord): unknown {
  if (!turn.response_envelope_json) return null
  try {
    return JSON.parse(turn.response_envelope_json)
  } catch {
    return null
  }
}
