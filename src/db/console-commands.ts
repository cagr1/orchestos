import { db } from './sqlite.ts'

export interface ConsoleCommandRecord {
  id: number
  session_id: string
  cmd: string
  exit_code: number
  stdout: string
  stderr: string
  timed_out: number
  elapsed_ms: number
  created_at: string
}

export interface InsertConsoleCommandInput {
  sessionId: string
  cmd: string
  exitCode: number
  stdout: string
  stderr: string
  timedOut: boolean
  elapsedMs: number
}

export function insertConsoleCommand(input: InsertConsoleCommandInput): ConsoleCommandRecord {
  const createdAt = new Date().toISOString()
  const result = db.run(
    `INSERT INTO console_commands (session_id, cmd, exit_code, stdout, stderr, timed_out, elapsed_ms, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [input.sessionId, input.cmd, input.exitCode, input.stdout, input.stderr, input.timedOut ? 1 : 0, input.elapsedMs, createdAt],
  )
  return db.query<ConsoleCommandRecord, number>('SELECT * FROM console_commands WHERE id = ?').get(result.lastInsertRowid as number)!
}

export function listConsoleCommands(sessionId: string): ConsoleCommandRecord[] {
  return db
    .query<ConsoleCommandRecord, string>('SELECT * FROM console_commands WHERE session_id = ? ORDER BY id ASC')
    .all(sessionId)
}
