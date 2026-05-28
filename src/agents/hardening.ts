/**
 * S22.8 — Sub-agent hardening
 *
 * Guards applied to every sub-task execution:
 *
 *   1. Timeout — each sub-task has a wall-clock deadline (default 5 min).
 *      `withSubTaskTimeout()` races the execution promise against a timer.
 *
 *   2. Tool-call delegation rule — if a sub-agent makes more than MAX_TOOL_CALLS
 *      attempts without completing, cancel with `timed_out`.
 *      `ToolCallCounter` is injected into the executor; each LLM call increments it.
 *
 *   3. Worktree collision → retry with exponential backoff.
 *      `createWorktreeWithRetry()` catches branch-already-exists errors and retries
 *      with a fresh timestamp. Up to WORKTREE_MAX_RETRIES attempts.
 *
 *   4. Rate-limit retry — provider 429 / rate-limit errors retried with exponential
 *      backoff up to RATE_LIMIT_MAX_RETRIES times before propagating.
 *
 * Pattern: gentle-ai delegation rules
 */

import { createWorktree } from '../run/sandbox.ts'
import type { Worktree } from '../run/sandbox.ts'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default wall-clock limit per sub-task (5 min). Matches Mes 5 decision. */
export const DEFAULT_SUB_TASK_TIMEOUT_MS = 300_000

/**
 * Maximum LLM call attempts (tool calls) per sub-task before forcing `timed_out`.
 * Delegation rule from gentle-ai: an agent that keeps looping without finishing
 * is cancelled rather than allowed to burn tokens indefinitely.
 */
export const MAX_TOOL_CALLS = 20

/** How many times to retry worktree creation on collision. */
export const WORKTREE_MAX_RETRIES = 3

/** Initial backoff for worktree retry (doubles each attempt). */
export const WORKTREE_INITIAL_BACKOFF_MS = 300

/** How many times to retry on rate-limit (429) errors. */
export const RATE_LIMIT_MAX_RETRIES = 3

/** Initial backoff for rate-limit retry (doubles each attempt). */
export const RATE_LIMIT_INITIAL_BACKOFF_MS = 2_000

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

export class TimeoutError extends Error {
  constructor(public readonly taskId: string, public readonly timeoutMs: number) {
    super(`sub-task "${taskId}" timed out after ${timeoutMs}ms`)
    this.name = 'TimeoutError'
  }
}

export class ToolCallLimitError extends Error {
  constructor(public readonly count: number, public readonly limit: number) {
    super(`tool-call limit exceeded: ${count} calls > limit of ${limit}`)
    this.name = 'ToolCallLimitError'
  }
}

export class WorktreeCollisionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WorktreeCollisionError'
  }
}

// ---------------------------------------------------------------------------
// 1. Timeout guard
// ---------------------------------------------------------------------------

/**
 * Races `promise` against a deadline timer. If the timer fires first, resolves
 * to `null` and the caller is responsible for mapping to `timed_out` status.
 *
 * Returns `{ result: T, timedOut: false }` on success,
 *         `{ result: null, timedOut: true }` on timeout.
 *
 * Does NOT cancel the underlying promise (JS has no cancellation primitive),
 * but the caller should ignore the result after receiving timedOut: true.
 */
export async function withSubTaskTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  taskId: string,
): Promise<{ result: T; timedOut: false } | { result: null; timedOut: true }> {
  let timerId: ReturnType<typeof setTimeout> | undefined

  const timeoutPromise = new Promise<never>((_, reject) => {
    timerId = setTimeout(
      () => reject(new TimeoutError(taskId, timeoutMs)),
      timeoutMs,
    )
  })

  try {
    const result = await Promise.race([promise, timeoutPromise])
    clearTimeout(timerId)
    return { result, timedOut: false }
  } catch (e) {
    clearTimeout(timerId)
    if (e instanceof TimeoutError) {
      return { result: null, timedOut: true }
    }
    throw e
  }
}

// ---------------------------------------------------------------------------
// 2. Tool-call counter (delegation rule)
// ---------------------------------------------------------------------------

