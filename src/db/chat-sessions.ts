import { randomUUID } from 'crypto'
import type { AgentChoice } from '../config/schema.ts'
import { db } from './sqlite.ts'

export type ChatSessionMode = 'chat' | 'code'

export interface ChatSessionRecord {
  id: string
  project_id: string | null
  agent: AgentChoice
  mode: ChatSessionMode
  title: string
  created_at: string
  updated_at: string
}

interface StoredChatMessage {
  id: number
  session_id: string
  role: 'user' | 'assistant'
  content: string
  model: string | null
  task_id: string | null
  ocr_used: string | null
  created_at: string
}

export interface ChatMessageRecord extends Omit<StoredChatMessage, 'ocr_used'> {
  ocr_used: string[]
}

export interface CreateChatSessionInput {
  projectId?: string | null
  agent: AgentChoice
  mode?: ChatSessionMode
  title?: string
}

export interface AppendChatExchangeInput {
  sessionId: string
  userContent: string
  assistantContent: string
  model?: string | null
  taskId?: string | null
  ocrUsed?: string[]
}

function parseOcrUsed(value: string | null): string[] {
  if (!value) return []
  try {
    const parsed: unknown = JSON.parse(value)
    return Array.isArray(parsed) && parsed.every((item) => typeof item === 'string') ? parsed : []
  } catch {
    return []
  }
}

function mapMessage(row: StoredChatMessage): ChatMessageRecord {
  return { ...row, ocr_used: parseOcrUsed(row.ocr_used) }
}

export function createChatSession(input: CreateChatSessionInput): ChatSessionRecord {
  const now = new Date().toISOString()
  const row: ChatSessionRecord = {
    id: randomUUID(),
    project_id: input.projectId ?? null,
    agent: input.agent,
    mode: input.mode ?? 'chat',
    title: input.title?.trim() || 'New conversation',
    created_at: now,
    updated_at: now,
  }
  db.run(
    `INSERT INTO chat_sessions (id, project_id, agent, mode, title, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [row.id, row.project_id, row.agent, row.mode, row.title, row.created_at, row.updated_at],
  )
  return row
}

/**
 * I.4 (Mes 30, 2026-09-05) — `projectId` filtra la lista al proyecto activo
 * (o a las sesiones generales, `project_id IS NULL`, con `projectId: null`).
 * Sin filtro (`undefined`) devuelve todo — comportamiento previo, para no
 * romper callers que todavía no pasan proyecto. El aside de conversaciones
 * (screens-core.js) SIEMPRE filtra: mezclar chats de proyectos distintos en
 * una sola lista no tiene sentido una vez que hay más de un proyecto.
 */
export function listChatSessions(projectId?: string | null): ChatSessionRecord[] {
  if (projectId === undefined) {
    return db
      .query<ChatSessionRecord, []>(
        'SELECT * FROM chat_sessions ORDER BY updated_at DESC, created_at DESC',
      )
      .all()
  }
  if (projectId === null) {
    return db
      .query<ChatSessionRecord, []>(
        'SELECT * FROM chat_sessions WHERE project_id IS NULL ORDER BY updated_at DESC, created_at DESC',
      )
      .all()
  }
  return db
    .query<ChatSessionRecord, string>(
      'SELECT * FROM chat_sessions WHERE project_id = ? ORDER BY updated_at DESC, created_at DESC',
    )
    .all(projectId)
}

export function getChatSession(id: string): ChatSessionRecord | null {
  return (
    db.query<ChatSessionRecord, string>('SELECT * FROM chat_sessions WHERE id = ?').get(id) ?? null
  )
}

export function updateChatSession(
  id: string,
  patch: { mode?: ChatSessionMode; title?: string },
): ChatSessionRecord | null {
  const current = getChatSession(id)
  if (!current) return null
  const updatedAt = new Date().toISOString()
  db.run('UPDATE chat_sessions SET mode = ?, title = ?, updated_at = ? WHERE id = ?', [
    patch.mode ?? current.mode,
    patch.title?.trim() ?? current.title,
    updatedAt,
    id,
  ])
  return getChatSession(id)
}

export function deleteChatSession(id: string): boolean {
  return db.run('DELETE FROM chat_sessions WHERE id = ?', [id]).changes > 0
}

export function listChatMessages(sessionId: string): ChatMessageRecord[] {
  return db
    .query<StoredChatMessage, string>(
      'SELECT * FROM chat_messages WHERE session_id = ? ORDER BY id ASC',
    )
    .all(sessionId)
    .map(mapMessage)
}

// I.4 (Mes 30) — mismo largo/criterio de truncado que descToTaskId() usa para
// IDs legibles (tasks/init.ts), acá aplicado a texto libre para el título del
// aside: una línea, sin saltos, corta.
const AUTO_TITLE_MAX_LENGTH = 60

function autoTitleFrom(userContent: string): string {
  const oneLine = userContent.replace(/\s+/g, ' ').trim()
  if (oneLine.length <= AUTO_TITLE_MAX_LENGTH) return oneLine || 'New conversation'
  return `${oneLine.slice(0, AUTO_TITLE_MAX_LENGTH - 1)}…`
}

export function appendChatExchange(input: AppendChatExchangeInput): ChatMessageRecord[] {
  const insert = db.transaction(() => {
    const session = getChatSession(input.sessionId)
    if (!session) throw new Error('Chat session not found')
    const now = new Date().toISOString()
    // I.4 — el título por defecto ('New conversation') es inútil en una lista
    // de N conversaciones; se reemplaza por el primer mensaje del usuario la
    // única vez que corre, para no pisar un título que el usuario ya haya
    // puesto a mano después (PATCH /api/chat/sessions/:id, ya existía).
    const isFirstExchange = listChatMessages(input.sessionId).length === 0
    if (isFirstExchange && session.title === 'New conversation') {
      db.run('UPDATE chat_sessions SET title = ? WHERE id = ?', [
        autoTitleFrom(input.userContent),
        input.sessionId,
      ])
    }
    db.run(
      `INSERT INTO chat_messages (session_id, role, content, model, task_id, ocr_used, created_at)
       VALUES (?, 'user', ?, NULL, NULL, ?, ?)`,
      [input.sessionId, input.userContent, JSON.stringify(input.ocrUsed ?? []), now],
    )
    db.run(
      `INSERT INTO chat_messages (session_id, role, content, model, task_id, ocr_used, created_at)
       VALUES (?, 'assistant', ?, ?, ?, ?, ?)`,
      [
        input.sessionId,
        input.assistantContent,
        input.model ?? null,
        input.taskId ?? null,
        JSON.stringify(input.ocrUsed ?? []),
        now,
      ],
    )
    db.run('UPDATE chat_sessions SET updated_at = ? WHERE id = ?', [now, input.sessionId])
  })
  insert()
  return listChatMessages(input.sessionId).slice(-2)
}

/** `chat` is a hard read-only boundary; legacy requests retain their old behavior. */
export function sessionAllowsTaskExecution(mode: ChatSessionMode | null): boolean {
  return mode === null || mode === 'code'
}
