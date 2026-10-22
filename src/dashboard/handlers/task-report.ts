import { appendTaskReport, type TaskReportData } from '../../db/chat-sessions.ts'
import { listRunsByTaskId } from '../../db/runs.ts'
import { db } from '../../db/sqlite.ts'
import { deleteTaskRunWatch, type TaskRunWatchRow } from '../../db/task-run-watch.ts'
import { actionApprovalPolicy } from '../../run/executors/cli-registry.ts'
import { taskEngineForCli } from '../../run/executors/task-engines.ts'
import { MAX_RETRIES } from '../../run/qa.ts'
import { DIRTY_TREE_REASON_PREFIX, listDirtyFiles } from '../../run/sandbox-policy.ts'
import { loadTasks } from '../../tasks/loader.ts'

export function reportTaskOutcome(
  root: string,
  sessionId: string,
  taskId: string,
  projectId?: string | null,
): void {
  try {
    const report = buildTaskReportData(root, taskId, projectId)
    appendTaskReport(sessionId, taskId, report.content, report.data)
  } catch (error) {
    console.error('Could not report task outcome', error)
  }
}

function buildTaskReportData(
  root: string,
  taskId: string,
  projectId?: string | null,
): { content: string; data: TaskReportData } {
  const task = loadTasks(root).tasks.find((item) => item.id === taskId)
  const status = task?.status ?? 'missing'
  if (status === 'pending' && task?.retry_reason?.startsWith(DIRTY_TREE_REASON_PREFIX)) {
    return {
      content: `✗ Task \`${taskId}\` not started · uncommitted changes in the project`,
      data: { outcome: status, dirtyFiles: listDirtyFiles(root) },
    }
  }
  const runs = listRunsByTaskId(taskId)
  const run = projectId
    ? (runs.find((item) => item.project_id === projectId) ?? runs[0] ?? null)
    : (runs[0] ?? null)
  const providerModel = run ? ` · ${run.provider}/${run.model}` : ''
  const headline =
    status === 'done'
      ? `✓ Task \`${taskId}\` done${providerModel}`
      : status === 'pending'
        ? task?.retry_count
          ? `✗ Task \`${taskId}\` failed · attempt ${task.retry_count}/${MAX_RETRIES}${providerModel}`
          : `✗ Task \`${taskId}\` pending${providerModel}`
        : `✗ Task \`${taskId}\` ${status}${providerModel}`
  const rawSummary = (status === 'done' ? run?.result : (task?.retry_reason ?? run?.result))
    ?.replace(/\s+/g, ' ')
    .trim()
  const summary =
    rawSummary && rawSummary.length > 300 ? `${rawSummary.slice(0, 299)}…` : rawSummary
  const attempt =
    status === 'pending' && task?.retry_count
      ? { attempt: task.retry_count, maxAttempts: MAX_RETRIES }
      : {}
  return {
    content: `${headline}\n\n> ${summary || 'No run was recorded.'}`,
    data: {
      outcome: status,
      ...(run && task?.approvalMode
        ? actionApprovalPolicy(
            task.engine ?? taskEngineForCli(run.provider)?.engineId ?? 'single-shot',
            task.approvalMode,
          )
        : {}),
      ...attempt,
      ...(run ? { provider: run.provider, model: run.model, runId: run.id } : {}),
      summary: summary || 'No run was recorded.',
    },
  }
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
        const report = buildTaskReportData(row.root, row.task_id, row.project_id)
        appendReport(row.session_id, row.task_id, report.content, report.data)
      }
    }).immediate()
  } catch (error) {
    console.error('Could not settle task run', error)
  }
}
