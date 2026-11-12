import type { AgentSession, ProjectItem } from '../types/orchestos'
import { getConfig } from './settings'

export interface ProjectRow {
  id: string
  path: string
  displayName?: string | null
  icon?: string | null
  baseBranch?: string | null
  setupScript?: string | null
  stackProfile: string
  lastUpdated: string
  branch?: string
}

export interface SessionRow {
  id: string
  projectId: string | null
  agent: string
  mode: 'chat' | 'code'
  title: string
  createdAt: string
  updatedAt: string
  lastModel?: string | null
  lastEffort?: string | null
}

export interface TurnStatus {
  kind: 'none' | 'pending' | 'failed' | 'interrupted'
}

async function request<T>(
  path: string,
  headers: HeadersInit = {},
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(path, { headers, signal })
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
    name: row.displayName ?? basename(row.path),
    ...(row.displayName !== undefined ? { displayName: row.displayName } : {}),
    ...(row.icon !== undefined ? { icon: row.icon } : {}),
    ...(row.baseBranch !== undefined ? { baseBranch: row.baseBranch } : {}),
    ...(row.setupScript !== undefined ? { setupScript: row.setupScript } : {}),
    ...(row.branch ? { branch: row.branch } : {}),
    path: row.path,
    filesCount: 0,
    agents,
  }
}

export function mapSessionToAgent(
  session: SessionRow,
  status: TurnStatus = { kind: 'none' },
  orchestrator?: { agent: string; model: string; effort?: string } | null,
): AgentSession {
  const assignment =
    !session.lastModel && orchestrator?.agent === session.agent ? orchestrator : undefined
  return {
    id: session.id,
    projectId: session.projectId ?? null,
    name: session.title,
    agent: session.agent,
    model: assignment?.model || session.lastModel || session.agent,
    ...(assignment?.effort || session.lastEffort
      ? { effort: assignment?.effort || session.lastEffort }
      : {}),
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

async function loadAgent(
  session: SessionRow,
  orchestrator?: { agent: string; model: string; effort?: string } | null,
): Promise<AgentSession> {
  const path = `/api/chat/sessions/${encodeURIComponent(session.id)}/turn-status`
  const scope = session.projectId
    ? { query: '', headers: { 'x-orchestos-project-id': session.projectId } }
    : { query: '?project=none', headers: {} }
  const status = await request<TurnStatus>(`${path}${scope.query}`, scope.headers).catch(() => ({
    kind: 'none' as const,
  }))
  return mapSessionToAgent(session, status, orchestrator)
}

export async function listProjects(): Promise<ProjectItem[]> {
  const rows = await request<ProjectRow[]>('/api/projects')
  return Promise.all(
    rows.map(async (row) => {
      const sessions = await request<SessionRow[]>(
        `/api/chat/sessions?project=${encodeURIComponent(row.id)}`,
      )
      const config = await getConfig(row.id).catch(() => null)
      const agents = await Promise.all(
        sessions.map((session) => loadAgent(session, config?.roleAssignments?.orchestrator)),
      )
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

export async function cloneProject(url: string, parentDir: string): Promise<ProjectItem> {
  const response = await fetch('/api/projects/clone', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, parentDir }),
  })
  const body = (await response.json()) as ProjectRow & { error?: string }
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`)
  return mapProjectRow(body)
}

export async function cloneLocation(choose = false): Promise<string | null> {
  const response = await fetch('/api/projects/clone-location', { method: choose ? 'POST' : 'GET' })
  const body = (await response.json()) as { parentDir?: string; error?: string }
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`)
  return body.parentDir ?? null
}

export async function deleteProject(projectId: string): Promise<void> {
  const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
    method: 'DELETE',
  })
  const body = (await response.json().catch(() => null)) as { error?: string } | null
  if (!response.ok) throw new Error(body?.error || `Request failed (${response.status})`)
}

export async function purgeProjectData(projectId: string): Promise<void> {
  const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/purge`, {
    method: 'POST',
  })
  const body = (await response.json().catch(() => null)) as { error?: string } | null
  if (!response.ok) throw new Error(body?.error || `Request failed (${response.status})`)
}

export type ProjectSettingsPatch = Partial<
  Pick<ProjectRow, 'displayName' | 'icon' | 'baseBranch' | 'setupScript'>
>

export async function patchProject(
  projectId: string,
  settings: ProjectSettingsPatch,
): Promise<ProjectItem> {
  const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  })
  const body = (await response.json()) as ProjectRow & { error?: string }
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`)
  return mapProjectRow(body)
}

export async function projectBranches(projectId: string, signal?: AbortSignal): Promise<string[]> {
  return (
    await request<{ branches: string[] }>(
      `/api/projects/${encodeURIComponent(projectId)}/branches`,
      {},
      signal,
    )
  ).branches
}
