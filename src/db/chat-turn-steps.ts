import { db } from './sqlite.ts'

export interface ChatTurnStepRecord {
  id: number
  session_id: string
  turn_id: string
  seq: number
  type: 'tool_use' | 'text' | 'step_finish' | 'reasoning'
  tool: string | null
  target: string | null
  added: number | null
  removed: number | null
  exit_code: number | null
  ok: number | null
  output: string | null
  detail: string | null
  duration_ms: number | null
  created_at: string
}

export interface InsertChatTurnStepInput {
  sessionId: string
  turnId: string
  seq: number
  type: ChatTurnStepRecord['type']
  tool?: string
  target?: string
  added?: number
  removed?: number
  exitCode?: number
  ok?: boolean
  output?: string
  detail?: string
  durationMs?: number
}

const OUTPUT_MAX = 4096

export function insertChatTurnStep(input: InsertChatTurnStepInput): ChatTurnStepRecord {
  const createdAt = new Date().toISOString()
  const result = db.run(
    `INSERT INTO chat_turn_steps
      (session_id, turn_id, seq, type, tool, target, added, removed, exit_code, ok, output, detail, duration_ms, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      input.sessionId,
      input.turnId,
      input.seq,
      input.type,
      input.tool ?? null,
      input.target ?? null,
      input.added ?? null,
      input.removed ?? null,
      input.exitCode ?? null,
      input.ok === undefined ? null : input.ok ? 1 : 0,
      input.output?.slice(0, OUTPUT_MAX) ?? null,
      input.detail?.slice(0, OUTPUT_MAX) ?? null,
      input.durationMs ?? null,
      createdAt,
    ],
  )
  const row = db
    .query<ChatTurnStepRecord, number>('SELECT * FROM chat_turn_steps WHERE id = ?')
    .get(result.lastInsertRowid as number)
  if (!row) throw new Error('Inserted chat turn step was not found')
  return row
}

export function listChatTurnSteps(sessionId: string): ChatTurnStepRecord[] {
  return db
    .query<ChatTurnStepRecord, string>(
      'SELECT * FROM chat_turn_steps WHERE session_id = ? ORDER BY created_at, id, seq',
    )
    .all(sessionId)
}
