/**
 * src/instincts/schema.ts — S33.1
 *
 * Schema definition for Instincts: atomic behavioral rules with confidence scoring.
 *
 * An instinct is a granular behavior: when a trigger condition matches, its
 * action text is injected into the harness system prompt. Instincts coexist
 * with skills — skills provide structured instructions per task type; instincts
 * provide cross-cutting behavioral nudges derived from observed run patterns.
 *
 * Confidence thresholds:
 *   confidence < REVIEW_THRESHOLD (0.6)  → never applied; manual upgrade required
 *   confidence >= REVIEW_THRESHOLD       → eligible once verified: true
 *   confidence >= APPLY_THRESHOLD (0.8)
 *     AND verified: true                 → applied automatically by instinct-apply middleware
 *
 * Source semantics:
 *   manual  — added by a human via `instinct add`; starts at confidence 1.0, verified true
 *   auto    — proposed by `runs --analyze` (S34); starts at confidence 0.6, verified false
 *
 * verified recalculation rule (used by `instinct set-confidence`):
 *   - new confidence < REVIEW_THRESHOLD → force verified = false (demote)
 *   - otherwise                         → leave verified unchanged (promotion requires human)
 */

// ── types ──────────────────────────────────────────────────────────────────

export type InstinctSource = 'manual' | 'auto'

export interface InstinctDef {
  id: string
  trigger: string
  action: string
  confidence: number
  source: InstinctSource
  verified: boolean
  created_at: string
}

/** Fields required to create a new instinct (id and created_at are generated). */
export interface InsertInstinctDef {
  trigger: string
  action: string
  confidence: number
  source: InstinctSource
  verified: boolean
}

/** Fields that can be updated on an existing instinct. */
export interface UpdateInstinctDef {
  trigger?: string
  action?: string
  confidence?: number
  source?: InstinctSource
  verified?: boolean
}

// ── validation ─────────────────────────────────────────────────────────────

export class InstinctValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InstinctValidationError'
  }
}

/**
 * Validate that an unknown value conforms to InstinctDef.
 * Throws InstinctValidationError with a descriptive message on first invalid field.
 * Also used internally by store.ts to validate inserts/updates.
 */
export function validateInstinct(raw: unknown): InstinctDef {
  if (raw === null || raw === undefined || typeof raw !== 'object') {
    throw new InstinctValidationError('Expected an object')
  }
  const obj = raw as Record<string, unknown>

  const id = String(obj.id ?? '')
  if (!id) throw new InstinctValidationError('id is required and must be a non-empty string')

  const trigger = String(obj.trigger ?? '')
  if (!trigger) throw new InstinctValidationError('trigger is required and must be a non-empty string')

  const action = String(obj.action ?? '')
  if (!action) throw new InstinctValidationError('action is required and must be a non-empty string')

  const confidence = Number(obj.confidence)
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    throw new InstinctValidationError('confidence must be a number between 0 and 1')
  }

  const source = String(obj.source ?? '')
  if (source !== 'manual' && source !== 'auto') {
    throw new InstinctValidationError("source must be 'manual' or 'auto'")
  }

  const verified = Boolean(obj.verified)

  const created_at = String(obj.created_at ?? '')
  if (!created_at) throw new InstinctValidationError('created_at is required and must be a non-empty string')

  return { id, trigger, action, confidence, source: source as InstinctSource, verified, created_at }
}

/**
 * Validate an insert payload. Returns a partial InstinctDef-like object.
 * Throws InstinctValidationError on invalid fields.
 */
export function validateInsert(raw: unknown): InsertInstinctDef {
  if (raw === null || raw === undefined || typeof raw !== 'object') {
    throw new InstinctValidationError('Expected an object')
  }
  const obj = raw as Record<string, unknown>

  const trigger = String(obj.trigger ?? '')
  if (!trigger) throw new InstinctValidationError('trigger is required and must be a non-empty string')

  const action = String(obj.action ?? '')
  if (!action) throw new InstinctValidationError('action is required and must be a non-empty string')

  const confidence = Number(obj.confidence)
  if (!Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    throw new InstinctValidationError('confidence must be a number between 0 and 1')
  }

  const source = String(obj.source ?? '')
  if (source !== 'manual' && source !== 'auto') {
    throw new InstinctValidationError("source must be 'manual' or 'auto'")
  }

  const verified = Boolean(obj.verified)

  return { trigger, action, confidence, source: source as InstinctSource, verified }
}

// ── thresholds ─────────────────────────────────────────────────────────────

/** Instincts below this confidence are never applied. */
export const REVIEW_THRESHOLD = 0.6

/** Instincts at or above this confidence (and verified) are auto-applied. */
export const APPLY_THRESHOLD = 0.8

/** Default confidence and verified state for manually added instincts. */
export const MANUAL_DEFAULTS = {
  confidence: 1.0,
  source: 'manual' as InstinctSource,
  verified: true,
}

/** Default confidence and verified state for auto-proposed instincts (S34). */
export const AUTO_DEFAULTS = {
  confidence: 0.6,
  source: 'auto' as InstinctSource,
  verified: false,
}

// ── helpers ────────────────────────────────────────────────────────────────

/**
 * Returns true when the instinct should be injected by the harness.
 * Mirrors the filter used in the instinct-apply middleware (S33.7).
 */
export function shouldApply(instinct: Pick<InstinctDef, 'confidence' | 'verified'>): boolean {
  return instinct.confidence >= APPLY_THRESHOLD && instinct.verified
}

/**
 * Recalculates verified after a confidence change.
 * Demotes below REVIEW_THRESHOLD; leaves verified unchanged otherwise.
 */
export function recalculateVerified(newConfidence: number, currentVerified: boolean): boolean {
  if (newConfidence < REVIEW_THRESHOLD) return false
  return currentVerified
}
