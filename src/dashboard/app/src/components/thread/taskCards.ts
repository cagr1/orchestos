import type { PendingApproval } from '../../api/runs'
import type { ChatMessage, ChatThread, ProjectItem, TaskItem } from '../../types/orchestos'

export type TaskCardState = 'held' | 'running' | 'failed' | 'blocked' | 'pending' | 'done'

export interface TaskCardReport {
  messageId: string
  state: TaskCardState
  attempt?: number
  maxAttempts?: number
  model?: string
  summary?: string
  content: string
  dirtyFiles: string[]
  runId?: string | null
  approvalMode?: 'supervised' | 'auto-edit' | 'full'
  requestedApprovalMode?: 'supervised' | 'auto-edit' | 'full'
  approvalCli?: string
}

export interface TaskCardData {
  taskId: string
  anchorId: string
  /** Descripción completa de la tarea ('' si no se conoce). */
  description: string
  reports: TaskCardReport[]
  state: TaskCardState
  /** Id del mensaje que lleva el estado de acción (último reporte o ancla). */
  actionKey: string
  /** Texto del ancla sin el aviso "Created task `id`…" (el id vive en la tarjeta). */
  anchorText: string
  /** El texto del ancla se dibuja aparte solo si aporta algo distinto de la tarjeta. */
  showAnchorText: boolean
}

export interface TaskCards {
  byTask: Map<string, TaskCardData>
  /** Mensajes que alimentan una tarjeta y no se dibujan como burbuja. */
  hidden: Set<string>
}

function reportState(report: NonNullable<ChatMessage['taskReport']>, content: string) {
  if (report.outcome === 'done') return 'done' as const
  if (report.outcome === 'pending') {
    if ((report.dirtyFiles?.length ?? 0) > 0) return 'blocked' as const
    if (report.attempt !== undefined || /failed · attempt/.test(content)) return 'failed' as const
    return 'pending' as const
  }
  return 'failed' as const
}

function stripCreatedNotice(content: string, taskId: string): string {
  return content
    .replace(/\s*(?:⏸ Created task|▶ (?:Started task|Run requested for task))[^\n]*$/, '')
    .replaceAll(`\`${taskId}\``, '')
    .trim()
}

/** Agrupa los mensajes con `taskId`: una tarjeta por tarea, anclada al primer mensaje. */
export function buildTaskCards(
  messages: ChatMessage[],
  busyMessageIds: Record<string, boolean> = {},
): TaskCards {
  const byTask = new Map<string, TaskCardData>()
  const hidden = new Set<string>()
  const anchors = new Map<string, ChatMessage>()
  const reports = new Map<string, TaskCardReport[]>()

  for (const message of messages) {
    if (!message.taskId) continue
    if (!anchors.has(message.taskId)) anchors.set(message.taskId, message)
    if (!message.taskReport) continue
    const list = reports.get(message.taskId) ?? []
    list.push({
      messageId: message.id,
      state: reportState(message.taskReport, message.content),
      attempt: message.taskReport.attempt,
      maxAttempts: message.taskReport.maxAttempts,
      model:
        message.taskReport.provider && message.taskReport.model
          ? `${message.taskReport.provider}/${message.taskReport.model}`
          : undefined,
      summary: message.taskReport.summary,
      approvalMode: message.taskReport.approvalMode,
      requestedApprovalMode: message.taskReport.requestedApprovalMode,
      approvalCli: message.taskReport.approvalCli,
      content: message.content,
      dirtyFiles: message.taskReport.dirtyFiles ?? [],
      runId: message.taskReport.runId,
    })
    reports.set(message.taskId, list)
    if (anchors.get(message.taskId)?.id !== message.id) hidden.add(message.id)
  }

  for (const [taskId, anchor] of anchors) {
    const list = reports.get(taskId) ?? []
    // Tarea rechazada sin reportes: no hay tarjeta, el texto del orquestador es un mensaje normal.
    if (anchor.taskDeleted && list.length === 0) continue
    const last = list.at(-1)
    const anchorIsReport = Boolean(anchor.taskReport)
    const anchorText = anchorIsReport ? '' : stripCreatedNotice(anchor.content, taskId)
    // Solo la descripción real de la tarea (proposedTask o taskDescription que pone App); `heldTask` y el
    // texto del ancla son el mensaje del orquestador, no la descripción: no se usan de respaldo.
    const description = stripCreatedNotice(
      anchor.proposedTask?.description ?? anchor.taskDescription ?? '',
      taskId,
    )
    const actionKey = last?.messageId ?? anchor.id
    let state: TaskCardState
    if (busyMessageIds[actionKey]) state = 'running'
    else if (last) state = last.state
    else state = anchor.taskHeld && anchor.proposedTask ? 'held' : 'running'
    byTask.set(taskId, {
      taskId,
      anchorId: anchor.id,
      description,
      reports: list,
      state,
      actionKey,
      anchorText,
      showAnchorText: anchorText !== '' && anchorText !== description.trim(),
    })
  }
  return { byTask, hidden }
}

