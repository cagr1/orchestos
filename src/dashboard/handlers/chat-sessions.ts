import { AGENT_CHOICES, loadOrcheConfig } from '../../config/load.ts'
import type { AgentChoice } from '../../config/schema.ts'
import {
  archiveChatSession,
  type ChatMessageRecord,
  type ChatSessionMode,
  type ChatSessionRecord,
  createChatSession,
  deleteChatSession,
  getChatSession,
  listChatMessages,
  listChatSessions,
  restoreChatSession,
  updateChatSession,
} from '../../db/chat-sessions.ts'
import { listChatTurnSteps } from '../../db/chat-turn-steps.ts'
import {
  getLastPersistentTaskId,
  getLastTurn,
  hasActiveTurn,
  listChatTurns,
  sessionHasPersistentWork,
} from '../../db/chat-turns.ts'
import { insertConsoleCommand, listConsoleCommands } from '../../db/console-commands.ts'
import { getRunSteps } from '../../db/run-steps.ts'
import { runOneCheck } from '../../run/checks.ts'
import { KNOWN_CLIS } from '../../run/executors/cli-registry.ts'
import { errorResponse, jsonResponse } from '../http.ts'
import {
  type DashboardProjectContext,
  DashboardProjectError,
  dashboardProjectFromId,
  resolveDashboardProject,
} from '../project-context.ts'
import type { ChatMessageRow, ChatSessionRow } from '../types.ts'

const MODES = new Set<ChatSessionMode>(['chat', 'code'])
const AGENTS = new Set<AgentChoice>(AGENT_CHOICES)
const TITLE_MAX_LENGTH = 160

function toSessionRow(row: ChatSessionRecord): ChatSessionRow {
  const lastModelLabel =
    [...listChatMessages(row.id)].reverse().find((message) => message.role === 'assistant')
      ?.model ?? null
  const lastEffort = lastModelLabel?.match(/\(effort: ([^)]+)\)/i)?.[1] ?? null
  const lastModel =
    lastModelLabel?.replace(/\s+via\s+.+$/i, '').replace(/\s*\(effort: [^)]+\)/i, '') ?? null
  return {
    id: row.id,
    projectId: row.project_id,
    agent: row.agent,
    mode: row.mode,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at,
    hasPersistentWork: sessionHasPersistentWork(row.id),
    lastPersistentTaskId: getLastPersistentTaskId(row.id),
    lastModel,
    lastEffort,
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
    taskHeld: row.task_held,
    existingFiles: row.existing_files,
    createdAt: row.created_at,
  }
}

function sessionIdFromUrl(url: URL): string | null {
  const match = url.pathname.match(
    /^\/api\/chat\/sessions\/([^/]+)(?:\/messages|\/timeline|\/turn-status|\/archive|\/restore|\/exec|\/console)?$/,
  )
  if (!match?.[1]) return null
  try {
    const id = decodeURIComponent(match[1]).trim()
    return id && id.length <= 128 ? id : null
  } catch {
    return null
  }
}

export interface ConsoleLine {
  at: string
  kind: 'turn' | 'step' | 'command' | 'output' | 'error'
  text: string
}

export function handleApiChatSessionExec(req: Request, url: URL): Promise<Response> {
  return execConsoleCommand(req, url)
}

async function execConsoleCommand(req: Request, url: URL): Promise<Response> {
  const id = sessionIdFromUrl(url)
  if (!id) return errorResponse('Invalid session id', 400)
  const session = getChatSession(id)
  if (!session) return errorResponse('Chat session not found', 404)
  if (!session.project_id) return errorResponse('Console commands require a project session', 400)

  let parsed: unknown
  try {
    parsed = await req.json()
  } catch {
    return errorResponse('Invalid JSON body', 400)
  }
  const cmd =
    typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as { cmd?: unknown }).cmd
      : undefined
  if (typeof cmd !== 'string' || !cmd.trim() || cmd.length > 1000) {
    return errorResponse('cmd must contain 1-1000 characters', 400)
  }

  try {
    const project = dashboardProjectFromId(session.project_id)
    const result = await runOneCheck({ cmd }, project.root)
    const row = insertConsoleCommand({
      sessionId: id,
      cmd,
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      timedOut: result.timedOut,
      elapsedMs: result.elapsedMs,
    })
    return jsonResponse({
      cmd: result.cmd,
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      elapsedMs: result.elapsedMs,
      timedOut: result.timedOut,
      id: row.id,
    })
  } catch (error) {
    const status = error instanceof DashboardProjectError ? error.status : 500
    return errorResponse(error instanceof Error ? error.message : String(error), status)
  }
}

