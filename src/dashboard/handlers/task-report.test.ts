import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { randomUUID } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createChatSession, deleteChatSession, listChatMessages } from '../../db/chat-sessions.ts'
import { getProject, upsertProject } from '../../db/projects.ts'
import { insertRun } from '../../db/runs.ts'
import { db } from '../../db/sqlite.ts'
import { DIRTY_TREE_REASON_PREFIX } from '../../run/sandbox-policy.ts'
import { reportTaskOutcome } from './task-report.ts'
import { INTERRUPTED_REASON } from './task-run-reconcile.ts'

const roots: string[] = []
const sessions: string[] = []
const runs: string[] = []

beforeAll(async () => (await import('../../db/migrate.ts')).runMigrations())
afterAll(() => {
  for (const id of runs) db.run('DELETE FROM runs WHERE id = ?', [id])
  for (const id of sessions) deleteChatSession(id)
  for (const root of roots) {
    db.run('DELETE FROM projects WHERE path = ?', [root])
    rmSync(root, { recursive: true, force: true })
  }
})

function setup(status: string, retryReason?: string, retryCount = 0) {
  const root = mkdtempSync(join(tmpdir(), 'orchestos-task-report-'))
  roots.push(root)
  upsertProject(root, {} as Parameters<typeof upsertProject>[1], '')
  const projectId = getProject(root)?.id
  if (!projectId) throw new Error('Fixture project was not registered')
  const taskId = `report-${randomUUID()}`
  writeFileSync(
    join(root, 'tasks.yaml'),
    `version: 1\nproject: report-test\ntasks:\n  - id: ${taskId}\n    description: Report test\n    executor: openrouter\n    input: []\n    output: [out.txt]\n    depends_on: []\n    status: ${status}\n    retry_count: ${retryCount}\n${retryReason ? `    retry_reason: ${JSON.stringify(retryReason)}\n` : ''}`,
  )
  const session = createChatSession({ agent: 'api' })
  sessions.push(session.id)
  return { root, session, taskId, projectId }
}

function addRun(
  taskId: string,
  result: string,
  projectId: string | null,
  status: 'done' | 'failed' | 'blocked' = 'done',
  provider = 'unit-provider',
) {
  const id = insertRun({
    project_id: projectId,
    prompt: 'test',
    task_class: 'test',
    model: 'unit-model',
    provider,
    skill_id: null,
    task_id: taskId,
    allowed_outputs: null,
    files_attempted: null,
    files_authorized: null,
    files_blocked: null,
    files_read: null,
    read_audit_json: null,
    snapshot_before: null,
    snapshot_after: null,
    qa_verdict: null,
    qa_reason: null,
    checks_json: null,
    context_source: null,
    context_tokens: null,
    embed_hits: null,
    context_warnings_json: null,
    cost_breakdown_json: null,
    file_diffs: null,
    skill_gates_json: null,
    status,
    input_tokens: 0,
    output_tokens: 0,
    usd_cost: 0,
    elapsed_ms: 0,
    result,
  })
  runs.push(id)
  return id
}

