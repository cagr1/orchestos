export type TaskStatus = 'pending' | 'running' | 'done' | 'failed' | 'failed_permanent' | 'blocked'
export type TaskExecutor = 'openrouter' | 'anthropic' | 'openai' | 'codex'
// B.2 — 'external' es la tercera implementación de ExecutorEngine (B.1, docs/external-executor-design.md).
// Lanza el subproceso `claude -p` dentro del worktree; el harness aplica enforceContract post-hoc
// igual que con single-shot/agentic. Opt-in por tarea o por config de proyecto.
export type TaskEngine = 'single-shot' | 'agentic' | 'external' | 'opencode'
// Niveles reales del CLI de Claude Code (`claude --effort`) — solo tiene sentido
// para engine 'external'. Distinto del `effort` de 3 niveles del chat (OpenRouter
// reasoning param), que es un mecanismo separado para modelos servidos vía API.
export type ClaudeCliEffort = 'low' | 'medium' | 'high' | 'xhigh' | 'max'

const EXECUTORS: TaskExecutor[] = ['openrouter', 'anthropic', 'openai', 'codex']
const CLI_EFFORTS: ClaudeCliEffort[] = ['low', 'medium', 'high', 'xhigh', 'max']

export interface Check {
  cmd: string
  cwd?: string
  timeout_ms?: number
  expect_exit?: number
}

export interface Task {
  id: string              // kebab-case, unique within file
  description: string
  skill?: string          // skill id from skills/
  executor: TaskExecutor
  /** Per-task model override — wins over orchestos.config.yaml executor_heavy/light role */
  executor_model?: string
  /** Per-task planner model — for future sub-agent planning step */
  planner_model?: string
  /** Which ExecutorEngine runs this task — undefined resolves via orchestos.config.yaml, default 'single-shot' (G.3) */
  engine?: TaskEngine
  /** Only meaningful when engine='external' — maps to `claude --effort <level>`. Ignored by single-shot/agentic. */
  cli_effort?: ClaudeCliEffort
  input: string[]         // files the LLM can read (relative to project root)
  output: string[]        // files the LLM is allowed to write — REQUIRED, must be non-empty
  acceptance_criteria?: string[]
  checks?: Check[]
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

  const executor = validateExecutor(task.executor, err)

  return {
    id:           task.id as string,
    description:  task.description as string,
    skill:        typeof task.skill === 'string' ? task.skill : undefined,
    executor,
    executor_model: typeof task.executor_model === 'string' ? task.executor_model : undefined,
    planner_model:  typeof task.planner_model  === 'string' ? task.planner_model  : undefined,
    engine:       validateEngine(task.engine, err),
    cli_effort:   validateCliEffort(task.cli_effort, err),
    input:        Array.isArray(task.input) ? task.input as string[] : [],
    output:       task.output as string[],
    acceptance_criteria: validateStringArray(task.acceptance_criteria, 'acceptance_criteria', err),
    checks:       validateChecks(task.checks, err),
    depends_on:   Array.isArray(task.depends_on) ? task.depends_on as string[] : [],
    status:       (task.status as TaskStatus) ?? 'pending',
    retry_count:  typeof task.retry_count === 'number' ? task.retry_count : 0,
    retry_reason: typeof task.retry_reason === 'string' ? task.retry_reason : undefined,
    qa_verdict:   task.qa_verdict as 'pass' | 'fail' | undefined,
    run_id:       typeof task.run_id === 'string' ? task.run_id : undefined,
  }
}

function validateExecutor(value: unknown, err: (msg: string) => never): TaskExecutor {
  if (value === undefined) return 'openrouter'
  if (typeof value !== 'string' || !EXECUTORS.includes(value as TaskExecutor)) {
    err(`unknown executor '${String(value)}' — allowed: ${EXECUTORS.join(', ')}`)
  }
  if (value === 'codex' && process.env.OS_ENABLE_EXEC_CODEX !== '1') {
    err('codex executor disabled — set OS_ENABLE_EXEC_CODEX=1 to enable')
  }
  return value as TaskExecutor
}

function validateEngine(value: unknown, err: (msg: string) => never): TaskEngine | undefined {
  if (value === undefined) return undefined
  if (value !== 'single-shot' && value !== 'agentic' && value !== 'external' && value !== 'opencode') {
    err(`unknown engine '${String(value)}' — allowed: single-shot, agentic, external, opencode`)
  }
  return value as TaskEngine
}

function validateCliEffort(value: unknown, err: (msg: string) => never): ClaudeCliEffort | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'string' || !CLI_EFFORTS.includes(value as ClaudeCliEffort)) {
    err(`unknown cli_effort '${String(value)}' — allowed: ${CLI_EFFORTS.join(', ')}`)
  }
  return value as ClaudeCliEffort
}

function validateStringArray(
  value: unknown,
  field: string,
  err: (msg: string) => never
): string[] | undefined {
  if (value === undefined) return undefined
  if (!Array.isArray(value)) err(`"${field}" must be an array of strings`)
  const strings = value as unknown[]
  for (const [i, item] of strings.entries()) {
    if (typeof item !== 'string' || item.trim() === '') {
      err(`"${field}[${i}]" must be a non-empty string`)
    }
  }
  return strings as string[]
}

function validateChecks(value: unknown, err: (msg: string) => never): Check[] | undefined {
  if (value === undefined) return undefined
  if (!Array.isArray(value)) err('"checks" must be an array')

  return (value as unknown[]).map((item, i) => {
    const check = typeof item === 'string' ? { cmd: item } : item as Record<string, unknown>
    if (typeof check !== 'object' || check === null || Array.isArray(check)) {
      err(`"checks[${i}]" must be a string command or an object`)
    }
    if (typeof check.cmd !== 'string' || check.cmd.trim() === '') {
      err(`"checks[${i}].cmd" is required`)
    }
    validateCheckCommand(check.cmd, `checks[${i}].cmd`, err)
    if (check.cwd !== undefined && typeof check.cwd !== 'string') {
      err(`"checks[${i}].cwd" must be a string`)
    }
    if (check.timeout_ms !== undefined && typeof check.timeout_ms !== 'number') {
      err(`"checks[${i}].timeout_ms" must be a number`)
    }
    if (check.expect_exit !== undefined && typeof check.expect_exit !== 'number') {
      err(`"checks[${i}].expect_exit" must be a number`)
    }
    return {
      cmd: check.cmd.trim(),
      cwd: typeof check.cwd === 'string' ? check.cwd : undefined,
      timeout_ms: typeof check.timeout_ms === 'number' ? check.timeout_ms : undefined,
      expect_exit: typeof check.expect_exit === 'number' ? check.expect_exit : undefined,
    }
  })
}

function validateCheckCommand(cmd: string, field: string, err: (msg: string) => never): void {
  const blocked = ['&&', '||', ';', '`', '$(']
  for (const token of blocked) {
    if (cmd.includes(token)) {
      err(`"${field}" cannot contain shell metacharacter "${token}" — declare separate checks instead`)
    }
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
