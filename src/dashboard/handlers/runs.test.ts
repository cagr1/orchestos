import { describe, expect, test } from 'bun:test'
import { getRun, insertRun } from '../../db/runs.ts'
import { db } from '../../db/sqlite.ts'
import { runRecordToRow } from './runs.ts'

describe('runRecordToRow', () => {
  test('persists QA criteria and returns them through the run row handler mapping', async () => {
    await (await import('../../db/migrate.ts')).runMigrations()
    const id = insertRun({
      project_id: null,
      prompt: 'test',
      task_class: 'test',
      model: 'model',
      provider: 'test',
      skill_id: null,
      task_id: 'qa-criteria-test',
      allowed_outputs: null,
      files_attempted: null,
      files_authorized: null,
      files_blocked: null,
      files_read: null,
      read_audit_json: null,
      snapshot_before: null,
      snapshot_after: null,
      qa_verdict: 'fail',
      qa_reason: 'missing line',
      qa_criteria_json: JSON.stringify([{ text: 'target line exists', pass: false }]),
      checks_json: null,
      constitution_rules: null,
      context_source: null,
      context_tokens: null,
      embed_hits: null,
      context_warnings_json: null,
      cost_breakdown_json: null,
      file_diffs: null,
      adversarial_verdict: null,
      adversarial_reason: null,
      refuter_verdict: null,
      refuter_reason: null,
      skill_gates_json: null,
      status: 'failed',
      input_tokens: 0,
      output_tokens: 0,
      usd_cost: 0,
      elapsed_ms: 0,
      result: null,
    })
    try {
      const saved = getRun(id)
      if (!saved) throw new Error('inserted run was not persisted')
      expect(runRecordToRow(saved).qaCriteria).toEqual([
        { text: 'target line exists', pass: false },
      ])
    } finally {
      db.run('DELETE FROM runs WHERE id = ?', [id])
    }
  })

  test('exposes real evidence and tolerates malformed JSON columns', () => {
    const row = runRecordToRow({
      id: 'run-1',
      project_id: 'project-1',
      prompt: 'Implement feature\nwith more detail',
      task_class: 'task',
      model: 'gpt-5.6-luna',
      provider: 'codex',
      skill_id: null,
      task_id: 'task-1',
      allowed_outputs: '["src/app.ts"]',
      files_attempted: 'not-json',
      files_authorized: '["src/app.ts"]',
      files_blocked: '[]',
      snapshot_before: null,
      snapshot_after: null,
      qa_verdict: 'pass',
      qa_reason: 'All criteria met',
      qa_model: 'qa-model',
      checks_json: '[{"cmd":"bun test","exitCode":0,"elapsedMs":12}]',
      constitution_rules: null,
      context_source: null,
      context_tokens: null,
      embed_hits: null,
      context_warnings_json: null,
      cost_breakdown_json: null,
      file_diffs: null,
      adversarial_verdict: 'PASS',
      adversarial_reason: 'No issue',
      refuter_verdict: null,
      refuter_reason: null,
      skill_gates_json: null,
      status: 'done',
      input_tokens: 10,
      cache_read_tokens: 0,
      cache_write_tokens: 0,
      cli_session_id: null,
      output_tokens: 20,
      usd_cost: 0.01,
      elapsed_ms: 1000,
      result: 'done',
      created_at: '2026-09-23T00:00:00Z',
    })

    expect(row.prompt).toBe('Implement feature\nwith more detail')
    expect(row.allowedOutputs).toEqual(['src/app.ts'])
    expect(row.filesAttempted).toEqual([])
    expect(row.checks).toEqual([{ cmd: 'bun test', exitCode: 0, elapsedMs: 12 }])
    expect(row.qaReason).toBe('All criteria met')
    expect(row.adversarialVerdict).toBe('PASS')
  })
})
