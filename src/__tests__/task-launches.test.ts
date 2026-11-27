import { afterAll, describe, expect, it } from 'bun:test'
import { randomUUID } from 'node:crypto'
import { db } from '../db/sqlite.ts'
import {
  getTaskLaunch,
  insertTaskLaunch,
  latestTaskLaunch,
  settleTaskLaunch,
  taskLaunchSettled,
} from '../db/task-launches.ts'

const root = `/task-launch-test/${randomUUID()}`
afterAll(() => {
  db.run('DELETE FROM task_launches WHERE root = ?', [root])
})

function launch(taskId: string, startedAt: string) {
  const id = randomUUID()
  insertTaskLaunch({
    id,
    root,
    task_id: taskId,
    project_id: null,
    session_id: null,
    pid: 123,
    started_at: startedAt,
  })
  return id
}

describe('task launches', () => {
  it('persists an unsettled launch and settles it only once', () => {
    const id = launch('once', '2026-11-27T00:00:00.000Z')
    expect(taskLaunchSettled(required(getTaskLaunch(id)))).toBeNull()
    expect(settleTaskLaunch(id, 'blocked', 'Context budget exhausted')).toBe(true)
    const settled = required(getTaskLaunch(id))
    expect(taskLaunchSettled(settled)).toEqual({
      outcome: 'blocked',
      reason: 'Context budget exhausted',
    })
    expect(settled.settled_at).toEqual(expect.any(String))
    expect(settleTaskLaunch(id, 'completed', null)).toBe(false)
    expect(getTaskLaunch(id)).toEqual(settled)
    expect(settleTaskLaunch('missing', 'completed', null)).toBe(false)
    expect(getTaskLaunch('missing')).toBeNull()
  })

  it('selects the latest launch within the root and task, including equal timestamps', () => {
    launch('latest', '2026-11-26T00:00:00.000Z')
    launch('other', '2026-11-29T00:00:00.000Z')
    launch('latest', '2026-11-27T00:00:00.000Z')
    const id = launch('latest', '2026-11-27T00:00:00.000Z')
    expect(latestTaskLaunch(root, 'latest')?.id).toBe(id)
    expect(latestTaskLaunch('/other-root', 'latest')).toBeNull()
    expect(latestTaskLaunch(root, 'missing')).toBeNull()
  })
})

function required<T>(value: T | null | undefined): T {
  if (value == null) throw new Error('Missing fixture value')
  return value
}
