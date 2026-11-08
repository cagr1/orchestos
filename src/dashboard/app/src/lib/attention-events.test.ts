import { expect, test } from 'bun:test'
import { type AttentionSnapshot, detectAttentionEvents } from './attention-events'
import { DEFAULT_NOTIFICATION_SETTINGS } from './notification-settings'

function snapshot(working = false): AttentionSnapshot {
  return {
    settings: { ...DEFAULT_NOTIFICATION_SETTINGS },
    threads: [{ id: 'thread', title: 'My agent', working, mark: 'turn1', approvals: [] }],
    tasks: [],
  }
}

test('initial load, unknown entities and unchanged states never notify', () => {
  const next = snapshot()
  next.threads[0]!.approvals = ['approval1']
  next.tasks = [{ id: 'task', threadId: 'thread', status: 'done', mark: 'run1' }]
  expect(detectAttentionEvents(null, next)).toEqual([])
  expect(detectAttentionEvents({ ...next, threads: [], tasks: [] }, next)).toEqual([])
  expect(detectAttentionEvents(next, next)).toEqual([])
})

test('one working to idle transition, including failure', () => {
  const before = snapshot(true)
  const after = snapshot()
  const events = detectAttentionEvents(before, after)
  expect(events).toHaveLength(1)
  expect(events[0]).toMatchObject({ title: 'My agent', threadId: 'thread', body: 'Finished' })
  expect(detectAttentionEvents(after, after)).toEqual([])
  after.threads[0]!.failed = true
  expect(detectAttentionEvents(before, after)[0]!.body).toBe('Failed')
})

test('approvals emit once and a new approval on the same run emits again', () => {
  const before = snapshot(true)
  const next = snapshot(true)
  next.threads[0]!.approvals = ['run1:a1']
  expect(detectAttentionEvents(before, next)[0]!.body).toBe('Needs your approval')
  expect(detectAttentionEvents(next, next)).toEqual([])
  const another = snapshot(true)
  another.threads[0]!.approvals = ['run1:a2']
  expect(detectAttentionEvents(next, another)).toHaveLength(1)
  before.threads[0]!.approvals = ['run1:pending']
  expect(detectAttentionEvents(before, next)).toEqual([])
  expect(detectAttentionEvents(next, before)).toEqual([])
})

test('task terminal states emit once and retain failures', () => {
  const before = snapshot()
  before.tasks = [{ id: 'task', threadId: 'thread', status: 'running', mark: 'run1' }]
  for (const status of ['done', 'failed']) {
    const after = { ...before, tasks: [{ ...before.tasks[0]!, status }] }
    const events = detectAttentionEvents(before, after)
    expect(events).toHaveLength(1)
    expect(events[0]!.body).toBe(status === 'failed' ? 'Failed' : 'Finished')
    expect(detectAttentionEvents(after, after)).toEqual([])
  }
})

test('disabled types suppress their events even when settings change', () => {
  const before = snapshot(true)
  const next = snapshot()
  next.threads[0]!.approvals = ['approval']
  next.settings = { ...DEFAULT_NOTIFICATION_SETTINGS, turnFinished: false, needsInput: false }
  expect(detectAttentionEvents(before, next)).toEqual([])
  const enabled = { ...next, settings: DEFAULT_NOTIFICATION_SETTINGS }
  expect(detectAttentionEvents(next, enabled)).toEqual([])
})
