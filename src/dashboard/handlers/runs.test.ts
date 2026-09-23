import { describe, expect, test } from 'bun:test'
import { runRecordToRow } from './runs.ts'

describe('runRecordToRow', () => {
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
