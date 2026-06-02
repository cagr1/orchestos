import type { SubTask, SubagentResult } from '../agents/sub-agent.ts'
import { TERMINAL_STATUSES } from '../agents/sub-agent.ts'
import { commitTopicKey } from '../agents/context-isolation.ts'
import {
  createWorktreeWithRetry,
  withSubTaskTimeout,
  ToolCallLimitError,
  DEFAULT_SUB_TASK_TIMEOUT_MS,
} from '../agents/hardening.ts'
import type { TaskExecutor } from '../tasks/schema.ts'
import { mergeWorktreeBack } from './sandbox.ts'
import type { Worktree } from './sandbox.ts'

// ---------------------------------------------------------------------------
// Scheduler result
// ---------------------------------------------------------------------------

export interface SubTaskLog {
  id: string
  status: SubTask['status']
  result?: string
  error?: string
  model?: string
  usd_cost: number
  tokens: { input: number; output: number }
  elapsed_ms: number
  files_written: string[]
  qa_verdict?: 'pass' | 'fail' | 'tool-violation'
  worktree?: string
}

export interface SchedulerResult {
  parent_task_id: string
  sub_tasks: SubTaskLog[]
  aggregated_cost: number
  aggregated_tokens: { input: number; output: number }
  aggregated_ms: number
  all_passed: boolean
}

// ---------------------------------------------------------------------------
// Scheduler options
// ---------------------------------------------------------------------------

export interface SchedulerOpts {
  parentTaskId: string
  projectRoot: string
  baseBranch: string
  /** SQLite project id — required for commitTopicKey (S22.5a apply-progress). */
  projectId?: string
  parentExecutor?: TaskExecutor
  parentModel?: string
}

// ---------------------------------------------------------------------------
// S22.4 — Schedule + execute sub-tasks sequentially
// S22.5 — Cascade QA: failure propagates → downstream sub-tasks become 'skipped'
// S22.8 — Hardening: timeout, worktree-collision retry, tool-call limit
// ---------------------------------------------------------------------------

/**
 * Executes a plan of sub-tasks sequentially, respecting depends_on order
 * (input is expected to already be in topological order from the planner).
 *
 * Each sub-task gets its own worktree. If a sub-task fails, all dependents
 * are marked 'skipped' with an explicit reason (S22.5 cascade).
 *
 * Hardening (S22.8):
 *   - Worktree creation retried with exponential backoff on collision.
 *   - executeOne is raced against st.timeout_ms (default 300s).
 *   - ToolCallLimitError from executeOne maps to 'timed_out'.
 */
