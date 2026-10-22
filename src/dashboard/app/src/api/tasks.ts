import type { TaskItem, TaskStatus } from '../types/orchestos'

export interface TaskRowResponse {
  id: string
  description: string
  status: TaskStatus
  retryReason: string | null
  skill: string | null
  assignedAgent: string | null
  assignedModel: string | null
  retryCount: number
  qaVerdict: 'pass' | 'fail' | null
  runId: string | null
  pendingApprovals: number
  sessionId: string | null
  lastRunAt?: string | null
  engine: TaskItem['engine'] | null
  output: string[]
  dependsOn: string[]
  acceptanceCriteria: string[]
  executorModel: string | null
}

export interface TasksResponse {
  exists: boolean
  tasks: TaskItem[]
  error?: string
}

function mapTask(row: TaskRowResponse): TaskItem {
  return {
    id: row.id,
    description: row.description,
    status: row.status,
    output: row.output,
    outputSlice: row.output,
    assignedAgent: [row.assignedAgent, row.assignedModel].filter(Boolean).join(' · '),
    depends_on: row.dependsOn,
    acceptance_criteria: row.acceptanceCriteria,
    retryCount: row.retryCount,
    retryReason: row.retryReason,
    qaVerdict: row.qaVerdict,
    runId: row.runId,
    pendingApprovals: row.pendingApprovals ?? 0,
    sessionId: row.sessionId ?? null,
    lastRunAt: row.lastRunAt ?? null,
    skill: row.skill,
    engine: row.engine || 'single-shot',
  }
}

export async function listTasks(
  projectId?: string | null,
  signal?: AbortSignal,
): Promise<TasksResponse> {
  const response = await fetch(projectId ? '/api/tasks' : '/api/tasks?project=none', {
    headers: projectId ? { 'x-orchestos-project-id': projectId } : {},
    signal,
  })
  const body = (await response.json().catch(() => null)) as {
    exists?: boolean
    tasks?: TaskRowResponse[]
    error?: string
  } | null
  if (!response.ok) throw new Error(body?.error || `Request failed (${response.status})`)
  return {
    exists: body?.exists ?? false,
    tasks: (body?.tasks ?? []).map(mapTask),
    error: body?.error,
  }
}

/** Espejo de `DIRTY_TREE_REASON_PREFIX` (src/run/sandbox-policy.ts): el front no importa código del run. */
export const DIRTY_TREE_REASON_PREFIX = 'uncommitted changes: '

/** `running`, o `pending` cuyo intento aún no falló; un `pending` con intento fallido ya terminó. */
export function isTaskStillRunning(task: {
  status: TaskStatus | string
  retryCount?: number | null
  retryReason?: string | null
}): boolean {
  if (task.status === 'running') return true
  // ERP.4.13: bloqueada por árbol sucio — no hubo intento, pero ya terminó
  if (task.status === 'pending' && task.retryReason?.startsWith(DIRTY_TREE_REASON_PREFIX))
    return false
  return task.status === 'pending' && !((task.retryCount ?? 0) > 0 && Boolean(task.retryReason))
}

export type TaskPollAction = 'resolve' | 'running' | 'load'

/**
 * Qué hacer con un intento cuyo reporte espera el hilo abierto. `localCount` = mensajes del hilo local
 * con ese `taskId`; `seenRunning` = se la vio corriendo en esta sesión de página.
 */
export function decideTaskPollAction(input: {
  task:
    | {
        status: TaskStatus | string
        retryCount?: number | null
        retryReason?: string | null
      }
    | undefined
  localCount: number
  seenRunning: boolean
}): TaskPollAction {
  if (!input.task) return 'resolve'
  if (isTaskStillRunning(input.task)) return 'running'
  if (input.localCount > 1 && !input.seenRunning) return 'resolve'
  return 'load'
}

const TASK_REPORT_MAX_ATTEMPTS = 6

/** Tras cargar el hilo: fusionar si el servidor trae más mensajes de la tarea; si no, contar y rendirse al sexto. */
export function resolveTaskReportPoll(input: {
  localCount: number
  serverCount: number
  attempts: number
}): {
  merge: boolean
  resolved: boolean
  attempts: number
} {
  if (input.serverCount > input.localCount) return { merge: true, resolved: true, attempts: 0 }
  const attempts = input.attempts + 1
  return { merge: false, resolved: attempts >= TASK_REPORT_MAX_ATTEMPTS, attempts }
}

export function getRunnableTask(tasks: TaskItem[]): TaskItem | undefined {
  return tasks.find(
    (task) =>
      task.status === 'pending' &&
      task.depends_on.every((dependencyId) =>
        tasks.some((item) => item.id === dependencyId && item.status === 'done'),
      ),
  )
}

/** Una tarea se puede lanzar por id si está `pending` o `failed` y todas sus dependencias están `done`. */
export function isTaskRunnable(task: TaskItem, tasks: TaskItem[]): boolean {
  return (
    (task.status === 'pending' || task.status === 'failed') &&
    task.depends_on.every((dependencyId) =>
      tasks.some((item) => item.id === dependencyId && item.status === 'done'),
    )
  )
}

export async function runTask(
  taskId: string,
  projectId: string,
  onTasks: (tasks: TaskItem[]) => void,
): Promise<void> {
  const beforeRun = await listTasks(projectId)
  const taskBeforeRun = beforeRun.tasks.find((task) => task.id === taskId)
  if (!taskBeforeRun) throw new Error(`Task ${taskId} disappeared before starting`)
  const initialRetryCount = taskBeforeRun.retryCount
  const initialRunId = taskBeforeRun.runId ?? null

  const response = await fetch(`/api/tasks/${encodeURIComponent(taskId)}/run`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-orchestos-project-id': projectId,
    },
    body: JSON.stringify({}),
  })
  const body = (await response.json().catch(() => null)) as { error?: string } | null
  if (!response.ok) throw new Error(body?.error || `Request failed (${response.status})`)

  const deadline = Date.now() + 10 * 60_000
  let latest: TaskItem | undefined
  while (Date.now() <= deadline) {
    const result = await listTasks(projectId)
    onTasks(result.tasks)
    latest = result.tasks.find((task) => task.id === taskId)
    if (!latest) throw new Error(`Task ${taskId} disappeared after starting`)
    if (latest.status === 'pending' && latest.retryReason?.startsWith(DIRTY_TREE_REASON_PREFIX)) {
      throw new Error(latest.retryReason)
    }
    const statusFinished = latest.status !== 'pending' && latest.status !== 'running'
    const retryChanged = latest.retryCount !== initialRetryCount
    const runChanged = (latest.runId ?? null) !== initialRunId
    // A run id can be allocated while the executor is still running (approvals).
    // Only a pending task with a new attempt, or a terminal status, ends this wait.
    if (statusFinished || (latest.status === 'pending' && (retryChanged || runChanged))) {
      if (latest.status === 'pending' && latest.retryReason && (retryChanged || runChanged)) {
        throw new Error(`Retry scheduled: ${latest.retryReason}`)
      }
      if (latest.status === 'failed' || latest.status === 'failed_permanent') {
        throw new Error(latest.retryReason || `Task ${taskId} failed`)
      }
      return
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000))
  }
  throw new Error(latest?.retryReason || `Task ${taskId} remained pending after 10 minutes`)
}
