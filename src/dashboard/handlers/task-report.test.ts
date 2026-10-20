import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { randomUUID } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createChatSession, deleteChatSession, listChatMessages } from '../../db/chat-sessions.ts'
import { insertRun } from '../../db/runs.ts'
import { db } from '../../db/sqlite.ts'
import { DIRTY_TREE_REASON_PREFIX } from '../../run/sandbox-policy.ts'
import { reportTaskOutcome } from './task-report.ts'

const roots: string[] = []
const sessions: string[] = []
const runs: string[] = []

beforeAll(async () => (await import('../../db/migrate.ts')).runMigrations())
afterAll(() => {
  for (const id of runs) db.run('DELETE FROM runs WHERE id = ?', [id])
  for (const id of sessions) deleteChatSession(id)
  for (const root of roots) rmSync(root, { recursive: true, force: true })
})

function setup(status: string, retryReason?: string, retryCount = 0) {
  const root = mkdtempSync(join(tmpdir(), 'orchestos-task-report-'))
  roots.push(root)
  const taskId = `report-${randomUUID()}`
  writeFileSync(
    join(root, 'tasks.yaml'),
    `version: 1\nproject: report-test\ntasks:\n  - id: ${taskId}\n    description: Report test\n    executor: openrouter\n    input: []\n    output: [out.txt]\n    depends_on: []\n    status: ${status}\n    retry_count: ${retryCount}\n${retryReason ? `    retry_reason: ${JSON.stringify(retryReason)}\n` : ''}`,
  )
  const session = createChatSession({ agent: 'api' })
  sessions.push(session.id)
  return { root, session, taskId }
}

function addRun(taskId: string, result: string, provider = 'unit-provider') {
  const id = insertRun({
    project_id: null,
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
    status: 'done',
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
  it('persiste done con proveedor/modelo y recorta el resumen a 300 caracteres', () => {
    const { root, session, taskId } = setup('done')
    addRun(taskId, 'x'.repeat(350))
    reportTaskOutcome(root, session.id, taskId)
    const content = listChatMessages(session.id)[0]?.content ?? ''
    expect(content).toContain(`\`${taskId}\` done · unit-provider/unit-model`)
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
    const { root, session, taskId } = setup('pending', 'missing declared output(s): out.txt', 2)
    reportTaskOutcome(root, session.id, taskId)
    const content = listChatMessages(session.id)[0]?.content ?? ''
    expect(content).toContain(`✗ Task \`${taskId}\` failed · attempt 2/3`)
    expect(content).toContain('> missing declared output(s): out.txt')
    expect(content).not.toContain('retry scheduled')
    expect(listChatMessages(session.id)[0]?.taskReport).toEqual({
      outcome: 'pending',
      attempt: 2,
      maxAttempts: 3,
      summary: 'missing declared output(s): out.txt',
    })
  })

  it('usa el run disponible cuando projectId no coincide', () => {
    const { root, session, taskId } = setup('done')
    const runId = addRun(taskId, 'available run')
    reportTaskOutcome(root, session.id, taskId, 'different-project')
    const content = listChatMessages(session.id)[0]?.content ?? ''
    expect(content).toContain(`\`${taskId}\` done · unit-provider/unit-model`)
    expect(content).toContain('> available run')
    expect(listChatMessages(session.id)[0]?.taskReport).toEqual({
      outcome: 'done',
      provider: 'unit-provider',
      model: 'unit-model',
      runId,
      summary: 'available run',
    })
  })

  it('guarda el outcome estructurado en todo reporte', () => {
    const done = setup('done')
    reportTaskOutcome(done.root, done.session.id, done.taskId)
    expect(listChatMessages(done.session.id)[0]?.taskReport).toEqual({
      outcome: 'done',
      summary: 'No run was recorded.',
    })

    const failed = setup('failed', 'boom')
    reportTaskOutcome(failed.root, failed.session.id, failed.taskId)
    expect(listChatMessages(failed.session.id)[0]?.taskReport).toEqual({
      outcome: 'failed',
      summary: 'boom',
    })
  })

  it('pending por árbol sucio: texto exacto y dirtyFiles leído en vivo', () => {
    const { root, session, taskId } = setup('pending', `${DIRTY_TREE_REASON_PREFIX}viejo.txt`)
    const git = (...args: string[]) =>
      Bun.spawnSync(['git', '-c', 'user.name=t', '-c', 'user.email=t@invalid', ...args], {
        cwd: root,
        env: { PATH: process.env.PATH ?? '', HOME: root },
      })
    git('init', '-b', 'master')
    git('add', 'tasks.yaml')
    git('commit', '-m', 'base')
    writeFileSync(join(root, 'sucio.txt'), 'x')
    reportTaskOutcome(root, session.id, taskId)
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
    ['opencode', 'full', 'opencode'],
  ]) {
    const { root, session, taskId } = setup('done')
    const path = join(root, 'tasks.yaml')
    writeFileSync(path, readFileSync(path, 'utf8') + '    approvalMode: auto-edit\n')
    addRun(taskId, 'done', provider)
    reportTaskOutcome(root, session.id, taskId)
    expect(listChatMessages(session.id)[0]?.taskReport).toMatchObject({
      approvalMode: effective,
      requestedApprovalMode: 'auto-edit',
      approvalCli: label,
    })
  }
})
