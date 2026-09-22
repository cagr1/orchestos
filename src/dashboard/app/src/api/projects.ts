import type { AgentSession, ProjectItem } from '../types/orchestos'

export interface ProjectRow {
  id: string
  path: string
  stackProfile: string
  lastUpdated: string
}

export interface SessionRow {
  id: string
  projectId: string | null
  agent: string
  mode: 'chat' | 'code'
  title: string
  createdAt: string
  updatedAt: string
}

export interface TurnStatus {
  kind: 'none' | 'pending' | 'failed' | 'interrupted'
}

async function request<T>(path: string): Promise<T> {
  const response = await fetch(path)
  const body = (await response.json().catch(() => null)) as { error?: string } | T | null
  if (!response.ok) {
    const message =
      body && typeof body === 'object' && body && 'error' in body ? body.error : undefined
    throw new Error(message || `Request failed (${response.status})`)
  }
  return body as T
}

function basename(path: string): string {
  const clean = path.replace(/[\\/]$/, '')
  return clean.split(/[\\/]/).pop() || path
}

// Tiempo desde la última actividad (formato de la plantilla: 17m, 1h, 2d).
export function timeSince(updatedAt: string, now: number = Date.now()): string {
  const minutes = Math.max(0, Math.round((now - Date.parse(updatedAt)) / 60000))
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  return hours < 48 ? `${hours}h` : `${Math.floor(hours / 24)}d`
}

export function mapProjectRow(row: ProjectRow, agents: AgentSession[] = []): ProjectItem {
  return {
    id: row.id,
    name: basename(row.path),
    path: row.path,
    filesCount: 0,
    agents,
  }
}

export function mapSessionToAgent(
  session: SessionRow,
  status: TurnStatus = { kind: 'none' },
): AgentSession {
  return {
    id: session.id,
    name: session.title,
    model: session.agent,
    duration: timeSince(session.updatedAt),
    status:
      status.kind === 'pending'
        ? 'active'
        : status.kind === 'failed' || status.kind === 'interrupted'
          ? 'idle'
          : 'completed',
    shellCommandsCount: 0,
    filesCount: 0,
    lastLog:
      status.kind === 'failed'
        ? 'The last turn failed.'
        : status.kind === 'interrupted'
          ? 'The last turn was interrupted.'
          : undefined,
    branch: '',
  }
}

async function loadAgent(session: SessionRow): Promise<AgentSession> {
  const status = await request<TurnStatus>(
    `/api/chat/sessions/${encodeURIComponent(session.id)}/turn-status`,
  ).catch(() => ({ kind: 'none' as const }))
  return mapSessionToAgent(session, status)
}

export async function listProjects(): Promise<ProjectItem[]> {
  const rows = await request<ProjectRow[]>('/api/projects')
  return Promise.all(
    rows.map(async (row) => {
      const sessions = await request<SessionRow[]>(
        `/api/chat/sessions?project=${encodeURIComponent(row.id)}`,
      )
      const agents = await Promise.all(sessions.map(loadAgent))
      return mapProjectRow(row, agents)
    }),
  )
}

export async function chooseProject(): Promise<ProjectItem | null> {
  const response = await fetch('/api/projects/choose', { method: 'POST' })
  const body = (await response.json()) as ProjectRow & { cancelled?: boolean; error?: string }
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`)
  return body.cancelled ? null : mapProjectRow(body)
}

export async function deleteProject(projectId: string): Promise<void> {
  const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
    method: 'DELETE',
  })
  const body = (await response.json().catch(() => null)) as { error?: string } | null
  if (!response.ok) throw new Error(body?.error || `Request failed (${response.status})`)
}