describe('reportTaskOutcome', () => {
  it('persists diagnosis.kind and restores it in chat history', () => {
    const { root, session, taskId, projectId } = setup('failed', 'check failed')
    const runId = addRun(taskId, 'check failed', projectId, 'failed')
    db.run('UPDATE runs SET failure_kind = ? WHERE id = ?', ['check', runId])
    reportTaskOutcome(root, session.id, taskId, projectId)
    expect(listChatMessages(session.id)[0]?.taskReport?.diagnosis?.kind).toBe('check')
    db.run('UPDATE chat_messages SET task_report = ? WHERE session_id = ?', [
      JSON.stringify({ outcome: 'failed', diagnosis: { kind: 'retrying', cause: 'still here' } }),
      session.id,
    ])
    expect(listChatMessages(session.id)[0]?.taskReport?.diagnosis).toEqual({ cause: 'still here' })
  })

  it('persiste done con proveedor/modelo y recorta el resumen a 300 caracteres', () => {
    const { root, session, taskId, projectId } = setup('done')
    addRun(taskId, 'x'.repeat(350), projectId)
    reportTaskOutcome(root, session.id, taskId, projectId)
    const content = listChatMessages(session.id)[0]?.content ?? ''
    expect(content).toContain(`✓ Task \`${taskId}\` done · unit-provider/unit-model`)
    expect(content.split('\n\n> ')[1]).toHaveLength(300)
    expect(content.endsWith('…')).toBe(true)
  })

  it('usa retry_reason para failed y reporta ausencia de run', () => {
    const failed = setup('failed', 'retry this task')
    reportTaskOutcome(failed.root, failed.session.id, failed.taskId)
    expect(listChatMessages(failed.session.id)[0]?.content).toContain(`\`${failed.taskId}\` failed`)
    expect(listChatMessages(failed.session.id)[0]?.content).toContain('> retry this task')

    const missing = setup('failed')
    reportTaskOutcome(missing.root, missing.session.id, missing.taskId)
    expect(listChatMessages(missing.session.id)[0]?.content).toContain('> No run was recorded.')
  })

  it('pending con intento fallido reporta failed · attempt N/3 y el motivo', () => {
    const { root, session, taskId, projectId } = setup(
      'pending',
      'missing declared output(s): out.txt',
      2,
    )
    reportTaskOutcome(root, session.id, taskId, projectId)
    const content = listChatMessages(session.id)[0]?.content ?? ''
    expect(content).toContain(`✗ Task \`${taskId}\` failed · attempt 2/3`)
    expect(content).toContain('> missing declared output(s): out.txt')
    expect(content).not.toContain('retry scheduled')
    expect(listChatMessages(session.id)[0]?.taskReport).toEqual({
      outcome: 'pending',
      attempt: 2,
      maxAttempts: 3,
      summary: 'missing declared output(s): out.txt',
      diagnosis: { cause: 'missing declared output(s): out.txt' },
    })
  })

  it('done sin run del proyecto no afirma éxito ni adjunta un run ajeno', () => {
    const { root, session, taskId, projectId } = setup('done')
    const other = setup('done')
    addRun(taskId, 'foreign evidence', other.projectId)
    reportTaskOutcome(root, session.id, taskId, projectId)
    const message = listChatMessages(session.id)[0]
    if (!message) throw new Error('Task report was not persisted')
    expect(message.content).not.toContain('✓')
    expect(message.content).toContain('marked done in tasks.yaml · no matching run recorded')
    expect(message.taskReport).toEqual({ outcome: 'pending', summary: 'No run was recorded.' })
  })

  it('done sin projectId no usa ni siquiera un run sin proyecto', () => {
    const { root, session, taskId } = setup('done')
    addRun(taskId, 'unscoped evidence', null)
    reportTaskOutcome(root, session.id, taskId)
    const message = listChatMessages(session.id)[0]
    if (!message) throw new Error('Task report was not persisted')
    expect(message.content).not.toContain('✓')
    expect(message.taskReport?.runId).toBeUndefined()
    expect(message.taskReport?.outcome).toBe('pending')
  })

  for (const status of ['failed', 'blocked'] as const) {
    it(`yaml done con último run ${status} no afirma éxito`, () => {
      const { root, session, taskId, projectId } = setup('done')
      const old = addRun(taskId, 'old success', projectId)
      db.run('UPDATE runs SET created_at = ? WHERE id = ?', ['2000-01-01T00:00:00Z', old])
      const runId = addRun(taskId, 'measured failure', projectId, status)
      const other = setup('done')
      const foreign = addRun(taskId, 'foreign success', other.projectId)
      db.run('UPDATE runs SET created_at = ? WHERE id = ?', ['2099-01-01T00:00:00Z', foreign])
      reportTaskOutcome(root, session.id, taskId, projectId)
      const message = listChatMessages(session.id)[0]
      if (!message) throw new Error('Task report was not persisted')
      expect(message.content).not.toContain('✓')
      expect(message.content).toContain(`marked done in tasks.yaml · latest run ${status}`)
      expect(message.taskReport).toMatchObject({
        outcome: status,
        runId,
        summary: 'measured failure',
      })
    })
  }

  it('guarda el outcome estructurado en todo reporte', () => {
    const done = setup('done')
    reportTaskOutcome(done.root, done.session.id, done.taskId, done.projectId)
    expect(listChatMessages(done.session.id)[0]?.content).not.toContain('✓')
    expect(listChatMessages(done.session.id)[0]?.taskReport).toEqual({
      outcome: 'pending',
      summary: 'No run was recorded.',
    })

    const failed = setup('failed', 'boom')
    reportTaskOutcome(failed.root, failed.session.id, failed.taskId)
    expect(listChatMessages(failed.session.id)[0]?.taskReport).toEqual({
      outcome: 'failed',
      summary: 'boom',
      diagnosis: { cause: 'boom' },
    })
  })

  it('pending por árbol sucio: texto exacto y dirtyFiles leído en vivo', () => {
    const { root, session, taskId, projectId } = setup(
      'pending',
      `${DIRTY_TREE_REASON_PREFIX}viejo.txt`,
    )
    const git = (...args: string[]) =>
      Bun.spawnSync(['git', '-c', 'user.name=t', '-c', 'user.email=t@invalid', ...args], {
        cwd: root,
        env: { PATH: process.env.PATH ?? '', HOME: root },
      })
    git('init', '-b', 'master')
    git('add', 'tasks.yaml')
    git('commit', '-m', 'base')
    writeFileSync(join(root, 'sucio.txt'), 'x')
    reportTaskOutcome(root, session.id, taskId, projectId)
    const message = listChatMessages(session.id)[0]
    expect(message?.content).toBe(
      `✗ Task \`${taskId}\` not started · uncommitted changes in the project`,
    )
    expect(message?.taskReport).toEqual({ outcome: 'pending', dirtyFiles: ['sucio.txt'] })
  })
})

