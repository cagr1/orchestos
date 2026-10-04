import { appendTaskReport } from '../../db/chat-sessions.ts'
import { listRunsByTaskId } from '../../db/runs.ts'
import { loadTasks } from '../../tasks/loader.ts'

export function reportTaskOutcome(
  root: string,
  sessionId: string,
  taskId: string,
  projectId?: string | null,
): void {
  try {
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
    appendTaskReport(sessionId, taskId, `${headline}\n\n> ${summary || 'No run was recorded.'}`)
  } catch (error) {
    console.error('Could not report task outcome', error)
  }
}
