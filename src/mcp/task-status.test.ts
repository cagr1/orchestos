import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getTaskStatus, listTasks, type RunsReader, runsReaderFor } from './task-status.ts'

const roots: string[] = []
const root = () => {
  const path = mkdtempSync(join(tmpdir(), 'task-status-'))
  roots.push(path)
  return path
}
afterEach(() => {
  for (const path of roots.splice(0)) rmSync(path, { recursive: true, force: true })
})
const tasksYaml = (tasks: string) => `version: 1\nproject: demo\ntasks:\n${tasks}`
const task = (id: string, status = 'pending') =>
  `  - id: ${id}\n    description: Example task\n    output: [out.txt]\n    status: ${status}\n    retry_count: 1\n`
const run = {
  id: 'run-1',
  status: 'failed',
  created_at: '2026-01-01',
  model: 'model-x',
  qa_verdict: 'fail',
  qa_reason: 'QA found issue',
  failure_kind: 'qa',
  result: 'Command failed',
} as const

describe('task status tools', () => {
  test('does not expose runs when the project root is unregistered', () => {
    const list = (taskId: string, projectId: string) => {
      expect(taskId).toBe('one')
      expect(projectId).toBe('project-1')
      return [run]
    }
    expect(runsReaderFor(null, list)('/unregistered', 'one')).toEqual([])
    expect(runsReaderFor('project-1', list)('/registered', 'one')).toEqual([run])
  })

  test('reports missing file, lists task and latest run, filters and rejects invalid args', () => {
    const dir = root()
    expect(listTasks({}, dir).text).toContain('no task was ever created')
    writeFileSync(join(dir, 'tasks.yaml'), tasksYaml(task('one', 'pending') + task('two', 'done')))
    const reader: RunsReader = (_root, id) => (id === 'one' ? [run] : [])
    expect(listTasks({}, dir, reader).text).toContain('2 task(s):')
    expect(listTasks({}, dir, reader).text).toContain('last run run-1 failed')
    expect(listTasks({ status: 'done' }, dir, reader).text).toContain('- two [done]')
    expect(listTasks({ extra: true }, dir).isError).toBe(true)
  })

  test('gets missing, pending and failed task detail and handles unavailable history', () => {
    const dir = root()
    writeFileSync(join(dir, 'tasks.yaml'), tasksYaml(task('waiting') + task('broken', 'failed')))
    expect(getTaskStatus({ task_id: 'nope' }, dir).text).toContain('it was not created')
    expect(getTaskStatus({ task_id: 'waiting' }, dir, () => []).text).toContain('Runs: none yet')
    const detail = getTaskStatus({ task_id: 'broken' }, dir, () => [run])
    expect(detail.text).toContain('QA reason: QA found issue')
    expect(detail.text).toContain('Result: Command failed')
    expect(
      getTaskStatus({ task_id: 'broken' }, dir, () => {
        throw new Error('db closed')
      }).text,
    ).toContain('run history unavailable: db closed')
    expect(getTaskStatus({ task_id: '' }, dir).isError).toBe(true)
  })
})
