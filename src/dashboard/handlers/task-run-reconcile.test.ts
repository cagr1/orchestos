import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { randomUUID } from 'node:crypto'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createChatSession, deleteChatSession, listChatMessages } from '../../db/chat-sessions.ts'
import { getProject, purgeProject, upsertProject } from '../../db/projects.ts'
import { insertRun } from '../../db/runs.ts'
import { db } from '../../db/sqlite.ts'
import { getTaskLaunch, insertTaskLaunch, taskLaunchSettled } from '../../db/task-launches.ts'
import { listTaskRunWatch, upsertTaskRunWatch } from '../../db/task-run-watch.ts'
import { DIRTY_TREE_REASON_PREFIX } from '../../run/sandbox-policy.ts'
import { loadTasks } from '../../tasks/loader.ts'
import { settleTaskRun } from './task-report.ts'
import {
  commandIsRunnerOf,
  INTERRUPTED_REASON,
  type RunnerProbe,
  reconcileTaskRuns,
  settleExitedTaskRun,
  taskRunSettled,
} from './task-run-reconcile.ts'

const roots: string[] = []
const sessions: string[] = []
const runs: string[] = []

beforeAll(async () => (await import('../../db/migrate.ts')).runMigrations())
afterAll(() => {
  for (const id of runs) db.run('DELETE FROM runs WHERE id = ?', [id])
  for (const id of sessions) deleteChatSession(id)
  for (const root of roots) {
    const project = getProject(root)
    if (project) purgeProject(project.id)
    db.run('DELETE FROM task_run_watch WHERE root = ?', [root])
    db.run('DELETE FROM task_launches WHERE root = ?', [root])
    rmSync(root, { recursive: true, force: true })
  }
})

const noSchedule = () => ({ stop() {} })
const alive: RunnerProbe = () => true
const dead: RunnerProbe = () => false

function setup(
  status: string,
  opts: { withSession?: boolean; registerProject?: boolean; withLaunch?: boolean } = {},
) {
  const retryCount = status === 'pending' ? 1 : 0
  const root = mkdtempSync(join(tmpdir(), 'orchestos-reconcile-'))
  roots.push(root)
  const taskId = `reconcile-${randomUUID()}`
  writeFileSync(
    join(root, 'tasks.yaml'),
    `version: 1\nproject: reconcile-test\ntasks:\n  - id: ${taskId}\n    description: Reconcile test\n    executor: openrouter\n    input: []\n    output: [out.txt]\n    depends_on: []\n    status: ${status}\n    retry_count: ${retryCount}\n`,
  )
  if (opts.registerProject !== false) upsertProject(root, {} as never, '')
  let sessionId: string | null = null
  if (opts.withSession !== false) {
    sessionId = createChatSession({ agent: 'api' }).id
    sessions.push(sessionId)
  }
  const launchId = opts.withLaunch ? randomUUID() : null
  if (launchId)
    insertTaskLaunch({
      id: launchId,
      root,
      task_id: taskId,
      project_id: getProject(root)?.id ?? null,
      session_id: sessionId,
      pid: 999_999,
      started_at: new Date().toISOString(),
    })
  const row = upsertTaskRunWatch({
    launch_id: launchId,
    root,
    task_id: taskId,
    project_id: null,
    session_id: sessionId,
    pid: 999_999,
  })
  return { root, taskId, sessionId, row }
}

const reports = (sessionId: string, taskId: string) =>
  listChatMessages(sessionId).filter((m) => m.task_id === taskId)

const watching = (root: string) => listTaskRunWatch().filter((r) => r.root === root)