it('task reports persist requested and effective approval modes with registry CLI names', () => {
  for (const [provider, effective, label] of [
    ['claude', 'auto-edit', 'Claude Code'],
    ['codex', 'auto-edit', 'Codex'],
    ['opencode', 'auto-edit', 'opencode'],
  ]) {
    const { root, session, taskId, projectId } = setup('done')
    const path = join(root, 'tasks.yaml')
    writeFileSync(path, `${readFileSync(path, 'utf8')}    approvalMode: auto-edit\n`)
    addRun(taskId, 'done', projectId, 'done', provider)
    reportTaskOutcome(root, session.id, taskId, projectId)
    expect(listChatMessages(session.id)[0]?.taskReport).toMatchObject({
      approvalMode: effective,
      requestedApprovalMode: 'auto-edit',
      approvalCli: label,
    })
  }
})

function reportData(fixture: ReturnType<typeof setup>) {
  reportTaskOutcome(fixture.root, fixture.session.id, fixture.taskId, fixture.projectId)
  return listChatMessages(fixture.session.id)[0]?.taskReport
}

it('diagnosis uses the first failed deterministic check and the same evidence as Runs', () => {
  const fixture = setup('failed', 'check failed: typecheck')
  const runId = addRun(fixture.taskId, 'run failure', fixture.projectId, 'failed')
  db.run('UPDATE runs SET checks_json = ?, executor_reply = ? WHERE id = ?', [
    JSON.stringify([
      { cmd: 'lint', exitCode: 0, elapsedMs: 1, stdout: 'ok' },
      { cmd: 'typecheck', exitCode: 1, elapsedMs: 1, stderr: 'type error', stdout: 'details' },
      { cmd: 'other', exitCode: 1, elapsedMs: 1, stderr: 'later failure' },
    ]),
    'executor claimed success',
    runId,
  ])
  expect(reportData(fixture)?.diagnosis).toEqual({
    cause: 'check failed: typecheck',
    failedCheck: { command: 'typecheck', output: 'type error\ndetails' },
    executorReport: 'executor claimed success',
    runId,
  })
})

it('diagnosis includes QA reasons and treats a timed-out check as failed', () => {
  const fixture = setup('pending', 'QA rejected the result', 1)
  const runId = addRun(fixture.taskId, 'QA rejected the result', fixture.projectId, 'failed')
  db.run('UPDATE runs SET qa_verdict = ?, qa_reason = ?, checks_json = ? WHERE id = ?', [
    'fail',
    'Missing acceptance evidence',
    JSON.stringify([{ cmd: 'slow check', exitCode: 0, elapsedMs: 500, timedOut: true }]),
    runId,
  ])
  expect(reportData(fixture)?.diagnosis).toEqual({
    cause: 'QA rejected the result',
    qaReasons: ['Missing acceptance evidence'],
    failedCheck: { command: 'slow check' },
    runId,
  })
})

