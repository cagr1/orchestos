/**
 * S22.0.2 — Sub-task contract schema
 *
 * This is the static (YAML-serializable) definition of a sub-task plan.
 * S22.1 will define the runtime `SubTask` with status state machine.
 * S22.2 will implement the parser/validator that consumes these types.
 *
 * Design constraints:
 *   - `allowed_tools` is REQUIRED — tool policy is enforced hard by the harness (not a hint)
 *   - Either `output` or `topic_key` must be present — a sub-task that writes nothing is invalid
 *   - `depends_on` forms a DAG — cycles are rejected at validation time
 *   - `timeout_ms` defaults to 300_000 (5 min) per Mes 5 decision
 *
 * Patterns: gentle-ai (DAG of phases) + DeerFlow (tool policy)
 *
 * Example YAML:
 *
 * ```yaml
 * version: 1
 * parent_task_id: implement-auth-module
 * sub_tasks:
 *   - id: write-auth-schema
 *     description: Create the database schema for the auth module
 *     acceptance:
 *       - schema.sql contains users table with id, email, hashed_password, created_at
 *       - schema.sql contains sessions table with id, user_id, token, expires_at
 *     depends_on: []
 *     allowed_tools: [read, write]
 *     topic_key: auth-schema
 *     output:
 *       - src/db/schema.sql
 *
 *   - id: implement-auth-service
 *     description: Implement AuthService with login and register methods
 *     acceptance:
 *       - AuthService.login returns JWT on valid credentials
 *       - AuthService.register hashes password before storing
 *       - Unit tests pass
 *     depends_on: [write-auth-schema]
 *     allowed_tools: [read, write, edit]
 *     topic_key: auth-service
 *     skill: tdd-enforcer
 *     input:
 *       - src/db/schema.sql
 *     output:
 *       - src/services/auth.ts
 *       - src/services/auth.test.ts
 *     checks:
 *       - cmd: bun test src/services/auth.test.ts
 *         timeout_ms: 30000
 *
 *   - id: write-auth-docs
 *     description: Document the auth module API
 *     acceptance:
 *       - docs/AUTH.md documents all public methods with examples
 *     depends_on: [implement-auth-service]
 *     allowed_tools: [read, write]
 *     topic_key: auth-docs
 *     output:
 *       - docs/AUTH.md
 * ```
 */

import type { Check, TaskExecutor } from '../tasks/schema.ts'

// ---------------------------------------------------------------------------
// Valid tools that harness enforces
// ---------------------------------------------------------------------------

export const VALID_TOOLS = ['read', 'write', 'edit', 'bash', 'git'] as const
export type SubTaskTool = (typeof VALID_TOOLS)[number]

// ---------------------------------------------------------------------------
// Static contract (what lives in YAML)
// ---------------------------------------------------------------------------

/**
 * SubTaskDef — the serializable declaration of a single sub-task.
 *
 * Runtime state (`status`, `result`, `usd_cost`, ...) lives in `SubTask` (S22.1).
 */
export interface SubTaskDef {
  /** Kebab-case, unique within the plan. Used as worktree branch suffix. */
  id: string

  /** Human-readable statement of what this sub-task must accomplish. */
  description: string

  /**
   * Acceptance criteria — at least one required.
   * Each string is a verifiable condition the QA LLM will check.
   */
  acceptance: string[]

  /**
   * IDs of sub-tasks that must reach `completed` before this one starts.
   * Empty array means no dependencies (runs first in topological order).
   */
  depends_on: string[]

  /**
   * Tools this sub-task may use. Harness enforces hard stop — tool-violation
   * fails the sub-task with qa_verdict: 'tool-violation' without calling QA LLM.
   *
   * Inherited from the parent skill's `allowed_tools` if absent in the YAML,
   * but the planner (S22.2) always materialises it before passing to harness.
   */
  allowed_tools: SubTaskTool[]

  /**
   * Key for `memory_entries` table. If present, the harness will:
   *   1. Fetch any existing entry with this key and pass it to the sub-agent
   *      with an explicit MERGE instruction (S22.5a apply-progress continuity).
   *   2. Call `upsertMemory()` with the result after completion.
   *
   * A sub-task MUST have `topic_key` OR `output` (or both).
   */
  topic_key?: string

  /** Skill id from `skills/`. Overrides parent skill for this sub-task. */
  skill?: string

  /**
   * Provider override — inherits from parent task if absent.
   * Use sparingly: routing via `orchestos.config.yaml` is preferred.
   */
  executor?: TaskExecutor

  /** Model override — wins over config-file routing for this sub-task. */
  executor_model?: string

  /** Files the LLM can read (relative to project root). */
  input?: string[]

