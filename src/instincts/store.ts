/**
 * src/instincts/store.ts — S33.3
 *
 * CRUD over the `instincts` SQLite table.
 * Uses the same bun:sqlite pattern as src/db/memory.ts and src/db/runs.ts.
 */

import { db } from '../db/sqlite.ts'
import { randomUUID } from 'crypto'
import { APPLY_THRESHOLD, recalculateVerified, validateInsert, validateInstinct, type InstinctDef, type InstinctSource, type InsertInstinctDef, type UpdateInstinctDef } from './schema.ts'

/**
 * Insert a new instinct. Generates id and created_at automatically.
 * Returns the inserted InstinctDef.
 */
export function insertInstinct(data: InsertInstinctDef): InstinctDef {
  const validated = validateInsert(data)
  const id = randomUUID()
  const now = new Date().toISOString()

  db.run(
    `INSERT INTO instincts (id, trigger, action, confidence, source, verified, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, validated.trigger, validated.action, validated.confidence, validated.source, validated.verified ? 1 : 0, now],
  )

  return { id, ...validated, created_at: now }
}

/**
 * Load an instinct by id. Returns null if not found.
 */
export function getInstinct(id: string): InstinctDef | null {
  const row = db.query<InstinctDefRow, [string]>(
    'SELECT * FROM instincts WHERE id = ?'
  ).get(id)
  return row ? rowToDef(row) : null
}

/**
 * List instincts with optional filters.
 */
export function listInstincts(filter?: {
  verified?: boolean
  source?: InstinctSource
  minConfidence?: number
}): InstinctDef[] {
  const conditions: string[] = []
  const params: any[] = []

  if (filter?.verified !== undefined) {
    conditions.push('verified = ?')
    params.push(filter.verified ? 1 : 0)
  }
  if (filter?.source !== undefined) {
    conditions.push('source = ?')
    params.push(filter.source)
  }
  if (filter?.minConfidence !== undefined) {
    conditions.push('confidence >= ?')
    params.push(filter.minConfidence)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
  const rows = db.query<InstinctDefRow, any[]>(
    `SELECT * FROM instincts ${where} ORDER BY confidence DESC, created_at DESC`
  ).all(...params as any[])
  return rows.map(rowToDef)
}

/**
 * Update confidence of an instinct.
 * Recalculates verified using recalculateVerified().
 * Returns true if the instinct was found and updated, false otherwise.
 */
export function updateConfidence(id: string, newConfidence: number): boolean {
  const existing = getInstinct(id)
  if (!existing) return false

  const verified = recalculateVerified(newConfidence, existing.verified) ? 1 : 0
  db.run(
    'UPDATE instincts SET confidence = ?, verified = ? WHERE id = ?',
    [newConfidence, verified, id],
  )
  return true
}

/**
 * Update arbitrary fields on an instinct.
 * Returns true if the instinct was found and updated.
 */
export function updateInstinct(id: string, data: UpdateInstinctDef): boolean {
  const existing = getInstinct(id)
  if (!existing) return false

  const sets: string[] = []
  const params: any[] = []

  if (data.trigger !== undefined) { sets.push('trigger = ?'); params.push(data.trigger) }
  if (data.action !== undefined) { sets.push('action = ?'); params.push(data.action) }
  if (data.confidence !== undefined) {
    sets.push('confidence = ?')
    params.push(data.confidence)
    const verified = recalculateVerified(data.confidence, data.verified ?? existing.verified) ? 1 : 0
    sets.push('verified = ?')
    params.push(verified)
  } else if (data.verified !== undefined) {
    sets.push('verified = ?')
    params.push(data.verified ? 1 : 0)
  }
  if (data.source !== undefined) { sets.push('source = ?'); params.push(data.source) }

  if (sets.length === 0) return true

  params.push(id)
  db.run(
    `UPDATE instincts SET ${sets.join(', ')} WHERE id = ?`,
    params,
  )
  return true
}

/**
 * Approve an instinct: set verified = true and optionally boost confidence.
 * Returns true if found and updated.
 */
export function approveInstinct(id: string): boolean {
  const existing = getInstinct(id)
  if (!existing) return false

  const newConfidence = Math.min(existing.confidence + 0.1, 1.0)
  db.run(
    'UPDATE instincts SET verified = 1, confidence = ? WHERE id = ?',
    [newConfidence, id],
  )
  return true
}

/**
 * Delete an instinct by id. Returns true if a row was deleted.
 */
export function deleteInstinct(id: string): boolean {
  const result = db.run('DELETE FROM instincts WHERE id = ?', [id])
  return result.changes > 0
}

/**
 * List instincts that are eligible for automatic application in the harness.
 * verified = true AND confidence >= APPLY_THRESHOLD
 */
export function listApplicable(): InstinctDef[] {
  return listInstincts({ verified: true, minConfidence: APPLY_THRESHOLD })
}

/**
 * List unverified instincts (for review workflow).
 */
export function listUnverified(): InstinctDef[] {
  return listInstincts({ verified: false })
}

// ── internal helpers ─────────────────────────────────────────────────────────

interface InstinctDefRow {
  id: string
  trigger: string
  action: string
  confidence: number
  source: string
  verified: number
  created_at: string
}

function rowToDef(row: InstinctDefRow): InstinctDef {
  const def: InstinctDef = {
    id: row.id,
    trigger: row.trigger,
    action: row.action,
    confidence: row.confidence,
    source: row.source as InstinctSource,
    verified: row.verified === 1,
    created_at: row.created_at,
  }
  return validateInstinct(def)
}
