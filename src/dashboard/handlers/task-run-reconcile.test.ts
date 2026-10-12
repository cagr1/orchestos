import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { randomUUID } from 'node:crypto'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createChatSession, deleteChatSession, listChatMessages } from '../../db/chat-sessions.ts'
import { getProject, purgeProject, upsertProject } from '../../db/projects.ts'
import { db } from '../../db/sqlite.ts'
import { listTaskRunWatch, upsertTaskRunWatch } from '../../db/task-run-watch.ts'
import { loadTasks } from '../../tasks/loader.ts'
import { settleTaskRun } from './task-report.ts'
import {
  commandIsRunnerOf,
  INTERRUPTED_REASON,
  type RunnerProbe,
  reconcileTaskRuns,
  settleExitedTaskRun,
} from './task-run-reconcile.ts'

const roots: string[] = []
const sessions: string[] = []

beforeAll(async () => (await import('../../db/migrate.ts')).runMigrations())
afterAll(() => {
  for (const id of sessions) deleteChatSession(id)
  for (const root of roots) {
    const project = getProject(root)
    if (project) purgeProject(project.id)
    db.run('DELETE FROM task_run_watch WHERE root = ?', [root])
    rmSync(root, { recursive: true, force: true })
  }
})

const noSchedule = () => ({ stop() {} })
const alive: RunnerProbe = () => true
const dead: RunnerProbe = () => false

function setup(status: string, opts: { withSession?: boolean; registerProject?: boolean } = {}) {
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
  const row = upsertTaskRunWatch({
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
    settleExitedTaskRun(row)
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
    settleTaskRun(row)
    expect(reports(sessionId as string, taskId)).toHaveLength(1)
    settleTaskRun(row)
    expect(reports(sessionId as string, taskId)).toHaveLength(1)
    expect(watching(root)).toHaveLength(0)
  })

  it('revierte el reclamo si falla el reporte y permite reintentar', () => {
    const { root, taskId, sessionId, row } = setup('done')
    const originalError = console.error
    console.error = () => {}
    try {
      settleTaskRun(row, () => {
        throw new Error('injected append failure')
      })
    } finally {
      console.error = originalError
    }
    expect(reports(sessionId as string, taskId)).toHaveLength(0)
    expect(watching(root)).toHaveLength(1)
    settleTaskRun(row)
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
