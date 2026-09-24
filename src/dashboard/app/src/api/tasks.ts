import type { TaskItem, TaskStatus } from '../types/orchestos'

export interface TaskRowResponse {
  id: string
  description: string
  status: TaskStatus
  retryReason: string | null
  skill: string | null
  executor: string
  retryCount: number
  qaVerdict: 'pass' | 'fail' | null
  runId: string | null
  engine: TaskItem['engine'] | null
  output: string[]
  dependsOn: string[]
  acceptanceCriteria: string[]
  executorModel: string | null
  hasSplitPlan: boolean
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
    assignedAgent: [row.engine || row.executor, row.executorModel].filter(Boolean).join(' · '),
    depends_on: row.dependsOn,
    acceptance_criteria: row.acceptanceCriteria,
    retryCount: row.retryCount,
    retryReason: row.retryReason,
    qaVerdict: row.qaVerdict,
    runId: row.runId,
    engine: row.engine || 'single-shot',
  }
}

export async function listTasks(
  projectId?: string | null,
  signal?: AbortSignal,
): Promise<TasksResponse> {
  const response = await fetch('/api/tasks', {
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

export function getRunnableTask(tasks: TaskItem[]): TaskItem | undefined {
  return tasks.find(
    (task) =>
      task.status === 'pending' &&
      task.depends_on.every((dependencyId) =>
        tasks.some((item) => item.id === dependencyId && item.status === 'done'),
      ),
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
    const statusFinished = latest.status !== 'pending' && latest.status !== 'running'
    const retryChanged = latest.retryCount !== initialRetryCount
    const runChanged = (latest.runId ?? null) !== initialRunId
    if (statusFinished || retryChanged || runChanged) {
      if (
        latest.status === 'pending' &&
        latest.retryReason &&
        (retryChanged || latest.retryReason !== taskBeforeRun.retryReason)
      ) {
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