describe('reconcileTaskRuns', () => {
  for (const status of ['done', 'failed', 'failed_permanent', 'blocked']) {
    it(`terminal (${status}): reporta una vez y borra la fila, con el runner vivo o muerto`, () => {
      for (const probe of [alive, dead]) {
        const { root, taskId, sessionId } = setup(status)
        reconcileTaskRuns({ probe, schedule: noSchedule }).stop()
        expect(reports(sessionId as string, taskId)).toHaveLength(1)
        expect(reports(sessionId as string, taskId)[0]?.content).toContain(`Task \`${taskId}\``)
        expect(watching(root)).toHaveLength(0)
      }
    })
  }

  it('pending con reintento: reporta el reintento programado', () => {
    const { root, taskId, sessionId } = setup('pending')
    reconcileTaskRuns({ probe: dead, schedule: noSchedule }).stop()
    expect(reports(sessionId as string, taskId)[0]?.content).toContain('failed · attempt 1/3')
    expect(watching(root)).toHaveLength(0)
  })

  it('running + runner vivo: vigila y no reporta; al morir lo marca interrumpido', () => {
    const { root, taskId, sessionId } = setup('running')
    let isAlive = true
    let tick: (() => void) | null = null
    const handle = reconcileTaskRuns({
      probe: () => isAlive,
      schedule: (fn) => {
        tick = fn
        return { stop() {} }
      },
    })
    expect(reports(sessionId as string, taskId)).toHaveLength(0)
    expect(watching(root)).toHaveLength(1)
    expect(loadTasks(root).tasks[0]?.status).toBe('running')
    isAlive = false
    ;(tick as unknown as () => void)()
    handle.stop()
    expect(loadTasks(root).tasks[0]?.status).toBe('failed')
    expect(reports(sessionId as string, taskId)).toHaveLength(1)
    expect(watching(root)).toHaveLength(0)
  })

  it('running + runner muerto: falla con el motivo de interrupción y lo reporta', () => {
    const { root, taskId, sessionId } = setup('running')
    reconcileTaskRuns({ probe: dead, schedule: noSchedule }).stop()
    const task = loadTasks(root).tasks[0]
    expect(task?.status).toBe('failed')
    expect(task?.retry_reason).toBe(INTERRUPTED_REASON)
    const [report] = reports(sessionId as string, taskId)
    expect(report?.content).toContain(`✗ Task \`${taskId}\` failed`)
    expect(report?.content).toContain('Interrupted')
    expect(watching(root)).toHaveLength(0)
  })

  it('tarea inexistente o proyecto no registrado: borra la fila sin reportar', () => {
    const gone = setup('done', { registerProject: false })
    const noTask = setup('done')
    writeFileSync(
      join(noTask.root, 'tasks.yaml'),
      'version: 1\nproject: reconcile-test\ntasks: []\n',
    )
    reconcileTaskRuns({ probe: dead, schedule: noSchedule }).stop()
    expect(watching(gone.root)).toHaveLength(0)
    expect(watching(noTask.root)).toHaveLength(0)
    expect(reports(gone.sessionId as string, gone.taskId)).toHaveLength(0)
    expect(reports(noTask.sessionId as string, noTask.taskId)).toHaveLength(0)
  })

  it('fila sin session_id: reconcilia el estado sin mensaje', () => {
    const { root } = setup('running', { withSession: false })
    reconcileTaskRuns({ probe: dead, schedule: noSchedule }).stop()
    expect(loadTasks(root).tasks[0]?.status).toBe('failed')
    expect(watching(root)).toHaveLength(0)
  })

  it('una fila que lanza no impide las demás', () => {
    const bad = setup('done')
    db.run('UPDATE task_run_watch SET session_id = ? WHERE root = ?', ['no-such-session', bad.root])
    const good = setup('done')
    expect(() => reconcileTaskRuns({ probe: dead, schedule: noSchedule }).stop()).not.toThrow()
    expect(reports(good.sessionId as string, good.taskId)).toHaveLength(1)
  })
})

describe('settleExitedTaskRun', () => {
  it('runner salido con la tarea en running: failed con el motivo, un reporte, fila borrada', () => {
    const { root, taskId, sessionId, row } = setup('running')
    settleExitedTaskRun(row)
    const task = loadTasks(root).tasks[0]
    expect(task?.status).toBe('failed')
    expect(task?.retry_reason).toBe(INTERRUPTED_REASON)
    const found = reports(sessionId as string, taskId)
    expect(found).toHaveLength(1)
    expect(found[0]?.content).toContain('Interrupted')
    expect(watching(root)).toHaveLength(0)
  })

  it('runner salido con la tarea en done: reporte normal, estado intacto', () => {
    const { root, taskId, sessionId, row } = setup('done')
    const projectId = getProject(root)?.id
    if (!projectId) throw new Error('Fixture project was not registered')
    const runId = insertRun({
      project_id: projectId,
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
      result: 'test',
    })
    runs.push(runId)
    const projectRow = upsertTaskRunWatch({ ...row, project_id: projectId })
    settleExitedTaskRun(projectRow)
    expect(loadTasks(root).tasks[0]?.status).toBe('done')
    const found = reports(sessionId as string, taskId)
    expect(found).toHaveLength(1)
    expect(found[0]?.content).toContain(`✓ Task \`${taskId}\` done`)
    expect(watching(root)).toHaveLength(0)
  })

  it('ignora el lanzamiento viejo si ya existe otro PID para la misma tarea', () => {
    const { root, taskId, sessionId, row } = setup('running')
    const newer = upsertTaskRunWatch({
      root,
      task_id: taskId,
      project_id: null,
      session_id: sessionId,
      pid: row.pid + 1,
    })
    settleExitedTaskRun(row)
    expect(loadTasks(root).tasks[0]?.status).toBe('running')
    expect(reports(sessionId as string, taskId)).toHaveLength(0)
    expect(watching(root)).toEqual([newer])
  })
})

