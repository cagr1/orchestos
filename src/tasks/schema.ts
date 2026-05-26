export type TaskStatus = 'pending' | 'running' | 'done' | 'failed' | 'failed_permanent' | 'blocked'

export interface Task {
  id: string              // kebab-case, unique within file
  description: string
  skill?: string          // skill id from skills/
  input: string[]         // files the LLM can read (relative to project root)
  output: string[]        // files the LLM is allowed to write — REQUIRED, must be non-empty
  depends_on: string[]    // task ids that must be done first
  status: TaskStatus
  retry_count: number
  retry_reason?: string   // last QA fail reason
  qa_verdict?: 'pass' | 'fail'
  run_id?: string         // last SQLite run id
}

export interface TasksFile {
  version: 1
  project: string
  tasks: Task[]
}

export function validateTask(t: unknown, index: number): Task {
  const err = (msg: string) => { throw new Error(`tasks.yaml[${index}]: ${msg}`) }
  const task = t as Record<string, unknown>

  if (!task.id || typeof task.id !== 'string') err('missing "id"')
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(task.id as string)) err(`id must be kebab-case, got: ${task.id}`)
  if (!task.description || typeof task.description !== 'string') err('missing "description"')
  if (!Array.isArray(task.output) || (task.output as unknown[]).length === 0) err('"output" must be a non-empty array — this is the contract')

  return {
    id:           task.id as string,
    description:  task.description as string,
    skill:        typeof task.skill === 'string' ? task.skill : undefined,
    input:        Array.isArray(task.input) ? task.input as string[] : [],
    output:       task.output as string[],
    depends_on:   Array.isArray(task.depends_on) ? task.depends_on as string[] : [],
    status:       (task.status as TaskStatus) ?? 'pending',
    retry_count:  typeof task.retry_count === 'number' ? task.retry_count : 0,
    retry_reason: typeof task.retry_reason === 'string' ? task.retry_reason : undefined,
    qa_verdict:   task.qa_verdict as 'pass' | 'fail' | undefined,
    run_id:       typeof task.run_id === 'string' ? task.run_id : undefined,
  }
}

export function validateTasksFile(raw: unknown): TasksFile {
  const f = raw as Record<string, unknown>
  if (!f.project || typeof f.project !== 'string') throw new Error('tasks.yaml: missing "project"')
  if (!Array.isArray(f.tasks)) throw new Error('tasks.yaml: missing "tasks" array')

  const tasks = (f.tasks as unknown[]).map((t, i) => validateTask(t, i))

  // check duplicate ids
  const ids = tasks.map(t => t.id)
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i)
  if (dupes.length > 0) throw new Error(`tasks.yaml: duplicate task ids: ${dupes.join(', ')}`)

  return { version: 1, project: f.project as string, tasks }
}
