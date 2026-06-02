/**
 * S23.0.2 — Context monitor hook (patrón ECC ecc-context-monitor.js)
 *
 * `checkContextHealth(state)` returns structured warnings when the run is
 * approaching limits that cause silent failures in long sub-agent sessions:
 *
 *   - context_warning  — remaining context < 35% of model window
 *   - context_critical — remaining context < 25% of model window
 *   - cost_notice      — cumulative USD cost > $5
 *   - loop_detected    — same tool/action ≥ 3 times in a row
 *   - scope_creep      — files modified > 20
 *
 * The harness calls this after each LLM round-trip. For multi-sub-task plans,
 * use `shouldCheck(callCount, 5)` to debounce to every 5th harness invocation.
 *
 * Never throws, never blocks — warnings are advisory only.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type WarningCode =
  | 'context_warning'
  | 'context_critical'
  | 'cost_notice'
  | 'loop_detected'
  | 'scope_creep'

export type WarningSeverity = 'warning' | 'critical' | 'notice'

export interface ContextWarning {
  code:     WarningCode
  severity: WarningSeverity
  message:  string
}

export interface RunState {
  /** Input tokens sent in the last LLM call (system + context + user). */
  promptTokens: number
  /** Maximum context window for the current model, in tokens. */
  modelContextWindow: number
  /** Cumulative USD cost for this run or sub-agent session. */
  cumulativeCostUsd: number
  /**
   * Ordered sequence of recent tool/action names for loop detection.
   * Pass the last 3–10 entries; older entries are irrelevant.
   * Use `[]` when the harness makes a single shot call (no tool loop).
   */
  recentToolCalls: string[]
  /** Total number of files written or modified so far. */
  filesModified: number
}

// ---------------------------------------------------------------------------
// Model context window lookup
// ---------------------------------------------------------------------------

const CONTEXT_WINDOWS: Array<[string, number]> = [
  // Anthropic — 200K
  ['claude',   200_000],
  // Google — 1M
  ['gemini',   1_000_000],
  // OpenAI
  ['gpt-4o',   128_000],
  ['gpt-4',      8_192],
  ['gpt-3.5',   16_385],
  // Mistral
  ['mistral',   32_000],
  // DeepSeek
  ['deepseek', 128_000],
]

const DEFAULT_CONTEXT_WINDOW = 128_000

export function getModelContextWindow(model: string): number {
  const lower = model.toLowerCase()
  for (const [key, size] of CONTEXT_WINDOWS) {
    if (lower.includes(key)) return size
  }
  return DEFAULT_CONTEXT_WINDOW
}

// ---------------------------------------------------------------------------
// Core check
// ---------------------------------------------------------------------------

export function checkContextHealth(state: RunState): ContextWarning[] {
  const warnings: ContextWarning[] = []

  // Context remaining
  const usedRatio      = state.promptTokens / state.modelContextWindow
  const remainingRatio = 1 - usedRatio
  if (remainingRatio < 0.25) {
    warnings.push({
      code:     'context_critical',
      severity: 'critical',
      message:  `Context critically low: ${Math.round(remainingRatio * 100)}% remaining (${state.promptTokens}/${state.modelContextWindow} tokens)`,
    })
  } else if (remainingRatio < 0.35) {
    warnings.push({
      code:     'context_warning',
      severity: 'warning',
      message:  `Context low: ${Math.round(remainingRatio * 100)}% remaining (${state.promptTokens}/${state.modelContextWindow} tokens)`,
    })
  }

  // Cost
  if (state.cumulativeCostUsd > 5) {
    warnings.push({
      code:     'cost_notice',
      severity: 'notice',
      message:  `Cumulative cost $${state.cumulativeCostUsd.toFixed(2)} exceeds $5.00`,
    })
  }

  // Loop detection: same tool ≥ 3 times in a row
  const seq = state.recentToolCalls
  if (seq.length >= 3) {
    const last   = seq[seq.length - 1]
    const streak = seq.slice(-3).every(t => t === last)
    if (streak) {
      warnings.push({
        code:     'loop_detected',
        severity: 'warning',
        message:  `Possible loop: '${last}' called 3+ times consecutively`,
      })
    }
  }

  // Scope creep
  if (state.filesModified > 20) {
    warnings.push({
      code:     'scope_creep',
      severity: 'warning',
      message:  `Scope creep: ${state.filesModified} files modified (threshold: 20)`,
    })
  }

  return warnings
}

// ---------------------------------------------------------------------------
// Debounce helper for multi-call callers (sub-agent executor, scheduler)
// ---------------------------------------------------------------------------

/**
 * Returns true when `callCount` is a multiple of `debounce`.
 * callCount=0 always returns true (check on first call).
 *
 * Usage in executor:
 *   let monitorCalls = 0
 *   if (shouldCheck(monitorCalls++, 5)) checkContextHealth(state)
 */
export function shouldCheck(callCount: number, debounce = 5): boolean {
  return callCount % debounce === 0
}