export function handleApiChatSessionConsole(url: URL): Response {
  const id = sessionIdFromUrl(url)
  if (!id) return errorResponse('Invalid session id', 400)
  if (!getChatSession(id)) return errorResponse('Chat session not found', 404)

  const lines: ConsoleLine[] = []
  for (const turn of listChatTurns(id)) {
    lines.push({ at: turn.created_at, kind: 'turn', text: `[turn] ${turn.status}` })
    if (turn.error) lines.push({ at: turn.updated_at, kind: 'error', text: turn.error })
    if (turn.task_id) {
      for (const step of getRunSteps(turn.task_id)) {
        let text = `[tool] ${step.label}`
        if (step.type === 'text') text = `[text] ${step.detail || step.label}`
        if (step.type === 'step_finish') {
          const tokens = step.tokens_json ? ` ${step.tokens_json}` : ''
          const cost = step.cost_usd != null ? ` cost ${step.cost_usd}` : ''
          text = `[step]${tokens}${cost}`
        }
        lines.push({ at: step.created_at, kind: 'step', text })
      }
    }
  }
  for (const command of listConsoleCommands(id)) {
    lines.push({ at: command.created_at, kind: 'command', text: `$ ${command.cmd}` })
    if (command.stdout) lines.push({ at: command.created_at, kind: 'output', text: command.stdout })
    if (command.stderr) lines.push({ at: command.created_at, kind: 'error', text: command.stderr })
    lines.push({
      at: command.created_at,
      kind: command.exit_code === 0 ? 'output' : 'error',
      text: `exit ${command.exit_code}`,
    })
  }
  lines.sort((a, b) => a.at.localeCompare(b.at))
  return jsonResponse({ lines, pending: hasActiveTurn(id) })
}

function validTitle(value: unknown): value is string {
  return (
    typeof value === 'string' && value.trim().length > 0 && value.trim().length <= TITLE_MAX_LENGTH
  )
}

// I.4 (Mes 30) — el aside de conversaciones filtra por proyecto activo. Sin
// proyecto (sesión general), lista las sesiones con project_id null — nunca
// TODAS, mezclar chats de proyectos distintos no tiene sentido con >1 proyecto.
export function handleApiChatSessionsList(req: Request): Response {
  const params = new URL(req.url).searchParams
  const archive = params.get('archived') === '1' ? 'archived' : 'active'
  if (archive === 'archived' && !params.has('project')) {
    return jsonResponse(listChatSessions(undefined, 'archived').map(toSessionRow))
  }
  if (params.get('project') === 'none') {
    return jsonResponse(listChatSessions(null, archive).map(toSessionRow))
  }
  let projectId: string | null
  try {
    projectId = resolveDashboardProject(req).id
  } catch {
    projectId = null
  }
  return jsonResponse(listChatSessions(projectId, archive).map(toSessionRow))
}