describe('settleTaskRun', () => {
  it('es idempotente: un segundo cierre no duplica el reporte', () => {
    const { root, taskId, sessionId, row } = setup('done')
    settleTaskRun(row, { outcome: 'completed', reason: null })
    expect(reports(sessionId as string, taskId)).toHaveLength(1)
    settleTaskRun(row, { outcome: 'completed', reason: null })
    expect(reports(sessionId as string, taskId)).toHaveLength(1)
    expect(watching(root)).toHaveLength(0)
  })

  it('revierte el reclamo si falla el reporte y permite reintentar', () => {
    const { root, taskId, sessionId, row } = setup('done', { withLaunch: true })
    const originalError = console.error
    console.error = () => {}
    try {
      settleTaskRun(row, { outcome: 'completed', reason: null }, () => {
        throw new Error('injected append failure')
      })
    } finally {
      console.error = originalError
    }
    expect(reports(sessionId as string, taskId)).toHaveLength(0)
    expect(watching(root)).toHaveLength(1)
    expect(taskLaunchSettled(required(getTaskLaunch(required(row.launch_id))))).toBeNull()
    settleTaskRun(row, { outcome: 'completed', reason: null })
    expect(reports(sessionId as string, taskId)).toHaveLength(1)
    expect(watching(root)).toHaveLength(0)
  })
})

describe('commandIsRunnerOf', () => {
  it('exige que el ID termine o tenga un límite de argumento', () => {
    expect(commandIsRunnerOf('task run --id task-10', 'task-1')).toBe(false)
    expect(commandIsRunnerOf('task run --id task-1', 'task-1')).toBe(true)
    expect(commandIsRunnerOf('task run --id task-1 --model x', 'task-1')).toBe(true)
  })
})

it('AUD.20 unreadable tasks keep the watch and polling alive', () => {
  const { root } = setup('running')
  writeFileSync(join(root, 'tasks.yaml'), 'tasks: [invalid')
  let scheduled = false
  const handle = reconcileTaskRuns({
    probe: dead,
    schedule: () => {
      scheduled = true
      return { stop() {} }
    },
  })
  try {
    expect(watching(root)).toHaveLength(1)
    expect(scheduled).toBe(true)
  } finally {
    handle.stop()
  }
})

it('AUD.20 deleting a run clears required trials and nullable turn references with foreign keys on', async () => {
  const { deleteRun } = await import('../../db/runs.ts')
  const prior = db.query<{ foreign_keys: number }, []>('PRAGMA foreign_keys').get()!.foreign_keys
  const id = randomUUID()
  const session = createChatSession({ agent: 'api' }).id
  const turn = randomUUID()
  db.exec('PRAGMA foreign_keys = ON')
  try {
    db.run(
      "INSERT INTO runs (id, prompt, task_class, model, provider, status, created_at) VALUES (?, 'test', 'test', 'mock', 'mock', 'done', 'now')",
      [id],
    )
    db.run(
      "INSERT INTO eval_trials (run_id, eval_task_id, trial_index, batch_id, config_json, passed, created_at) VALUES (?, 'test', 0, 'test', '{}', 1, 'now')",
      [id],
    )
    db.run(
      "INSERT INTO chat_turns (id, session_id, request_key, input_fingerprint, status, run_id, created_at, updated_at) VALUES (?, ?, 'aud20', 'test', 'completed', ?, 'now', 'now')",
      [turn, session, id],
    )
    expect(deleteRun(id)).toBe(true)
    expect(db.query('SELECT id FROM eval_trials WHERE run_id = ?').all(id)).toHaveLength(0)
    expect(
      db
        .query<{ run_id: string | null }, [string]>('SELECT run_id FROM chat_turns WHERE id = ?')
        .get(turn)?.run_id,
    ).toBeNull()
  } finally {
    db.run('DELETE FROM eval_trials WHERE run_id = ?', [id])
    deleteChatSession(session)
    db.run('DELETE FROM runs WHERE id = ?', [id])
    db.exec(`PRAGMA foreign_keys = ${prior}`)
  }
})

