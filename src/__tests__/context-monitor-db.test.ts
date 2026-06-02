/**
 * S27.6 — Integration tests for context_warnings_json persistence.
 *
 * Validates that:
 *   - context_warnings_json column is created by migration
 *   - insertRun stores warnings as JSON; getRun returns them
 *   - null stored when no warnings (default)
 *   - multiple warning objects are serialized correctly
 */

import { describe, it, expect, beforeAll } from 'bun:test'
import { insertRun, getRun } from '../db/runs.ts'
import { db } from '../db/sqlite.ts'
import { runMigrations } from '../db/migrate.ts'

beforeAll(() => {
  runMigrations()
})

function baseRun(): Parameters<typeof insertRun>[0] {
  return {
    project_id: null,
    prompt: 'test prompt',
    task_class: 'implement',
    model: 'test-model',
    provider: 'test',
    skill_id: null,
    task_id: null,
    allowed_outputs: null,
    files_attempted: null,
    files_authorized: null,
    files_blocked: null,
    snapshot_before: null,
    snapshot_after: null,
    qa_verdict: null,
    qa_reason: null,
    status: 'done',
    input_tokens: 10,
    output_tokens: 20,
    usd_cost: 0.001,
    elapsed_ms: 500,
    result: 'ok',
  }
}

describe('context_warnings_json — migration', () => {
  it('column exists in runs table after migration', () => {
    const cols = db.query<{ name: string }, string>(
      'PRAGMA table_info(runs)'
    ).all('runs').map(r => r.name)
    expect(cols).toContain('context_warnings_json')
  })
})

describe('context_warnings_json — insertRun / getRun', () => {
  it('stores null when context_warnings_json is omitted', () => {
    const id = insertRun(baseRun())
    const r = getRun(id)!
    expect(r.context_warnings_json).toBeNull()
  })

  it('stores null when context_warnings_json is explicitly null', () => {
    const id = insertRun({ ...baseRun(), context_warnings_json: null })
    const r = getRun(id)!
    expect(r.context_warnings_json).toBeNull()
  })

  it('stores JSON string for a single warning', () => {
    const warnings = [{ code: 'context_warning', severity: 'warning', message: 'Context low: 30% remaining' }]
    const id = insertRun({ ...baseRun(), context_warnings_json: JSON.stringify(warnings) })
    const r = getRun(id)!
    expect(r.context_warnings_json).toBe(JSON.stringify(warnings))
    const parsed = JSON.parse(r.context_warnings_json!)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].code).toBe('context_warning')
    expect(parsed[0].severity).toBe('warning')
  })

  it('stores JSON for multiple warnings at once', () => {
    const warnings = [
      { code: 'context_critical', severity: 'critical', message: 'Context critically low: 18% remaining' },
      { code: 'cost_notice',      severity: 'notice',   message: 'Cumulative cost $6.50 exceeds $5.00' },
      { code: 'scope_creep',      severity: 'warning',  message: 'Scope creep: 25 files modified' },
    ]
    const id = insertRun({ ...baseRun(), context_warnings_json: JSON.stringify(warnings) })
    const r = getRun(id)!
    const parsed = JSON.parse(r.context_warnings_json!)
    expect(parsed).toHaveLength(3)
    expect(parsed.map((w: { code: string }) => w.code)).toEqual(
      ['context_critical', 'cost_notice', 'scope_creep']
    )
  })

  it('round-trips loop_detected warning', () => {
    const warnings = [{ code: 'loop_detected', severity: 'warning', message: "Possible loop: 'read' called 3+ times consecutively" }]
    const id = insertRun({ ...baseRun(), context_warnings_json: JSON.stringify(warnings) })
    const r = getRun(id)!
    const parsed = JSON.parse(r.context_warnings_json!)
    expect(parsed[0].code).toBe('loop_detected')
  })
})
