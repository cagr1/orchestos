import { afterEach, describe, expect, it, spyOn } from 'bun:test'
import { getMemory } from '../db/memory.ts'
import { db } from '../db/sqlite.ts'
import { recordTaskMemory } from '../db/task-memory.ts'

const PROJECT_ID = 'task-memory-test-project'

afterEach(() => {
  db.run('DELETE FROM memory_entries WHERE project_id = ?', [PROJECT_ID])
})

describe('recordTaskMemory', () => {
  it('records a completed task with its files, QA and attempts', () => {
    recordTaskMemory({
      projectId: PROJECT_ID,
      taskId: 'inventory-list',
      description: '\nList inventory products\nwith current stock',
      outcome: 'done',
      files: ['src/products.ts', 'src/products.test.ts'],
      qaVerdict: 'pass',
      qaReason: 'All acceptance criteria passed',
      attempts: 1,
    })

    expect(getMemory(PROJECT_ID, 'task/inventory-list')?.content).toBe(
      'Task inventory-list — done\n' +
        'List inventory products\n' +
        'Files: src/products.ts, src/products.test.ts\n' +
        'QA: pass — All acceptance criteria passed\n' +
        'Attempts 1',
    )
  })

  it('updates the same entry when the task is recorded again', () => {
    recordTaskMemory({
      projectId: PROJECT_ID,
      taskId: 'same-task',
      description: 'First result',
      outcome: 'done',
      files: ['first.ts'],
      qaVerdict: 'pass',
      attempts: 1,
    })
    const first = getMemory(PROJECT_ID, 'task/same-task')

    recordTaskMemory({
      projectId: PROJECT_ID,
      taskId: 'same-task',
      description: 'Updated result',
      outcome: 'done',
      files: ['second.ts'],
      qaVerdict: 'pass',
      attempts: 2,
    })

    const second = getMemory(PROJECT_ID, 'task/same-task')
    expect(second?.id).toBe(first?.id)
    expect(second?.content).toContain('Updated result')
    expect(
      db
        .query<{ count: number }, [string, string]>(
          'SELECT COUNT(*) AS count FROM memory_entries WHERE project_id = ? AND topic_key = ?',
        )
        .get(PROJECT_ID, 'task/same-task')?.count,
    ).toBe(1)
  })

  it('records a permanent failure as QA fail', () => {
    recordTaskMemory({
      projectId: PROJECT_ID,
      taskId: 'failed-task',
      description: 'Reject invalid stock',
      outcome: 'failed_permanent',
      files: [],
      qaVerdict: 'fail',
      qaReason: 'Stock became negative',
      attempts: 3,
    })

    expect(getMemory(PROJECT_ID, 'task/failed-task')?.content).toContain(
      'QA: fail — Stock became negative',
    )
  })

  it('does not write without a project id', () => {
    recordTaskMemory({
      projectId: null,
      taskId: 'no-project',
      description: 'No project',
      outcome: 'done',
      files: [],
      qaVerdict: 'pass',
      attempts: 1,
    })

    expect(getMemory(PROJECT_ID, 'task/no-project')).toBeNull()
  })

  it('does not propagate database errors', () => {
    const runSpy = spyOn(db, 'run').mockImplementation(() => {
      throw new Error('database unavailable')
    })
    const errorSpy = spyOn(console, 'error').mockImplementation(() => {})
    try {
      expect(() =>
        recordTaskMemory({
          projectId: PROJECT_ID,
          taskId: 'db-error',
          description: 'Database error',
          outcome: 'done',
          files: [],
          qaVerdict: null,
          attempts: 1,
        }),
      ).not.toThrow()
      expect(errorSpy).toHaveBeenCalledTimes(1)
    } finally {
      runSpy.mockRestore()
      errorSpy.mockRestore()
    }
  })
})
