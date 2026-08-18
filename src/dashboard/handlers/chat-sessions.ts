import { resolve } from 'path'
import type { AgentChoice } from '../../config/schema.ts'
import { AGENT_CHOICES, loadOrcheConfig } from '../../config/load.ts'
import {
  createChatSession,
  deleteChatSession,
  getChatSession,
  listChatMessages,
  listChatSessions,
  updateChatSession,
  type ChatMessageRecord,
  type ChatSessionMode,
  type ChatSessionRecord,
} from '../../db/chat-sessions.ts'
import { errorResponse, jsonResponse } from '../http.ts'
import type { ChatMessageRow, ChatSessionRow } from '../types.ts'

const MODES = new Set<ChatSessionMode>(['chat', 'code'])
const AGENTS = new Set<AgentChoice>(AGENT_CHOICES)
const TITLE_MAX_LENGTH = 160

function toSessionRow(row: ChatSessionRecord): ChatSessionRow {
  return {
    id: row.id,
    projectId: row.project_id,
    agent: row.agent,
    mode: row.mode,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function toMessageRow(row: ChatMessageRecord): ChatMessageRow {
  return {
    id: row.id,
    sessionId: row.session_id,
    role: row.role,
    content: row.content,
    model: row.model,
    taskId: row.task_id,
    ocrUsed: row.ocr_used,
    createdAt: row.created_at,
  }
}

function sessionIdFromUrl(url: URL): string | null {
  const match = url.pathname.match(/^\/api\/chat\/sessions\/([^/]+)(?:\/messages)?$/)
  if (!match?.[1]) return null
  try {
    const id = decodeURIComponent(match[1]).trim()
    return id && id.length <= 128 ? id : null
  } catch {
    return null
  }
}

function validTitle(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= TITLE_MAX_LENGTH
}

export function handleApiChatSessionsList(): Response {
  return jsonResponse(listChatSessions().map(toSessionRow))
}

export async function handleApiChatSessionsCreate(req: Request): Promise<Response> {
  let parsed: unknown
  try {
    parsed = await req.json()
  } catch {
    return errorResponse('Invalid JSON body', 400)
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return errorResponse('JSON body must be an object', 400)
  }
  const body = parsed as { projectId?: unknown; agent?: unknown; mode?: unknown; title?: unknown }

  if (body.projectId !== undefined && body.projectId !== null && typeof body.projectId !== 'string') {
    return errorResponse('projectId must be a string or null', 400)
  }
  const defaultAgent = loadOrcheConfig(resolve('.')).agent ?? 'api'
  const agent = body.agent ?? defaultAgent
  if (typeof agent !== 'string' || !AGENTS.has(agent as AgentChoice)) {
    return errorResponse('Invalid agent', 400)
  }
  const mode = body.mode ?? 'chat'
  if (typeof mode !== 'string' || !MODES.has(mode as ChatSessionMode)) {
    return errorResponse('Invalid mode', 400)
  }
  if (body.title !== undefined && !validTitle(body.title)) {
    return errorResponse(`title must contain 1-${TITLE_MAX_LENGTH} characters`, 400)
  }

  try {
    const session = createChatSession({
      projectId: body.projectId as string | null | undefined,
      agent: agent as AgentChoice,
      mode: mode as ChatSessionMode,
      title: body.title as string | undefined,
    })
    return jsonResponse(toSessionRow(session), 201)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('FOREIGN KEY constraint failed')) {
      return errorResponse('projectId does not reference an existing project', 400)
    }
    return errorResponse(message, 500)
  }
}

export function handleApiChatSessionMessages(url: URL): Response {
  const id = sessionIdFromUrl(url)
  if (!id) return errorResponse('Invalid session id', 400)
  if (!getChatSession(id)) return errorResponse('Chat session not found', 404)
  return jsonResponse(listChatMessages(id).map(toMessageRow))
}

export async function handleApiChatSessionPatch(req: Request, url: URL): Promise<Response> {
  const id = sessionIdFromUrl(url)
  if (!id) return errorResponse('Invalid session id', 400)

  let parsed: unknown
  try {
    parsed = await req.json()
  } catch {
    return errorResponse('Invalid JSON body', 400)
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return errorResponse('JSON body must be an object', 400)
  }
  const body = parsed as Record<string, unknown>
  const keys = Object.keys(body)
  if (keys.length === 0 || keys.some(key => key !== 'mode' && key !== 'title')) {
    return errorResponse('Only mode and title can be changed; agent is immutable', 400)
  }
  if (body.mode !== undefined && (typeof body.mode !== 'string' || !MODES.has(body.mode as ChatSessionMode))) {
    return errorResponse('Invalid mode', 400)
  }
  if (body.title !== undefined && !validTitle(body.title)) {
    return errorResponse(`title must contain 1-${TITLE_MAX_LENGTH} characters`, 400)
  }

  const updated = updateChatSession(id, {
    mode: body.mode as ChatSessionMode | undefined,
    title: body.title as string | undefined,
  })
  return updated ? jsonResponse(toSessionRow(updated)) : errorResponse('Chat session not found', 404)
}

export function handleApiChatSessionDelete(url: URL): Response {
  const id = sessionIdFromUrl(url)
  if (!id) return errorResponse('Invalid session id', 400)
  return deleteChatSession(id)
    ? jsonResponse({ ok: true })
    : errorResponse('Chat session not found', 404)
}
