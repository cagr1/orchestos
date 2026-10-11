import { appendTaskReport } from '../../db/chat-sessions.ts'
import { listRunsByTaskId } from '../../db/runs.ts'
import { db } from '../../db/sqlite.ts'
import { deleteTaskRunWatch, type TaskRunWatchRow } from '../../db/task-run-watch.ts'
import { loadTasks } from '../../tasks/loader.ts'

export function reportTaskOutcome(
  root: string,
  sessionId: string,
  taskId: string,
  projectId?: string | null,
): void {
  try {
    appendTaskReport(sessionId, taskId, buildTaskReport(root, taskId, projectId))
  } catch (error) {
    console.error('Could not report task outcome', error)
  }
}

export function buildTaskReport(root: string, taskId: string, projectId?: string | null): string {
  const task = loadTasks(root).tasks.find((item) => item.id === taskId)
  const status = task?.status ?? 'missing'
  const runs = listRunsByTaskId(taskId)
  const run = projectId
    ? (runs.find((item) => item.project_id === projectId) ?? runs[0] ?? null)
    : (runs[0] ?? null)
  const providerModel = run ? ` · ${run.provider}/${run.model}` : ''
  const headline =
    status === 'done'
      ? `✓ Task \`${taskId}\` done${providerModel}`
      : status === 'pending'
        ? `⟳ Task \`${taskId}\` pending · retry scheduled`
        : `✗ Task \`${taskId}\` ${status}${providerModel}`
  const rawSummary = (status === 'done' ? run?.result : (task?.retry_reason ?? run?.result))
    ?.replace(/\s+/g, ' ')
    .trim()
  const summary =
    rawSummary && rawSummary.length > 300 ? `${rawSummary.slice(0, 299)}…` : rawSummary
  return `${headline}\n\n> ${summary || 'No run was recorded.'}`
}

/** Reclama y cierra únicamente el lanzamiento representado por esta fila. */
export function settleTaskRun(
  row: TaskRunWatchRow,
  appendReport: typeof appendTaskReport = appendTaskReport,
): void {
  try {
    db.transaction(() => {
      if (!deleteTaskRunWatch(row)) return
      if (row.session_id) {
        appendReport(
          row.session_id,
          row.task_id,
          buildTaskReport(row.root, row.task_id, row.project_id),
        )
      }
    }).immediate()
  } catch (error) {
    console.error('Could not settle task run', error)
  }
}
