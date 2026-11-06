import { expect, test } from 'bun:test'
import type { TaskItem } from '../types/orchestos'
import { pollProjectAndThreadTasks } from './taskPolling'
import { decideTaskPollAction } from './tasks'

test('selected A and active thread B use B tasks for reports and approvals, keeping A separate', async () => {
  const calls: (string | null | undefined)[] = []
  const a = [{ id: 'same-id', status: 'done' }] as TaskItem[]
  const b = [
    { id: 'same-id', status: 'running', runId: 'run-b', pendingApprovals: 1, sessionId: 'chat-b' },
  ] as TaskItem[]
  const result = await pollProjectAndThreadTasks('a', 'b', async (project) => {
    calls.push(project)
    return { exists: true, tasks: project === 'b' ? b : a }
  })
  expect(calls).toEqual(['a', 'b'])
  expect(result.projectTasks).toBe(a)
  expect(result.threadTasks).toBe(b)
  expect(result.threadTasks[0]?.runId).toBe('run-b')
  expect(
    decideTaskPollAction({ task: result.threadTasks[0], localCount: 1, seenRunning: false }),
  ).toBe('running')
})

test('an empty selected project cannot resolve a running task in another thread project', async () => {
  const result = await pollProjectAndThreadTasks('a', 'b', async (project) => ({
    exists: true,
    tasks: project === 'a' ? [] : ([{ id: 'b-task', status: 'running' }] as TaskItem[]),
  }))
  expect(result.projectTasks).toEqual([])
  expect(
    decideTaskPollAction({ task: result.threadTasks[0], localCount: 1, seenRunning: false }),
  ).toBe('running')
})

test('same project shares one read; workspace thread keeps its explicit no-project scope', async () => {
  const calls: (string | null | undefined)[] = []
  const read = async (id?: string | null) => {
    calls.push(id)
    return { exists: true, tasks: [] }
  }
  const result = await pollProjectAndThreadTasks('a', 'a', read)
  expect(calls).toEqual(['a'])
  expect(result.threadTasks).toBe(result.projectTasks)
  await pollProjectAndThreadTasks('a', null, read)
  expect(calls).toEqual(['a', 'a', null])
})
