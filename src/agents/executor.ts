/**
 * S22.10 — Sub-agent executor
 *
 * The concrete `executeOne` callback for `executePlan` in scheduler.ts.
 * Bridges SubTask → harness (runTask) → SubagentResult.
 *
 * Flow:
 *   1. buildIsolatedContext  — get focused context slice + session memories
 *   2. SubTask → Task        — convert to harness-compatible shape
 *   3. runTask (sandboxMode: 'cwd') — already in worktree, no nested sandbox
 *   4. allowed_tools check   — tool-violation if harness was blocked or write not allowed
 *   5. TaskResult → SubagentResult — map statuses + cost fields
 *
 * withRateLimitRetry wraps the runTask call for transient 429 errors (S22.8).
 */

import { buildIsolatedContext } from './context-isolation.ts'
import { withRateLimitRetry } from './hardening.ts'
import { runTask } from '../run/harness.ts'
import { RunLogger } from '../run/logger.ts'
import type { Worktree } from '../run/sandbox.ts'
import type { SubTask, SubagentResult } from './sub-agent.ts'
import type { Task, TaskExecutor } from '../tasks/schema.ts'
import type { TaskResult } from '../run/harness.ts'

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface ExecutorOpts {
  /** SQLite project id for memory_entries queries (S22.3, S22.5a). */
  projectId: string
  /** Fallback executor when SubTask has no executor override. */
  parentExecutor?: TaskExecutor
  /** Fallback model when SubTask has no executor_model override. */
  parentModel?: string
}

// ---------------------------------------------------------------------------
// Main executor
// ---------------------------------------------------------------------------

/**
 * Executes a single sub-task inside its dedicated worktree.
 *
 * Designed to be passed directly as the `executeOne` callback to `executePlan`:
 *   executePlan(subTasks, opts, (st, wt) => executeSubTask(st, wt, execOpts))
 */
export async function executeSubTask(
  st: SubTask,
  worktree: Worktree,
  opts: ExecutorOpts,
): Promise<SubagentResult> {
  const t0 = performance.now()

  // 1. Build isolated context (slice of CONTEXT.md + session memories + spec)
  const isolatedCtx = buildIsolatedContext(st, worktree.path, opts.projectId)

  // 2. Convert SubTask → Task
  const task = subTaskToTask(st, opts)

  // 3. Run through harness — sandboxMode: 'cwd' because we're already in the worktree
  const logger = new RunLogger(worktree.path, st.id)
  let harnessResult: TaskResult

  try {
    harnessResult = await withRateLimitRetry(() =>
      runTask({
        projectRoot: worktree.path,
        contextText: isolatedCtx.rendered,
        task,
        logger,
        sandboxMode: 'cwd',
        projectId: opts.projectId,
      })
    )
  } catch (e: any) {
    const elapsed = Math.round(performance.now() - t0)
    return {
      sub_task_id: st.id,
      status: 'failed',
      error: `executor error: ${e.message}`,
      usd_cost: 0,
      tokens: { input: 0, output: 0 },
      elapsed_ms: elapsed,
      files_written: [],
    }
  }

  const elapsed = Math.round(performance.now() - t0)

  // 4. Tool-violation: harness blocked the write (output contract violation)
  if (harnessResult.filesBlocked.length > 0) {
    return {
      sub_task_id: st.id,
      status: 'failed',
      error: `tool-violation: attempted to write blocked files: ${harnessResult.filesBlocked.join(', ')}`,
      qa_verdict: 'tool-violation',
      usd_cost: harnessResult.cost.usd,
      tokens: { input: harnessResult.cost.inputTokens, output: harnessResult.cost.outputTokens },
      elapsed_ms: elapsed,
      files_written: [],
    }
  }

  // Tool-violation: write attempted but 'write' not in allowed_tools
  if (!st.allowed_tools.includes('write') && harnessResult.filesWritten.length > 0) {
    return {
      sub_task_id: st.id,
      status: 'failed',
      error: `tool-violation: write not in allowed_tools for sub-task "${st.id}"`,
      qa_verdict: 'tool-violation',
      usd_cost: harnessResult.cost.usd,
      tokens: { input: harnessResult.cost.inputTokens, output: harnessResult.cost.outputTokens },
      elapsed_ms: elapsed,
      files_written: [],
    }
  }

  // 5. Map harness status → SubagentResult
  return mapResult(st, harnessResult, elapsed)
}

// ---------------------------------------------------------------------------
// SubTask → Task conversion
// ---------------------------------------------------------------------------

function subTaskToTask(st: SubTask, opts: ExecutorOpts): Task {
  return {
    id:               st.id,
    description:      st.description,
    skill:            st.skill,
    executor:         st.executor ?? opts.parentExecutor ?? 'openrouter',
    executor_model:   st.executor_model ?? opts.parentModel,
    input:            st.input ?? [],
    output:           st.output ?? [],
    acceptance_criteria: st.acceptance,
    checks:           st.checks,
    depends_on:       [],           // DAG already handled by scheduler
    status:           'pending',
    retry_count:      st.retry_count,
    retry_reason:     st.retry_reason,
  }
}

// ---------------------------------------------------------------------------
// TaskResult → SubagentResult
// ---------------------------------------------------------------------------

function mapResult(st: SubTask, r: TaskResult, elapsedMs: number): SubagentResult {
  const base = {
    sub_task_id: st.id,
    usd_cost:    r.cost.usd,
    tokens:      { input: r.cost.inputTokens, output: r.cost.outputTokens },
    elapsed_ms:  elapsedMs,
    files_written: r.filesWritten,
    qa_verdict:  r.qaVerdict as SubagentResult['qa_verdict'],
  }

  if (r.status === 'done') {
    return {
      ...base,
      status: 'completed',
      result: r.qaReason,
      // Signal to scheduler that topic_key was written (S22.5a commitTopicKey)
      topic_key_written: st.topic_key,
    }
  }

  // 'retry' or 'failed' both map to 'failed' (scheduler handles retry counting)
  return {
    ...base,
    status: 'failed',
    error: r.qaReason ?? r.retryReason ?? 'harness returned non-done status',
  }
}