export async function handleApiChatSessionsCreate(
  req: Request,
  fallbackProject?: DashboardProjectContext,
): Promise<Response> {
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

  if (
    body.projectId !== undefined &&
    body.projectId !== null &&
    typeof body.projectId !== 'string'
  ) {
    return errorResponse('projectId must be a string or null', 400)
  }
  let selectedProject = fallbackProject
  if (body.projectId === undefined && !selectedProject) {
    try {
      selectedProject = resolveDashboardProject(req)
    } catch (error) {
      const status = error instanceof Error && 'status' in error ? Number(error.status) : 400
      return errorResponse(error instanceof Error ? error.message : String(error), status)
    }
  }
  const projectId =
    body.projectId === undefined ? (selectedProject?.id ?? null) : (body.projectId as string | null)
  let configRoot = selectedProject?.root
  if (projectId) {
    try {
      configRoot = dashboardProjectFromId(projectId).root
    } catch (error) {
      const status = error instanceof Error && 'status' in error ? Number(error.status) : 400
      return errorResponse(error instanceof Error ? error.message : String(error), status)
    }
  }
  const defaultAgent = projectId === null ? 'api' : (loadOrcheConfig(configRoot!).agent ?? 'api')
  const agent = body.agent ?? defaultAgent
  if (typeof agent !== 'string' || !AGENTS.has(agent as AgentChoice)) {
    return errorResponse('Invalid agent', 400)
  }
  const definition = projectId !== null ? KNOWN_CLIS.find((cli) => cli.id === agent) : undefined
  const readBoundaryWarning =
    definition && definition.readBoundary.kind === 'none'
      ? definition.readBoundary.reason
      : undefined
  // R.1 — la autoridad de ejecutar no es una preferencia que el dashboard
  // deba reconstruir: nace del contexto persistido de la sesión. Las sesiones
  // nuevas de proyecto entran en Code; las generales permanecen en Chat.
  // Una sesión existente conserva su modo, por lo que nunca se eleva en
  // silencio al actualizar esta regla.
  const mode = body.mode ?? (projectId === null ? 'chat' : 'code')
  if (typeof mode !== 'string' || !MODES.has(mode as ChatSessionMode)) {
    return errorResponse('Invalid mode', 400)
  }
  if (body.title !== undefined && !validTitle(body.title)) {
    return errorResponse(`title must contain 1-${TITLE_MAX_LENGTH} characters`, 400)
  }

  try {
    const session = createChatSession({
      projectId,
      agent: agent as AgentChoice,
      mode: mode as ChatSessionMode,
      title: body.title as string | undefined,
    })
    return jsonResponse({ ...toSessionRow(session), readBoundaryWarning }, 201)
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

export function handleApiChatSessionTimeline(url: URL): Response {
  const id = sessionIdFromUrl(url)
  if (!id) return errorResponse('Invalid session id', 400)
  if (!getChatSession(id)) return errorResponse('Chat session not found', 404)
  const turns = listChatTurns(id)
  const messages = listChatMessages(id).map(toMessageRow)
  const commands = listConsoleCommands(id)
  const steps = listChatTurnSteps(id)
  const events = [
    ...turns.map((turn) => ({ kind: 'turn' as const, at: turn.created_at, turnId: turn.id })),
    ...steps.map((step) => ({
      kind: 'step' as const,
      at: step.created_at,
      turnId: step.turn_id,
      seq: step.seq,
    })),
    ...commands.map((command) => ({
      kind: 'command' as const,
      at: command.created_at,
      id: command.id,
    })),
  ].sort((a, b) => a.at.localeCompare(b.at) || ('seq' in a ? a.seq : 0) - ('seq' in b ? b.seq : 0))
  return jsonResponse({
    turns: turns.map((turn) => ({
      id: turn.id,
      status: turn.status,
      createdAt: turn.created_at,
      updatedAt: turn.updated_at,
      error: turn.error,
      steps: steps
        .filter((step) => step.turn_id === turn.id)
        .map((step) => ({
          seq: step.seq,
          type: step.type,
          tool: step.tool,
          target: step.target,
          added: step.added,
          removed: step.removed,
          exitCode: step.exit_code,
          ok: step.ok === null ? null : step.ok === 1,
          output: step.output,
          detail: step.detail,
          durationMs: step.duration_ms,
          createdAt: step.created_at,
        })),
    })),
    messages,
    commands: commands.map((command) => ({
      id: command.id,
      cmd: command.cmd,
      exitCode: command.exit_code,
      stdout: command.stdout,
      stderr: command.stderr,
      elapsedMs: command.elapsed_ms,
      createdAt: command.created_at,
    })),
    pending: hasActiveTurn(id),
    events,
  })
}

export type ChatTurnStatusRow =
  | { kind: 'none' }
  | { kind: 'pending'; turnId: string; requestKey: string }
  | { kind: 'failed'; error: string | null }
  | { kind: 'interrupted' }

// R.5 (decisión 11) — al montar/recargar una sesión, el cliente pregunta acá
// si hay un turno en curso o si el último terminó failed/interrupted sin
// que nadie lo haya visto. 'completed' no aplica: ya está en chat_messages,
// que es lo que fetchChatSession() ya trae. No reconstruye el texto original
// del usuario (decisión 5 solo guarda el fingerprint, no el mensaje) — el
// cliente muestra un estado genérico, nunca contenido inventado.
export function handleApiChatSessionTurnStatus(url: URL): Response {
  const id = sessionIdFromUrl(url)
  if (!id) return errorResponse('Invalid session id', 400)
  if (!getChatSession(id)) return errorResponse('Chat session not found', 404)
  const turn = getLastTurn(id)
  if (!turn) return jsonResponse({ kind: 'none' } satisfies ChatTurnStatusRow)
  if (turn.status === 'completed') return jsonResponse({ kind: 'none' } satisfies ChatTurnStatusRow)
  if (turn.status === 'failed') {
    return jsonResponse({ kind: 'failed', error: turn.error } satisfies ChatTurnStatusRow)
  }
  if (turn.status === 'interrupted') {
    return jsonResponse({ kind: 'interrupted' } satisfies ChatTurnStatusRow)
  }
  // status === 'pending': lease vencido y nadie lo reclamó todavía es, para
  // el cliente, indistinguible de interrupted — beginTurn() lo reconciliará
  // recién cuando alguien mande el próximo mensaje, no antes.
  const leaseExpired = !turn.owner_expires_at || turn.owner_expires_at < new Date().toISOString()
  if (leaseExpired) return jsonResponse({ kind: 'interrupted' } satisfies ChatTurnStatusRow)
  return jsonResponse({
    kind: 'pending',
    turnId: turn.id,
    requestKey: turn.request_key,
  } satisfies ChatTurnStatusRow)
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
  if (keys.length === 0 || keys.some((key) => key !== 'mode' && key !== 'title')) {
    return errorResponse('Only mode and title can be changed; agent is immutable', 400)
  }
  if (
    body.mode !== undefined &&
    (typeof body.mode !== 'string' || !MODES.has(body.mode as ChatSessionMode))
  ) {
    return errorResponse('Invalid mode', 400)
  }
  if (body.title !== undefined && !validTitle(body.title)) {
    return errorResponse(`title must contain 1-${TITLE_MAX_LENGTH} characters`, 400)
  }

  const updated = updateChatSession(id, {
    mode: body.mode as ChatSessionMode | undefined,
    title: body.title as string | undefined,
  })
  return updated
    ? jsonResponse(toSessionRow(updated))
    : errorResponse('Chat session not found', 404)
}

export function handleApiChatSessionDelete(url: URL): Response {
  const id = sessionIdFromUrl(url)
  if (!id) return errorResponse('Invalid session id', 400)
  // R.5 (decisión 10) — un turno pending con lease vigente es trabajo en
  // vuelo; el CASCADE de chat_sessions se lo llevaría sin que nadie lo viera.
  if (hasActiveTurn(id)) {
    return errorResponse('Cannot delete a conversation with a response in progress', 409)
  }
  return deleteChatSession(id)
    ? jsonResponse({ ok: true })
    : errorResponse('Chat session not found', 404)
}

export function handleApiChatSessionArchive(url: URL, restore = false): Response {
  const id = sessionIdFromUrl(url)
  if (!id) return errorResponse('Invalid session id', 400)
  const updated = restore ? restoreChatSession(id) : archiveChatSession(id)
  return updated
    ? jsonResponse(toSessionRow(updated))
    : errorResponse('Chat session not found', 404)
}