  /**
   * Files the LLM is allowed to write (relative to project root).
   * Required if `topic_key` is absent. A sub-task with neither is invalid.
   */
  output?: string[]

  /** Deterministic shell checks run after write, before QA LLM call. */
  checks?: Check[]

  /**
   * Maximum wall-clock time for this sub-task.
   * If the sub-agent exceeds 20 tool calls without completing, the harness
   * cancels with status `timed_out` regardless of this value (S22.8).
   *
   * @default 300_000
   */
  timeout_ms?: number
}

// ---------------------------------------------------------------------------
// Plan envelope (the full YAML document)
// ---------------------------------------------------------------------------

export interface SubTaskPlan {
  version: 1
  /** ID of the parent task that spawned this plan. */
  parent_task_id: string
  sub_tasks: SubTaskDef[]
}

// ---------------------------------------------------------------------------
// Validators
// ---------------------------------------------------------------------------

export class SubTaskValidationError extends Error {
  constructor(public readonly path: string, message: string) {
    super(`[sub-task:${path}] ${message}`)
    this.name = 'SubTaskValidationError'
  }
}

export function validateSubTask(raw: Record<string, unknown>, index: number): SubTaskDef {
  const err = (msg: string): never => {
    throw new SubTaskValidationError(`sub_tasks[${index}]`, msg)
  }

  // id
  if (!raw.id || typeof raw.id !== 'string') err('missing "id"')
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(raw.id as string))
    err(`"id" must be kebab-case, got: ${raw.id}`)

  // description
  if (!raw.description || typeof raw.description !== 'string') err('missing "description"')
  if ((raw.description as string).trim().length === 0) err('"description" must not be empty')

  // acceptance
  if (!Array.isArray(raw.acceptance) || (raw.acceptance as unknown[]).length === 0)
    err('"acceptance" must be a non-empty array of strings')
  for (const [i, a] of (raw.acceptance as unknown[]).entries()) {
    if (typeof a !== 'string' || (a as string).trim() === '')
      err(`"acceptance[${i}]" must be a non-empty string`)
  }

  // depends_on
  if (raw.depends_on !== undefined && !Array.isArray(raw.depends_on))
    err('"depends_on" must be an array')
  const dependsOn: string[] = Array.isArray(raw.depends_on) ? (raw.depends_on as string[]) : []
  for (const [i, dep] of dependsOn.entries()) {
    if (typeof dep !== 'string' || dep.trim() === '')
      err(`"depends_on[${i}]" must be a non-empty string`)
  }

  // allowed_tools — required
  if (!Array.isArray(raw.allowed_tools))
    err('"allowed_tools" is required and must be an array')
  const allowedTools = raw.allowed_tools as string[]
  for (const [i, tool] of allowedTools.entries()) {
    if (!VALID_TOOLS.includes(tool as SubTaskTool))
      err(`"allowed_tools[${i}]" invalid tool "${tool}" — valid: ${VALID_TOOLS.join(', ')}`)
  }

  // output / topic_key — at least one required
  const hasOutput = Array.isArray(raw.output) && (raw.output as unknown[]).length > 0
  const hasTopicKey = typeof raw.topic_key === 'string' && (raw.topic_key as string).trim() !== ''
  if (!hasOutput && !hasTopicKey)
    err('sub-task must declare at least one of "output" or "topic_key"')

  if (Array.isArray(raw.output)) {
    for (const [i, f] of (raw.output as unknown[]).entries()) {
      if (typeof f !== 'string' || (f as string).trim() === '')
        err(`"output[${i}]" must be a non-empty string`)
    }
  }

  // input (optional)
  if (raw.input !== undefined) {
    if (!Array.isArray(raw.input)) err('"input" must be an array')
    for (const [i, f] of (raw.input as unknown[]).entries()) {
      if (typeof f !== 'string') err(`"input[${i}]" must be a string`)
    }
  }

  // timeout_ms (optional)
  if (raw.timeout_ms !== undefined && (typeof raw.timeout_ms !== 'number' || raw.timeout_ms <= 0))
    err('"timeout_ms" must be a positive number')

  return {
    id:            raw.id as string,
    description:   raw.description as string,
    acceptance:    raw.acceptance as string[],
    depends_on:    dependsOn,
    allowed_tools: allowedTools as SubTaskTool[],
    topic_key:     hasTopicKey ? (raw.topic_key as string) : undefined,
    skill:         typeof raw.skill === 'string' ? raw.skill : undefined,
    executor:      typeof raw.executor === 'string' ? raw.executor as TaskExecutor : undefined,
    executor_model: typeof raw.executor_model === 'string' ? raw.executor_model : undefined,
    input:         Array.isArray(raw.input) ? raw.input as string[] : undefined,
    output:        hasOutput ? raw.output as string[] : undefined,
    checks:        validateChecks(raw.checks, index),
    timeout_ms:    typeof raw.timeout_ms === 'number' ? raw.timeout_ms : undefined,
  }
}