/**
 * Tracks how many LLM/tool calls a sub-agent has made.
 * The executor calls `counter.increment()` before each LLM invocation.
 * When the limit is exceeded, `ToolCallLimitError` is thrown — the scheduler
 * maps this to `timed_out` status.
 *
 * Usage:
 *   const counter = new ToolCallCounter()
 *   counter.increment()   // throws ToolCallLimitError if count > MAX_TOOL_CALLS
 *   counter.current       // read current count without incrementing
 */
export class ToolCallCounter {
  private _count = 0
  readonly limit: number

  constructor(limit = MAX_TOOL_CALLS) {
    this.limit = limit
  }

  /** Increments and checks. Throws ToolCallLimitError if limit exceeded. */
  increment(): void {
    this._count++
    if (this._count > this.limit) {
      throw new ToolCallLimitError(this._count, this.limit)
    }
  }

  get current(): number {
    return this._count
  }

  get exhausted(): boolean {
    return this._count >= this.limit
  }
}

// ---------------------------------------------------------------------------
// 3. Worktree creation with retry + backoff
// ---------------------------------------------------------------------------

export interface WorktreeRetryOpts {
  maxRetries?: number
  initialBackoffMs?: number
}

/**
 * Creates a worktree for a sub-task, retrying on branch-collision errors with
 * exponential backoff. Each retry generates a fresh unique branch name via
 * `createWorktree` (which uses `Date.now()` in the branch name).
 *
 * Throws `WorktreeCollisionError` after all retries are exhausted.
 */
export async function createWorktreeWithRetry(
  taskId: string,
  baseBranch: string,
  projectRoot: string,
  opts: WorktreeRetryOpts = {},
): Promise<Worktree> {
  const maxRetries   = opts.maxRetries      ?? WORKTREE_MAX_RETRIES
  const initialDelay = opts.initialBackoffMs ?? WORKTREE_INITIAL_BACKOFF_MS

  let lastError: Error | undefined

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return createWorktree(taskId, baseBranch, projectRoot)
    } catch (e: any) {
      lastError = e as Error
      const isCollision =
        e.message?.includes('already exists') ||
        e.message?.includes('already checked out') ||
        e.message?.includes('already a worktree')

      if (!isCollision || attempt === maxRetries) break

      const delay = initialDelay * Math.pow(2, attempt)
      await sleep(delay)
    }
  }

  throw new WorktreeCollisionError(
    `Failed to create worktree for "${taskId}" after ${maxRetries + 1} attempts: ${lastError?.message}`,
  )
}

// ---------------------------------------------------------------------------
// 4. Rate-limit retry
// ---------------------------------------------------------------------------

export interface RateLimitRetryOpts {
  maxRetries?: number
  initialBackoffMs?: number
}

/**
 * Wraps an async function with rate-limit retry logic. If the function throws
 * a rate-limit error (429 / "rate limit" in the message), it waits with
 * exponential backoff and retries up to `maxRetries` times.
 *
 * Non-rate-limit errors are rethrown immediately.
 */
export async function withRateLimitRetry<T>(
  fn: () => Promise<T>,
  opts: RateLimitRetryOpts = {},
): Promise<T> {
  const maxRetries   = opts.maxRetries      ?? RATE_LIMIT_MAX_RETRIES
  const initialDelay = opts.initialBackoffMs ?? RATE_LIMIT_INITIAL_BACKOFF_MS

  let lastError: Error | undefined

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (e: any) {
      lastError = e as Error
      if (!isRateLimitError(e) || attempt === maxRetries) throw e

      const delay = initialDelay * Math.pow(2, attempt)
      console.warn(`[hardening] rate limit hit — waiting ${delay}ms before retry ${attempt + 1}/${maxRetries}`)
      await sleep(delay)
    }
  }

  // unreachable but satisfies TS
  throw lastError
}

/**
 * Detects rate-limit errors by HTTP status code or message content.
 * Covers Anthropic, OpenAI, and OpenRouter response shapes.
 */
export function isRateLimitError(e: unknown): boolean {
  if (typeof e !== 'object' || e === null) return false
  const err = e as Record<string, unknown>

  // HTTP status 429
  if (err.status === 429 || err.statusCode === 429) return true

  // Message-based detection
  const msg = String(err.message ?? '').toLowerCase()
  return (
    msg.includes('rate limit') ||
    msg.includes('ratelimit') ||
    msg.includes('too many requests') ||
    msg.includes('quota exceeded') ||
    msg.includes('429')
  )
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
