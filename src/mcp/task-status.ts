import { existsSync } from 'node:fs'
import { check, z } from '../boundary/index.ts'
import type { RunRecord } from '../db/runs.ts'
import { loadTasks, tasksPath } from '../tasks/loader.ts'
import type { TasksFile } from '../tasks/schema.ts'

export const LIST_TASKS_TOOL = 'list_tasks'
export const GET_TASK_STATUS_TOOL = 'get_task_status'
export const TASK_STATUS_TOOLS = [LIST_TASKS_TOOL, GET_TASK_STATUS_TOOL] as const

export const LIST_TASKS_DEFINITION = {
  description:
    "List this project's tasks with their status and latest run. Read-only. Use it to check whether a task you proposed was created and started.",
  inputSchema: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        enum: ['pending', 'running', 'done', 'failed', 'failed_permanent', 'blocked'],
      },
    },
    additionalProperties: false,
  },
} as const

export const GET_TASK_STATUS_DEFINITION = {
  description:
    'Show one task of this project: status, outputs, QA verdict, last failure reason and its latest runs. Read-only.',
  inputSchema: {
    type: 'object',
    properties: { task_id: { type: 'string', minLength: 1, maxLength: 100 } },
    required: ['task_id'],
    additionalProperties: false,
  },
} as const

type RunView = Pick<
  RunRecord,
  'id' | 'status' | 'created_at' | 'model' | 'qa_verdict' | 'qa_reason' | 'failure_kind' | 'result'
>
export type RunsReader = (root: string, taskId: string) => RunView[]

export function runsReaderFor(
  projectId: string | null,
  list: (taskId: string, projectId: string) => RunView[],
): RunsReader {
  return (_root, taskId) => (projectId ? list(taskId, projectId) : [])
}

const defaultReader: RunsReader = (root, taskId) => {
  const { getProject } = require('../db/projects.ts') as typeof import('../db/projects.ts')
  const { listRunsByTaskId } = require('../db/runs.ts') as typeof import('../db/runs.ts')
  const projectId = getProject(root)?.id ?? null
  return runsReaderFor(projectId, listRunsByTaskId)(root, taskId)
}

const listSchema = z
  .object({
    status: z
      .enum(['pending', 'running', 'done', 'failed', 'failed_permanent', 'blocked'])
      .optional(),
  })
  .strict()
const getSchema = z.object({ task_id: z.string().trim().min(1).max(100) }).strict()
const clean = (value: string, max: number) => value.replace(/\s+/g, ' ').slice(0, max)
const taskRunSummary = (run?: RunView) =>
  run
    ? `last run ${run.id} ${run.status}${run.qa_verdict ? ` · QA ${run.qa_verdict}` : ''}${run.failure_kind ? ` · failure: ${run.failure_kind}` : ''} · ${run.model} · ${run.created_at}`
    : 'no run yet'

export function listTasks(
  input: unknown,
  root: string,
  reader: RunsReader = defaultReader,
): { text: string; isError: boolean } {
  const parsed = check(listSchema, input ?? {})
  if (!parsed.ok) return { text: parsed.error, isError: true }
  if (!existsSync(tasksPath(root)))
    return { text: 'This project has no tasks yet: no task was ever created here.', isError: false }
  let tasks: TasksFile['tasks']
  try {
    tasks = loadTasks(root).tasks
  } catch (error) {
    return {
      text: `Could not read tasks.yaml: ${error instanceof Error ? error.message : String(error)}`,
      isError: true,
    }
  }
  const filtered = tasks.filter((task) => !parsed.data.status || task.status === parsed.data.status)
  const shown = filtered.slice(-50)
  const lines = shown.map((task) => {
    let runText = ''
    try {
      runText = taskRunSummary(reader(root, task.id)[0])
    } catch (error) {
      runText = `run history unavailable: ${error instanceof Error ? error.message : String(error)}`
    }
    return `- ${task.id} [${task.status}] ${clean(task.description, 120)} · outputs: ${task.output.join(', ')} · ${runText}`
  })
  return {
    text: `${filtered.length > 50 ? `${filtered.length} tasks, showing the last 50:` : `${filtered.length} task(s):`}${lines.length ? `\n${lines.join('\n')}` : ''}`,
    isError: false,
  }
}

export function getTaskStatus(
  input: unknown,
  root: string,
  reader: RunsReader = defaultReader,
): { text: string; isError: boolean } {
  const parsed = check(getSchema, input)
  if (!parsed.ok) return { text: parsed.error, isError: true }
  let tasks: TasksFile['tasks']
  try {
    tasks = loadTasks(root).tasks
  } catch (error) {
    if (!existsSync(tasksPath(root)))
      return {
        text: `No task with id ${parsed.data.task_id} in this project: it was not created. Call list_tasks to see the ids.`,
        isError: false,
      }
    return {
      text: `Could not read tasks.yaml: ${error instanceof Error ? error.message : String(error)}`,
      isError: true,
    }
  }
  const task = tasks.find((item) => item.id === parsed.data.task_id)
  if (!task)
    return {
      text: `No task with id ${parsed.data.task_id} in this project: it was not created. Call list_tasks to see the ids.`,
      isError: false,
    }
  const lines = [
    `Task ${task.id}: ${task.status}`,
    `Description: ${clean(task.description, 600)}`,
    `Outputs: ${task.output.join(', ')}`,
  ]
  if (task.acceptance_criteria?.length)
    lines.push(`Acceptance criteria: ${task.acceptance_criteria.length}`)
  if (task.depends_on?.length) lines.push(`Depends on: ${task.depends_on.join(', ')}`)
  lines.push(`Retries: ${task.retry_count}`)
  if (task.qa_verdict) lines.push(`QA verdict: ${task.qa_verdict}`)
  if (task.retry_reason) lines.push(`Last failure reason: ${clean(task.retry_reason, 600)}`)
  try {
    const runs = reader(root, task.id)
    if (!runs.length && task.status === 'pending')
      lines.push(
        'Runs: none yet. A pending task without runs is waiting to start or for the user to approve it in its task card.',
      )
    else {
      lines.push(`Runs (latest ${Math.min(5, runs.length)} of ${runs.length}):`)
      for (const run of runs.slice(0, 5)) {
        lines.push(
          `- ${run.id} [${run.status}] · ${run.model} · ${run.created_at}${run.qa_verdict ? ` · QA ${run.qa_verdict}` : ''}${run.failure_kind ? ` · failure: ${run.failure_kind}` : ''}`,
        )
        if (run.qa_reason) lines.push(`  QA reason: ${clean(run.qa_reason, 400)}`)
        if (run.status !== 'done' && run.result) lines.push(`  Result: ${clean(run.result, 400)}`)
      }
    }
  } catch (error) {
    lines.push(`run history unavailable: ${error instanceof Error ? error.message : String(error)}`)
  }
  return { text: lines.join('\n'), isError: false }
}