export function validateSubTaskPlan(raw: unknown): SubTaskPlan {
  const f = raw as Record<string, unknown>
  const err = (msg: string): never => {
    throw new SubTaskValidationError('plan', msg)
  }

  if (f.version !== 1) err('"version" must be 1')
  if (!f.parent_task_id || typeof f.parent_task_id !== 'string')
    err('missing "parent_task_id"')
  if (!Array.isArray(f.sub_tasks) || (f.sub_tasks as unknown[]).length === 0)
    err('"sub_tasks" must be a non-empty array')

  const subTasks = (f.sub_tasks as unknown[]).map((t, i) =>
    validateSubTask(t as Record<string, unknown>, i)
  )

  // duplicate ids
  const ids = subTasks.map(t => t.id)
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i)
  if (dupes.length > 0) err(`duplicate sub-task ids: ${dupes.join(', ')}`)

  // depends_on references must exist
  const idSet = new Set(ids)
  for (const st of subTasks) {
    for (const dep of st.depends_on) {
      if (!idSet.has(dep))
        throw new SubTaskValidationError(`sub_tasks[${st.id}]`, `depends_on references unknown id "${dep}"`)
    }
  }

  // cycle detection (Kahn's algorithm)
  detectCycles(subTasks)

  return { version: 1, parent_task_id: f.parent_task_id as string, sub_tasks: subTasks }
}

// ---------------------------------------------------------------------------
// Topological sort (also used by S22.4 scheduler)
// ---------------------------------------------------------------------------

/**
 * Returns sub-tasks in topological order (dependencies first).
 * Throws if a cycle is detected — should not happen after validateSubTaskPlan.
 */
export function topoSort(subTasks: SubTaskDef[]): SubTaskDef[] {
  const inDegree = new Map<string, number>()
  const adj = new Map<string, string[]>()

  for (const st of subTasks) {
    inDegree.set(st.id, 0)
    adj.set(st.id, [])
  }
  for (const st of subTasks) {
    for (const dep of st.depends_on) {
      adj.get(dep)!.push(st.id)
      inDegree.set(st.id, (inDegree.get(st.id) ?? 0) + 1)
    }
  }

  const queue = subTasks.filter(st => inDegree.get(st.id) === 0).map(st => st.id)
  const result: SubTaskDef[] = []
  const byId = new Map(subTasks.map(st => [st.id, st]))

  while (queue.length > 0) {
    const id = queue.shift()!
    result.push(byId.get(id)!)
    for (const next of adj.get(id) ?? []) {
      const deg = (inDegree.get(next) ?? 0) - 1
      inDegree.set(next, deg)
      if (deg === 0) queue.push(next)
    }
  }

  if (result.length !== subTasks.length) {
    throw new SubTaskValidationError('plan', 'cycle detected in depends_on graph')
  }
  return result
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function detectCycles(subTasks: SubTaskDef[]): void {
  topoSort(subTasks) // throws SubTaskValidationError on cycle
}

function validateChecks(value: unknown, taskIndex: number): Check[] | undefined {
  if (value === undefined) return undefined
  if (!Array.isArray(value)) {
    throw new SubTaskValidationError(`sub_tasks[${taskIndex}]`, '"checks" must be an array')
  }
  return (value as unknown[]).map((item, i) => {
    const check = typeof item === 'string' ? { cmd: item } : item as Record<string, unknown>
    const err = (msg: string): never => {
      throw new SubTaskValidationError(`sub_tasks[${taskIndex}].checks[${i}]`, msg)
    }
    if (typeof check !== 'object' || check === null) err('must be a string or object')
    if (typeof check.cmd !== 'string' || (check.cmd as string).trim() === '') err('"cmd" is required')
    if (check.cwd !== undefined && typeof check.cwd !== 'string') err('"cwd" must be a string')
    if (check.timeout_ms !== undefined && typeof check.timeout_ms !== 'number') err('"timeout_ms" must be a number')
    if (check.expect_exit !== undefined && typeof check.expect_exit !== 'number') err('"expect_exit" must be a number')
    return {
      cmd: (check.cmd as string).trim(),
      cwd: typeof check.cwd === 'string' ? check.cwd : undefined,
      timeout_ms: typeof check.timeout_ms === 'number' ? check.timeout_ms : undefined,
      expect_exit: typeof check.expect_exit === 'number' ? check.expect_exit : undefined,
    }
  })
}
