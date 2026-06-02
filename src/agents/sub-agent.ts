/**
 * S22.1 — Sub-agent runtime types
 *
 * Defines the runtime state machine and result contract for sub-tasks.
 * Static declaration (YAML schema) lives in sub-task-schema.ts (S22.0.2).
 *
 * State machine:
 *
 *   pending ──► running ──► completed
 *                    │
 *                    ├──► failed      (QA fail, retriable)
 *                    ├──► timed_out   (exceeded timeout_ms or 20 tool-call limit)
 *                    └──► cancelled   (parent task cancelled by user)
 *
 *   pending ──► skipped  (a depends_on sub-task reached failed/timed_out — S22.5)
 *
 * Patterns: DeerFlow SubagentResult + ECC cost tracker
 */

import type { SubTaskDef } from './sub-task-schema.ts'

// ---------------------------------------------------------------------------
// State machine
// ---------------------------------------------------------------------------

export type SubTaskStatus =
  | 'pending'     // waiting for depends_on to complete (initial state)
  | 'running'     // harness is actively executing this sub-task
  | 'completed'   // QA passed; topic_key written to memory_entries if applicable
  | 'failed'      // QA failed or execution error — retriable up to MAX_SUB_RETRIES
  | 'timed_out'   // exceeded timeout_ms OR 20 tool-call limit (S22.8 delegation rule)
  | 'cancelled'   // parent task was cancelled before this sub-task ran
  | 'skipped'     // a depends_on predecessor failed/timed_out — never executed (S22.5)

/** Terminal states — once reached, the sub-task will not be re-queued. */
export const TERMINAL_STATUSES = new Set<SubTaskStatus>([
  'completed', 'failed', 'timed_out', 'cancelled', 'skipped',
])

/** Maximum retries per sub-task before promoting to permanent failure. */
export const MAX_SUB_RETRIES = 2

// ---------------------------------------------------------------------------
// Runtime sub-task (definition + mutable state)
// ---------------------------------------------------------------------------

/**
 * SubTask = SubTaskDef (static contract from YAML) + runtime state.
 *
 * Callers create SubTask via `createSubTask()`. The orchestrator (S22.3+)
 * mutates `status`, `retry_count`, timestamps, and `run_id`.
 */
export interface SubTask extends SubTaskDef {
  /** Current execution state. */
  status: SubTaskStatus

  /** SQLite run id from the harness — populated after first execution attempt. */
  run_id?: string

  /** How many times this sub-task has been retried (starts at 0). */
  retry_count: number

  /** Last QA fail reason or error message — used in the retry prompt. */
  retry_reason?: string

  /** ISO timestamp when execution started (status → 'running'). */
  started_at?: string

  /** ISO timestamp when execution reached a terminal status. */
  completed_at?: string
}

// ---------------------------------------------------------------------------
// Sub-agent result
// ---------------------------------------------------------------------------

/**
 * SubagentResult — returned by the sub-agent executor after a single attempt.
 *
 * The orchestrator uses this to decide status transitions and whether to
 * cascade failure to downstream sub-tasks (S22.5) or merge memory (S22.5a).
 */
export interface SubagentResult {
  sub_task_id: string

  /** Post-execution status. Never 'pending', 'running', or 'skipped'. */
  status: Extract<SubTaskStatus, 'completed' | 'failed' | 'timed_out' | 'cancelled'>

  /**
   * Human-readable summary on success (QA pass reason).
   * Undefined on failure — see `error` instead.
   */
  result?: string

  /**
   * Error message on failure — QA fail reason, timeout message, or
   * tool-violation description (harness hard-stop, no QA LLM called).
   */
  error?: string

  /**
   * The topic_key that was written to `memory_entries` on success.
   * Undefined if the sub-task had no topic_key or if it failed.
   */
  topic_key_written?: string

  /** Model used for this sub-agent (e.g. "anthropic/claude-haiku-4-5") */
  model?: string

  /** Total USD cost: main LLM call + QA LLM call combined. */
  usd_cost: number

  /** Token counts for cost tracking (ECC pattern). */
  tokens: {
    input: number
    output: number
  }

  /** Wall-clock time from sub-task start to terminal status. */
  elapsed_ms: number

  /** Files written to the worktree (empty on failure — worktree discarded). */
  files_written: string[]

  /**
   * QA verdict:
   *   - 'pass'           — QA LLM approved the output
   *   - 'fail'           — QA LLM rejected (retriable)
   *   - 'tool-violation' — harness hard-stop, no QA LLM called (S22.0 tool policy)
   */
  qa_verdict?: 'pass' | 'fail' | 'tool-violation'
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

/**
 * Creates a SubTask from a static SubTaskDef with initial state 'pending'.
 * Used by the planner (S22.2) after parsing and validating the YAML plan.
 */
export function createSubTask(def: SubTaskDef): SubTask {
  return {
    ...def,
    status: 'pending',
    retry_count: 0,
  }
}

// ---------------------------------------------------------------------------
// State helpers (used by orchestrator S22.3+ and cascade QA S22.5)
// ---------------------------------------------------------------------------

/** Returns true if this sub-task is waiting for dependencies. */
export function isPending(st: SubTask): boolean {
  return st.status === 'pending'
}

/** Returns true if no further execution will happen for this sub-task. */
export function isTerminal(st: SubTask): boolean {
  return TERMINAL_STATUSES.has(st.status)
}

/**
 * Returns true if this sub-task can be retried.
 * A sub-task is retriable only if status is 'failed' and retries < MAX_SUB_RETRIES.
 */
export function isRetriable(st: SubTask): boolean {
  return st.status === 'failed' && st.retry_count < MAX_SUB_RETRIES
}

/**
 * Returns true if this sub-task should be skipped due to an upstream failure.
 * Called by S22.5 cascade QA after any predecessor reaches a terminal failure state.
 */
export function shouldSkip(st: SubTask, failedIds: ReadonlySet<string>): boolean {
  return st.status === 'pending' && st.depends_on.some(dep => failedIds.has(dep))
}

/**
 * Applies a SubagentResult to a SubTask, returning an updated copy.
 * The orchestrator calls this after each execution attempt.
 */
export function applyResult(st: SubTask, result: SubagentResult): SubTask {
  const now = new Date().toISOString()
  const updated: SubTask = {
    ...st,
    status: result.status,
    run_id: st.run_id ?? undefined,
    completed_at: now,
  }

  if (result.status === 'failed') {
    updated.retry_count = st.retry_count + 1
    updated.retry_reason = result.error
    // Reset to pending for scheduler retry if still retriable
    if (updated.retry_count < MAX_SUB_RETRIES) {
      updated.status = 'failed'
    }
  }

  return updated
}
