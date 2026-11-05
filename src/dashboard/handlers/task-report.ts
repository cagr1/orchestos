import { appendTaskReport, type TaskReportData } from '../../db/chat-sessions.ts'
import { listRunsByTaskId } from '../../db/runs.ts'
import { db } from '../../db/sqlite.ts'
import { deleteTaskRunWatch, type TaskRunWatchRow } from '../../db/task-run-watch.ts'
import { actionApprovalPolicy } from '../../run/executors/cli-registry.ts'
import { taskEngineForCli } from '../../run/executors/task-engines.ts'
import { MAX_RETRIES } from '../../run/qa.ts'
import { DIRTY_TREE_REASON_PREFIX, listDirtyFiles } from '../../run/sandbox-policy.ts'
import { loadTasks } from '../../tasks/loader.ts'
import { runRecordToRow } from './runs.ts'
import { INTERRUPTED_REASON } from './task-run-reconcile.ts'

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

/** Bound UTF-8 bytes without cutting a code point; check output keeps its tail. */
function bounded(text: string, maxBytes: number, tail = false): string {
  const chars = Array.from(text)
  if (tail) chars.reverse()
  const kept: string[] = []
  let bytes = 0
  for (const char of chars) {
    bytes += Buffer.byteLength(char)
    if (bytes > maxBytes) break
    kept.push(char)
  }
  return (tail ? kept.reverse() : kept).join('')
}

/** Apply taskWorktreeRelativePath's worktree-root removal to paths embedded in prose. */
function relativeWorktreePaths(text: string): string {
  return text.replace(/\/[^\s"'`<>]*\/\.orchestos\/worktrees\/[^/\s]+\//g, '')
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
  // Sin identidad de proyecto, ningún run puede respaldar este reporte.
  const run = projectId ? (runs.find((item) => item.project_id === projectId) ?? null) : null
  const interrupted = status === 'failed' && task?.retry_reason === INTERRUPTED_REASON
  const evidence = run ? runRecordToRow(run) : null
  const rawCause = task?.retry_reason || evidence?.result
  const cause = rawCause ? relativeWorktreePaths(rawCause) : undefined
  const failedCheck = evidence?.checks.find((check) => check.exitCode !== 0 || check.timedOut)
  const checkOutput = failedCheck
    ? relativeWorktreePaths([failedCheck.stderr, failedCheck.stdout].filter(Boolean).join('\n'))
    : ''
  const qaReason = evidence?.qaReason ? relativeWorktreePaths(evidence.qaReason) : undefined
  const normalizedCause = cause?.replace(/\s+/g, ' ').trim()
  const normalizedQaReason = qaReason?.replace(/\s+/g, ' ').trim()
  const diagnosis =
    !interrupted && (status === 'failed' || (status === 'pending' && task?.retry_count))
      ? {
          ...(cause ? { cause: bounded(cause, 2048) } : {}),
          ...(failedCheck
            ? {
                failedCheck: {
                  command: bounded(relativeWorktreePaths(failedCheck.cmd), 2048),
                  ...(checkOutput ? { output: bounded(checkOutput, 2048, true) } : {}),
                },
              }
            : {}),
          ...(qaReason && normalizedQaReason && !normalizedCause?.includes(normalizedQaReason)
            ? { qaReasons: [bounded(qaReason, 2048)] }
            : {}),
          ...(evidence?.executorReply
            ? { executorReport: bounded(relativeWorktreePaths(evidence.executorReply), 1024) }
            : {}),
          ...(run ? { runId: run.id } : {}),
        }
      : undefined
  const verifiedDone = status === 'done' && run?.status === 'done'
  const outcome = status === 'done' && !verifiedDone ? (run?.status ?? 'pending') : status
  const providerModel = run ? ` · ${run.provider}/${run.model}` : ''
  const headline = verifiedDone
    ? `✓ Task \`${taskId}\` done${providerModel}`
    : status === 'done'
      ? `Task \`${taskId}\` marked done in tasks.yaml · ${run ? `latest run ${run.status}${providerModel}` : 'no matching run recorded'}`
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
      outcome,
      ...(interrupted ? { interrupted: true } : {}),
      ...(diagnosis && Object.keys(diagnosis).length ? { diagnosis } : {}),
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
