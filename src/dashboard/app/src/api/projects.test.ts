import { describe, expect, test } from 'bun:test'
import { parseDiffPatch } from '../components/dev/OrcaRightInspector'
import { mapProjectRow, mapSessionToAgent, timeSince } from './projects'
import { mapRunRow } from './runs'

describe('projects API mappings', () => {
  test('maps the registered path to a project without inventing branch or files', () => {
    expect(
      mapProjectRow({ id: 'p1', path: '/work/alpha', stackProfile: 'ts', lastUpdated: 'now' }),
    ).toEqual({
      id: 'p1',
      name: 'alpha',
      path: '/work/alpha',
      filesCount: 0,
      agents: [],
    })
  })

  test('maps pending sessions to active agents and completed sessions to checks', () => {
    const session = {
      id: 's1',
      projectId: 'p1',
      agent: 'codex',
      mode: 'code' as const,
      title: 'Build',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:05:00Z',
    }
    expect(mapSessionToAgent(session, { kind: 'pending' }).status).toBe('active')
    expect(mapSessionToAgent(session, { kind: 'none' }).status).toBe('completed')
  })

  test('maps API runs without inventing a diff', () => {
    const run = mapRunRow({
      id: 'r1',
      taskId: 'task-1',
      status: 'done',
      qaVerdict: 'pass',
      model: 'codex',
      provider: 'codex',
      inputTokens: 2,
      outputTokens: 3,
      costUsd: null,
      elapsedMs: 20,
      engine: 'codex',
      iterations: 1,
      fileDiffs: [{ path: 'src/a.ts', status: 'modified', diff: '+x' }],
      costBreakdown: [],
      contextWarnings: [],
      createdAt: '2026-01-01T00:00:00Z',
    })
    expect(run.fileDiffs).toHaveLength(1)
    expect(run.costUsd).toBe(0)
    expect(run.agentModel).toBe('codex')
  })

  test('maps failed QA criteria without evidence and passed criteria with literal evidence', () => {
    const run = mapRunRow({
      id: 'r-qa',
      taskId: 'task-qa',
      status: 'failed',
      qaVerdict: 'fail',
      qaReason: 'criterion mismatch',
      qaModel: 'judge-model',
      checks: [
        { cmd: 'test', exitCode: 1, elapsedMs: 20, stderr: 'TRUST1-MARKER', stdout: 'stdout' },
      ],
      qaCriteria: [
        { text: 'bad criterion', pass: false },
        { text: 'good criterion', pass: true, evidence: { file: 'ok.txt', excerpt: 'VERDE' } },
      ],
      model: 'codex',
      provider: 'codex',
      inputTokens: 0,
      outputTokens: 0,
      costUsd: null,
      elapsedMs: 0,
      engine: 'codex',
      iterations: 1,
      fileDiffs: [],
      costBreakdown: [],
      contextWarnings: [],
      createdAt: '2026-01-01T00:00:00Z',
    })
    expect(run.qaModel).toBe('judge-model')
    expect(run.qaEvaluation[0]).toEqual({
      kind: 'judge',
      criterion: 'QA verdict: fail',
      passed: false,
      rationale: 'criterion mismatch',
    })
    expect(run.deterministicChecks[0]?.output).toBe('TRUST1-MARKER\nstdout')
    expect(run.qaEvaluation).toContainEqual({
      kind: 'criterion',
      criterion: 'bad criterion',
      passed: false,
      rationale: 'no evidence in written files',
    })
    expect(run.qaEvaluation).toContainEqual({
      kind: 'criterion',
      criterion: 'good criterion',
      passed: true,
      rationale: 'ok.txt: VERDE',
    })
  })

  test('does not invent a judge verdict when a deterministic check fails', () => {
    const run = mapRunRow({
      id: 'r-check',
      taskId: 'task-check',
      status: 'failed',
      qaVerdict: 'fail',
      qaModel: null,
      qaReason: 'check failed',
      checks: [{ cmd: 'test', exitCode: 1, elapsedMs: 20, stderr: 'MARKER' }],
      model: 'codex',
      provider: 'codex',
      inputTokens: 0,
      outputTokens: 0,
      costUsd: null,
      elapsedMs: 20,
      engine: 'codex',
      iterations: 1,
      fileDiffs: [],
      costBreakdown: [],
      contextWarnings: [],
      createdAt: 'now',
    })
    expect(run.qaModel).toBeNull()
    expect(run.qaEvaluation).toEqual([])
    expect(run.deterministicChecks[0]?.passed).toBe(false)
    expect(run.deterministicChecks[0]?.output).toBe('MARKER')
  })

  test('maps skipped QA as not run and never as passed', () => {
    const run = mapRunRow({
      id: 'r-skipped',
      taskId: 'task-skipped',
      status: 'done',
      qaVerdict: 'skipped',
      qaReason: 'Sin revisión LLM y sin checks: nada verificó esta tarea',
      model: 'codex',
      provider: 'codex',
      inputTokens: 0,
      outputTokens: 0,
      costUsd: null,
      elapsedMs: 0,
      engine: 'codex',
      iterations: 1,
      fileDiffs: [],
      costBreakdown: [],
      contextWarnings: [],
      createdAt: 'now',
    })
    expect(run.qaVerdict).toBe('skipped')
    expect(run.qaEvaluation).toEqual([
      {
        kind: 'skipped',
        criterion: 'QA: no corrió',
        passed: false,
        rationale: 'Sin revisión LLM y sin checks: nada verificó esta tarea',
      },
    ])
  })

  test('maps unevaluated runs without turning them into failures', () => {
    const run = mapRunRow({
      id: 'chat-1',
      taskId: null,
      status: 'done',
      qaVerdict: null,
      model: 'claude-model',
      provider: 'claude',
      inputTokens: 0,
      outputTokens: 0,
      costUsd: null,
      elapsedMs: 0,
      engine: null,
      iterations: null,
      fileDiffs: [],
      costBreakdown: [],
      contextWarnings: [],
      createdAt: '2026-01-01T00:00:00Z',
    })
    expect(run.qaVerdict).toBeNull()
    expect(run.agentModel).toBe('claude-model')
  })

  test('parses additions and deletions with and without diff headers', () => {
    expect(
      parseDiffPatch(
        'Index: src/utils/helper.js\n==============================\n--- src/utils/helper.js\n+++ src/utils/helper.js\n@@ -1 +1,2 @@\n-old\n+new\n+extra',
      ),
    ).toEqual({
      lines: [
        '--- src/utils/helper.js',
        '+++ src/utils/helper.js',
        '@@ -1 +1,2 @@',
        '-old',
        '+new',
        '+extra',
      ],
      additions: 2,
      deletions: 1,
    })
    expect(parseDiffPatch('@@ -1 +1 @@\n-old\n+new')).toEqual({
      lines: ['@@ -1 +1 @@', '-old', '+new'],
      additions: 1,
      deletions: 1,
    })
  })
})

describe('timeSince', () => {
  test('measures time since last activity, not session lifetime', () => {
    const now = Date.parse('2026-09-22T12:00:00Z')
    expect(timeSince('2026-09-22T11:43:00Z', now)).toBe('17m')
    expect(timeSince('2026-09-22T10:30:00Z', now)).toBe('1h')
    expect(timeSince('2026-09-18T21:12:15Z', now)).toBe('3d')
  })
})