/** Primera línea sin markdown, cortada a `max` caracteres con `…`. */
export function taskName(description: string, max = 60): string {
  const line =
    description
      .split('\n')
      .map((item) => item.trim())
      .find(Boolean) ?? ''
  const plain = line
    .replace(/^(?:#{1,6}\s+|[-*+]\s+|>\s+|\d+[.)]\s+)/, '')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[`*_~]/g, '')
    .trim()
  if (!plain) return 'Task'
  return plain.length > max ? `${plain.slice(0, max - 1).trimEnd()}…` : plain
}

/** Texto secundario: omite la primera línea si coincide con el nombre sin truncar. */
export function taskDetail(description: string, max = 60): string {
  const firstLine =
    description
      .split('\n')
      .map((item) => item.trim())
      .find(Boolean) ?? ''
  const plain = firstLine
    .replace(/^(?:#{1,6}\s+|[-*+]\s+|>\s+|\d+[.)]\s+)/, '')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[`*_~]/g, '')
    .trim()
  if (!plain) return description.trim()
  if (plain.length > max) return description.trim()
  return description.slice(description.indexOf(firstLine) + firstLine.length).trim()
}

/** Remove an OrchestOS worktree root from a path when the path is inside one. */
export function taskWorktreeRelativePath(path: string): string {
  return path.replace(/^.*\/\.orchestos\/worktrees\/[^/]+\//, '')
}

/** Preserve the server's request order and full command/diff text. */
export function approvalBlocks(pending: PendingApproval[]) {
  return pending.map((request) => ({
    ...request,
    label: request.kind === 'command' ? 'Command' : 'Edit',
    files: request.kind === 'edit' ? (request.detail.files ?? []) : [],
  }))
}

/** Only the selected project's session ids participate; never mutate the stored agent status. */
export function projectsWithApprovals(
  projects: ProjectItem[],
  projectId: string | undefined,
  tasks: TaskItem[],
): ProjectItem[] {
  const waiting = new Set(
    tasks
      .filter((task) => task.status === 'running' && (task.pendingApprovals ?? 0) > 0)
      .map((task) => task.sessionId)
      .filter(Boolean),
  )
  return projects.map((project) =>
    project.id !== projectId
      ? project
      : {
          ...project,
          agents: project.agents.map((agent) =>
            waiting.has(agent.id) ? { ...agent, status: 'waiting_approval' as const } : agent,
          ),
        },
  )
}

/** Session ids come from task_run_watch, scoped to each polled project. */
export function threadsWithApprovals(
  threads: ChatThread[],
  sources: { projectId: string | null | undefined; tasks: TaskItem[] }[],
): ChatThread[] {
  return threads.map((thread) => {
    const waiting = sources.some(
      (source) =>
        source.projectId === thread.projectId &&
        source.tasks.some(
          (task) =>
            task.sessionId === thread.id &&
            task.status === 'running' &&
            (task.pendingApprovals ?? 0) > 0,
        ),
    )
    return waiting ? { ...thread, status: 'waiting_approval' } : thread
  })
}

export function approvalModeNotice(
  report?: Pick<TaskCardReport, 'approvalMode' | 'requestedApprovalMode' | 'approvalCli'>,
): string | null {
  return report?.approvalMode === 'full' &&
    report.requestedApprovalMode &&
    report.requestedApprovalMode !== report.approvalMode &&
    report.approvalCli
    ? `Full access: ${report.approvalCli} can't ask per action yet`
    : null
}