it('diagnosis without a matching run omits unavailable evidence', () => {
  const fixture = setup('failed', 'local failure')
  const other = setup('failed')
  addRun(fixture.taskId, 'foreign cause', other.projectId, 'failed')
  expect(reportData(fixture)?.diagnosis).toEqual({ cause: 'local failure' })
  expect(reportData(setup('failed'))?.diagnosis).toBeUndefined()
  expect(reportData(setup('pending'))?.diagnosis).toBeUndefined()
})

it('diagnosis bounds UTF-8 byte sizes and keeps the tail of failed check output', () => {
  const fixture = setup('failed', 'é'.repeat(2000))
  const runId = addRun(fixture.taskId, 'failure', fixture.projectId, 'failed')
  db.run('UPDATE runs SET checks_json = ?, executor_reply = ?, qa_reason = ? WHERE id = ?', [
    JSON.stringify([
      {
        cmd: 'check',
        exitCode: 1,
        elapsedMs: 1,
        stdout: `${'discard'.repeat(1000)}${'é'.repeat(1100)}TAIL`,
      },
    ]),
    'é'.repeat(1000),
    'ø'.repeat(2000),
    runId,
  ])
  const diagnosis = reportData(fixture)?.diagnosis
  expect(Buffer.byteLength(diagnosis?.cause ?? '')).toBe(2048)
  expect(Buffer.byteLength(diagnosis?.failedCheck?.output ?? '')).toBe(2048)
  expect(diagnosis?.failedCheck?.output?.endsWith('TAIL')).toBe(true)
  expect(Buffer.byteLength(diagnosis?.executorReport ?? '')).toBe(1024)
  expect(Buffer.byteLength(diagnosis?.qaReasons?.[0] ?? '')).toBe(2048)
})

it('diagnosis removes worktree prefixes wherever paths occur without changing other paths', () => {
  const worktree = `/tmp/project/.orchestos/worktrees/chat-${randomUUID()}-123/`
  const fixture = setup('failed', `check failed: typecheck\nError in ${worktree}src/nota.ts`)
  const runId = addRun(fixture.taskId, 'failure', fixture.projectId, 'failed')
  db.run('UPDATE runs SET checks_json = ?, executor_reply = ? WHERE id = ?', [
    JSON.stringify([
      {
        cmd: 'typecheck',
        exitCode: 2,
        elapsedMs: 1,
        stderr: `Error: ${worktree}src/nota.ts\nSee "${worktree}other.ts" and /tmp/keep.ts`,
        stdout: `Checked ${worktree}nota.ts`,
      },
    ]),
    `Edited \`${worktree}nota.ts\` and ${worktree}src/other.ts.\nKept /tmp/keep.ts.`,
    runId,
  ])
  expect(reportData(fixture)?.diagnosis).toEqual({
    cause: 'check failed: typecheck\nError in src/nota.ts',
    failedCheck: {
      command: 'typecheck',
      output: 'Error: src/nota.ts\nSee "other.ts" and /tmp/keep.ts\nChecked nota.ts',
    },
    executorReport: 'Edited `nota.ts` and src/other.ts.\nKept /tmp/keep.ts.',
    runId,
  })
})

it('diagnosis omits QA reasons equal to or contained in the complete cause after whitespace normalization', () => {
  for (const reason of [
    ' check failed: typecheck\n type error at nota.ts ',
    'type error\n at nota.ts',
  ]) {
    const fixture = setup('failed', 'check failed: typecheck\n\ntype error at nota.ts')
    const runId = addRun(fixture.taskId, 'failure', fixture.projectId, 'failed')
    db.run('UPDATE runs SET qa_reason = ? WHERE id = ?', [reason, runId])
    expect(reportData(fixture)?.diagnosis).toEqual({
      cause: 'check failed: typecheck\n\ntype error at nota.ts',
      runId,
    })
  }
})

it('interruptions remain failed and carry only the resume marker, without diagnosis', () => {
  const fixture = setup('failed', INTERRUPTED_REASON)
  addRun(fixture.taskId, 'old failure', fixture.projectId, 'failed')
  const report = reportData(fixture)
  expect(report?.outcome).toBe('failed')
  expect(report?.interrupted).toBe(true)
  expect(report?.diagnosis).toBeUndefined()
  expect(reportData(setup('failed', 'Interrupted: another failure'))?.interrupted).toBeUndefined()
})
