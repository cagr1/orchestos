/**
 * src/analyze/propose.ts — S34.1
 *
 * Bridges pattern detection (S30) with instinct proposals (S34).
 *
 * Flow:
 *   analyzeRunPatterns() → PatternSuggestion[]
 *     └─ proposeInstinctsFromPatterns()
 *          ├─ filter: frequency >= PATTERN_FREQUENCY_THRESHOLD
 *          ├─ dedup:  skip if trigger already exists in instincts table
 *          └─ insert: AUTO_DEFAULTS (confidence 0.6, source auto, verified false)
 *
 * proposeInstinctsFromPatterns() never throws — errors from the DB are caught and
 * skipped so a single bad row does not abort the whole proposal batch.
 *
 * The caller (CLI / post-run hook) is responsible for displaying the proposals.
 * This module only creates; approval/rejection is handled by the instinct CLI.
 */

import type { PatternSuggestion } from './patterns.ts'
import { listInstincts, insertInstinct } from '../instincts/store.ts'
import { AUTO_DEFAULTS } from '../instincts/schema.ts'
import type { InstinctDef } from '../instincts/schema.ts'

/** Minimum pattern frequency to trigger an instinct proposal. */
export const PATTERN_FREQUENCY_THRESHOLD = 3

/**
 * Given a list of PatternSuggestions, propose new instincts for patterns that
 * crossed the frequency threshold and are not already in the instincts table.
 *
 * Returns the list of newly created instinct proposals (may be empty).
 */
export function proposeInstinctsFromPatterns(patterns: PatternSuggestion[]): InstinctDef[] {
  if (!Array.isArray(patterns) || patterns.length === 0) return []
  const eligible = patterns.filter(p => p.frequency >= PATTERN_FREQUENCY_THRESHOLD)
  if (eligible.length === 0) return []

  // Load existing triggers once for dedup check (normalized to lowercase)
  const existing = new Set(
    listInstincts().map(i => i.trigger.toLowerCase().trim()),
  )

  const created: InstinctDef[] = []

  for (const pattern of eligible) {
    const trigger = pattern.pattern.trim()
    const action  = pattern.fix_hint.trim()

    if (!trigger || !action) continue
    if (existing.has(trigger.toLowerCase())) continue

    try {
      const instinct = insertInstinct({
        trigger,
        action,
        ...AUTO_DEFAULTS,
      })
      created.push(instinct)
      existing.add(trigger.toLowerCase())
    } catch {
      // skip — validation failure or DB error for this row
    }
  }

  return created
}