export async function executePlan(
  subTasks: SubTask[],
  opts: SchedulerOpts,
  executeOne: (st: SubTask, worktree: Worktree) => Promise<SubagentResult>,
): Promise<SchedulerResult> {
  const logs: SubTaskLog[] = []
  let aggregatedCost = 0
  let aggregatedInputTokens = 0
  let aggregatedOutputTokens = 0
  let aggregatedMs = 0
  let hasFailure = false

  // Track which sub-tasks have reached terminal failure (S22.5 cascade)
  const failedIds = new Set<string>()

  for (const st of subTasks) {
    // S22.5 — cascade: skip if a dependency failed
    if (st.depends_on.some(dep => failedIds.has(dep))) {
      st.status = 'skipped'
      const depNames = st.depends_on.filter(d => failedIds.has(d)).join(', ')
      const reason = `dependency failed: ${depNames}`
      logs.push({
        id: st.id,
        status: 'skipped',
        error: reason,
        usd_cost: 0,
        tokens: { input: 0, output: 0 },
        elapsed_ms: 0,
        files_written: [],
      })
      continue
    }

    // Skip already-terminal sub-tasks
    if (TERMINAL_STATUSES.has(st.status)) {
      continue
    }

    // S22.8 — worktree creation with collision-retry + backoff
    let worktree: Worktree
    try {
      worktree = await createWorktreeWithRetry(`sub-${st.id}`, opts.baseBranch, opts.projectRoot)
    } catch (e) {
      st.status = 'failed'
      failedIds.add(st.id)
      const msg = `worktree creation failed: ${(e as Error).message}`
      logs.push({
        id: st.id,
        status: 'failed',
        error: msg,
        usd_cost: 0,
        tokens: { input: 0, output: 0 },
        elapsed_ms: 0,
        files_written: [],
      })
      hasFailure = true
      continue
    }

    st.status = 'running'
    st.started_at = new Date().toISOString()

    // S22.8 — race executeOne against the sub-task timeout
    const timeoutMs = st.timeout_ms ?? DEFAULT_SUB_TASK_TIMEOUT_MS
    let result: SubagentResult

    try {
      const raced = await withSubTaskTimeout(executeOne(st, worktree), timeoutMs, st.id)

      if (raced.timedOut) {
        result = timedOutResult(st.id, timeoutMs)
      } else {
        result = raced.result
      }
    } catch (e) {
      // S22.8 — tool-call limit exceeded → timed_out (delegation rule)
      if (e instanceof ToolCallLimitError) {
        result = timedOutResult(st.id, timeoutMs, e.message)
      } else {
        result = failedResult(st.id, (e as Error).message)
      }
    }

    st.status = result.status
    st.completed_at = new Date().toISOString()
    st.run_id = result.sub_task_id
    st.retry_count = result.status === 'failed' ? st.retry_count + 1 : st.retry_count
    if (result.error) st.retry_reason = result.error

    // Merge worktree on success, discard on failure/timeout
    if (result.status === 'completed') {
      mergeWorktreeBack(worktree, 'commit', `orchestos(sub-${st.id}): sub-task completed`)
      // S22.5a — apply-progress: persist result to memory_entries under topic_key
      if (opts.projectId && result.topic_key_written && result.result) {
        commitTopicKey(st, opts.projectId, result.result)
      }
    } else {
      mergeWorktreeBack(worktree, 'discard')
    }

    aggregatedCost += result.usd_cost
    aggregatedInputTokens += result.tokens.input
    aggregatedOutputTokens += result.tokens.output
    aggregatedMs += result.elapsed_ms

    const log: SubTaskLog = {
      id: st.id,
      status: result.status,
      result: result.result,
      error: result.error,
      model: result.model,
      usd_cost: result.usd_cost,
      tokens: result.tokens,
      elapsed_ms: result.elapsed_ms,
      files_written: result.files_written,
      qa_verdict: result.qa_verdict,
      worktree: worktree.path,
    }
    logs.push(log)

    if (result.status === 'failed' || result.status === 'timed_out') {
      hasFailure = true
      failedIds.add(st.id)
    }
  }

  return {
    parent_task_id: opts.parentTaskId,
    sub_tasks: logs,
    aggregated_cost: aggregatedCost,
    aggregated_tokens: { input: aggregatedInputTokens, output: aggregatedOutputTokens },
    aggregated_ms: aggregatedMs,
    all_passed: !hasFailure,
  }
}

// ---------------------------------------------------------------------------
// Result builders for error paths
// ---------------------------------------------------------------------------

function timedOutResult(taskId: string, timeoutMs: number, msg?: string): SubagentResult {
  return {
    sub_task_id: taskId,
    status: 'timed_out',
    error: msg ?? `timed out after ${timeoutMs}ms`,
    usd_cost: 0,
    tokens: { input: 0, output: 0 },
    elapsed_ms: timeoutMs,
    files_written: [],
  }
}

function failedResult(taskId: string, msg: string): SubagentResult {
  return {
    sub_task_id: taskId,
    status: 'failed',
    error: msg,
    usd_cost: 0,
    tokens: { input: 0, output: 0 },
    elapsed_ms: 0,
    files_written: [],
  }
}