describe('task launch result mapping', () => {
  const cases = [
    ['done', 'ignored', 'completed', null],
    ['failed', 'QA failed', 'failed', 'QA failed'],
    ['failed_permanent', 'exhausted', 'failed', 'exhausted'],
    ['blocked', undefined, 'blocked', null],
    ['blocked', 'approval', 'blocked', 'approval'],
    ['pending', `${DIRTY_TREE_REASON_PREFIX}a.txt`, 'blocked', `${DIRTY_TREE_REASON_PREFIX}a.txt`],
    ['pending', 'Context budget exhausted', 'blocked', 'Context budget exhausted'],
    ['pending', undefined, 'interrupted', INTERRUPTED_REASON],
    ['running', undefined, 'interrupted', INTERRUPTED_REASON],
  ] as const
  for (const [status, reason, outcome, expectedReason] of cases) {
    it(`${status} / ${reason ?? 'no reason'}`, () => {
      expect(taskRunSettled({ status, retry_reason: reason }, false)).toEqual({
        outcome,
        reason: expectedReason,
      })
      expect(taskRunSettled({ status, retry_reason: reason }, true)).toBeNull()
    })
  }
  it('removed task or project', () => {
    expect(taskRunSettled(null, false)).toEqual({
      outcome: 'interrupted',
      reason: 'Task or project removed',
    })
  })
})

describe('durable task launch reconciliation', () => {
  it('running with dead runner persists interrupted once, preserving existing task behavior', () => {
    const { row, root } = setup('running', { withLaunch: true })
    reconcileTaskRuns({ probe: dead, schedule: noSchedule }).stop()
    const launch = required(getTaskLaunch(required(row.launch_id)))
    expect(taskLaunchSettled(launch)).toEqual({
      outcome: 'interrupted',
      reason: INTERRUPTED_REASON,
    })
    expect(loadTasks(root).tasks[0]?.status).toBe('failed')
    expect(watching(root)).toHaveLength(0)
    settleExitedTaskRun(row)
    expect(getTaskLaunch(required(row.launch_id))).toEqual(launch)
  })

  it('keeps the same launch unsettled through internal QA retries while the runner lives', () => {
    const { root, row, sessionId, taskId } = setup('failed', { withLaunch: true })
    reconcileTaskRuns({ probe: alive, schedule: noSchedule }).stop()
    expect(taskLaunchSettled(required(getTaskLaunch(required(row.launch_id))))).toBeNull()
    expect(watching(root)).toHaveLength(1)
    expect(reports(required(sessionId), taskId)).toHaveLength(0)
    writeFileSync(
      join(root, 'tasks.yaml'),
      `version: 1
project: test
tasks:
  - id: ${taskId}
    description: Retry
    output: [out.txt]
    status: done
`,
    )
    settleExitedTaskRun(row)
    expect(taskLaunchSettled(required(getTaskLaunch(required(row.launch_id))))).toEqual({
      outcome: 'completed',
      reason: null,
    })
  })

  it('settles removed tasks and projects without reporting', () => {
    const removedProject = setup('running', { withLaunch: true, registerProject: false })
    const removedTask = setup('running', { withLaunch: true })
    writeFileSync(join(removedTask.root, 'tasks.yaml'), 'version: 1\nproject: test\ntasks: []\n')
    reconcileTaskRuns({ probe: dead, schedule: noSchedule }).stop()
    for (const { row, root, sessionId, taskId } of [removedProject, removedTask]) {
      expect(taskLaunchSettled(required(getTaskLaunch(required(row.launch_id))))).toEqual({
        outcome: 'interrupted',
        reason: 'Task or project removed',
      })
      expect(watching(root)).toHaveLength(0)
      expect(reports(required(sessionId), taskId)).toHaveLength(0)
    }
  })
})

function required<T>(value: T | null | undefined): T {
  if (value == null) throw new Error('Missing fixture value')
  return value
}
