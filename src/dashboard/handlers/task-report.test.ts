import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { randomUUID } from 'node:crypto'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createChatSession, deleteChatSession, listChatMessages } from '../../db/chat-sessions.ts'
import { insertRun } from '../../db/runs.ts'
import { db } from '../../db/sqlite.ts'
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

function setup(status: string, retryReason?: string) {
  const root = mkdtempSync(join(tmpdir(), 'orchestos-task-report-'))
  roots.push(root)
  const taskId = `report-${randomUUID()}`
  writeFileSync(
    join(root, 'tasks.yaml'),
    `version: 1\nproject: report-test\ntasks:\n  - id: ${taskId}\n    description: Report test\n    executor: openrouter\n    input: []\n    output: [out.txt]\n    depends_on: []\n    status: ${status}\n    retry_count: 0\n${retryReason ? `    retry_reason: ${JSON.stringify(retryReason)}\n` : ''}`,
  )
  const session = createChatSession({ agent: 'api' })
  sessions.push(session.id)
  return { root, session, taskId }
}

function addRun(taskId: string, result: string) {
  const id = insertRun({
    project_id: null,
    prompt: 'test',
    task_class: 'test',
    model: 'unit-model',
    provider: 'unit-provider',
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
    status: 'done',
    input_tokens: 0,
    output_tokens: 0,
    usd_cost: 0,
    elapsed_ms: 0,
    result,
  })
  runs.push(id)
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

  it('usa el run disponible cuando projectId no coincide', () => {
    const { root, session, taskId } = setup('done')
    addRun(taskId, 'available run')
    reportTaskOutcome(root, session.id, taskId, 'different-project')
    const content = listChatMessages(session.id)[0]?.content ?? ''
    expect(content).toContain(`\`${taskId}\` done · unit-provider/unit-model`)
    expect(content).toContain('> available run')
  })
})
