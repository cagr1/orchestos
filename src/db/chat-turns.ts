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
  // Reserved BEFORE task creation. Survives failure/interruption so an
  // ambiguous outcome remains identifiable without automatically retrying it.
  task_id: string | null
  created_at: string
  updated_at: string
}

export interface BeginTurnInput {
  sessionId: string
  projectId: string | null
  requestKey: string
  inputFingerprint: string
  owner: string
  // Bounded ownership; expiry fences writes and never authorizes a retry.
  leaseMs?: number
}

export type BeginTurnResult =
  | { kind: 'claimed'; turn: ChatTurnRecord }
  | { kind: 'duplicate-result'; turn: ChatTurnRecord }
  | { kind: 'duplicate-pending'; turn: ChatTurnRecord }
  | { kind: 'interrupted'; turn: ChatTurnRecord }
  | { kind: 'session-busy' }
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
       WHERE session_id = ? AND status = 'pending' AND (owner_expires_at IS NULL OR owner_expires_at <= ?)`,
      [nowIso, input.sessionId, nowIso],
    )

    const existing = getTurnForRequest(input.sessionId, input.requestKey)
    if (existing) {
      if (existing.input_fingerprint !== input.inputFingerprint) return { kind: 'conflict' }
      if (existing.status === 'completed' || existing.status === 'failed') {
        return { kind: 'duplicate-result', turn: existing }
      }
      // A vanished process may already have billed the provider or dispatched a
      // task. Expiry is evidence of uncertainty, never permission to repeat it.
      if (existing.status === 'interrupted') return { kind: 'interrupted', turn: existing }
      return { kind: 'duplicate-pending', turn: existing }
    }
    if (hasActiveTurn(input.sessionId)) return { kind: 'session-busy' }

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

    throw new Error('Chat turn could not be claimed')
  })
  // Obtain the writer lock before checking the session. Two dashboard
  // processes cannot both observe an idle session and claim different keys.
  return claim.immediate()
}

export interface CommitTurnSuccessInput {
  turnId: string
  owner: string
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
    const turn = requireTurnOwner(input.turnId, input.owner)
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
  return commit.immediate()
}

export interface CommitTurnFailureInput {
  turnId: string
  owner: string
  error: string
  run?: Parameters<typeof import('./runs.ts').insertRun>[0]
}

export function commitTurnFailure(input: CommitTurnFailureInput): void {
  const commit = db.transaction(() => {
    requireTurnOwner(input.turnId, input.owner)
    const runId = input.run ? insertRun(input.run) : null
    const changes = db.run(
      `UPDATE chat_turns
       SET status = 'failed', run_id = ?, error = ?, updated_at = ?
       WHERE id = ?`,
      [runId, input.error, new Date().toISOString(), input.turnId],
    ).changes
    if (changes !== 1) throw new Error('Chat turn not found while committing failure')
  })
  commit.immediate()
}

export function requireTurnOwner(turnId: string, owner: string): ChatTurnRecord {
  const turn = getTurnRecord(turnId)
  if (
    turn?.status !== 'pending' ||
    turn.owner !== owner ||
    !turn.owner_expires_at ||
    turn.owner_expires_at <= new Date().toISOString()
  ) {
    throw new Error('Chat turn ownership expired or result already finalized')
  }
  return turn
}

/** Reserve once BEFORE any YAML/git/spawn side effect. Never rename or reuse. */
export function reserveTurnTask(turnId: string, owner: string): string {
  return db
    .transaction(() => {
      const turn = requireTurnOwner(turnId, owner)
      if (turn.task_id)
        throw new Error('Chat turn already reserved a task; execution is not repeated')
      const taskId = `chat-${turnId}`
      db.run('UPDATE chat_turns SET task_id = ?, updated_at = ? WHERE id = ?', [
        taskId,
        new Date().toISOString(),
        turnId,
      ])
      return taskId
    })
    .immediate()
}

export function getTurn(turnId: string): ChatTurnRecord | null {
  return getTurnRecord(turnId)
}

/**
 * R.5 (decisión 10) — un turno 'pending' con lease vigente significa que un
 * proceso está generando una respuesta AHORA MISMO. Borrar la sesión bajo eso
 * (el CASCADE se lleva chat_turns/chat_messages) descartaría trabajo en vuelo
 * sin que nadie lo vea. 'completed'/'failed'/'interrupted', o un 'pending' con
 * lease ya vencido (reconciliable, nadie lo está trabajando de verdad), no
 * bloquean — no hace falta un tombstone para esto.
 */
export function hasActiveTurn(sessionId: string): boolean {
  const now = new Date().toISOString()
  const row = db
    .query<{ count: number }, [string, string]>(
      `SELECT COUNT(*) AS count FROM chat_turns
       WHERE session_id = ? AND status = 'pending' AND owner_expires_at >= ?`,
    )
    .get(sessionId, now)
  return (row?.count ?? 0) > 0
}

export function getTurnByRequestKey(sessionId: string, requestKey: string): ChatTurnRecord | null {
  return getTurnForRequest(sessionId, requestKey)
}

/**
 * R.5 (decisión 11) — el turno más reciente de la sesión, para que el
 * cliente pueda recuperarse tras un recargar/reconectar: ¿hay una respuesta
 * en curso ahora mismo, o la última terminó en failed/interrupted sin que
 * nadie lo haya visto todavía? 'completed' no se distingue acá — ya vive en
 * chat_messages, que es la fuente que el cliente ya lee.
 */
export function getLastTurn(sessionId: string): ChatTurnRecord | null {
  return (
    db
      .query<ChatTurnRecord, string>(
        'SELECT * FROM chat_turns WHERE session_id = ? ORDER BY created_at DESC, id DESC LIMIT 1',
      )
      .get(sessionId) ?? null
  )
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
