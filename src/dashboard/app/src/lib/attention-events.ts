import type { NotificationSettings } from './notification-settings'

export type AttentionThread = {
  id: string
  title: string
  working: boolean
  mark: string
  failed?: boolean
  approvals: string[]
}
export type AttentionTask = {
  id: string
  threadId: string
  status: string
  mark: string
}
export type AttentionSnapshot = {
  threads: AttentionThread[]
  tasks: AttentionTask[]
  settings: NotificationSettings
}
export type AttentionEvent = {
  key: string
  threadId: string
  title: string
  type: 'turnFinished' | 'needsInput'
  body: 'Finished' | 'Failed' | 'Needs your approval'
}

/** Unknown entities establish a baseline; only observed transitions emit events. */
export function detectAttentionEvents(
  prev: AttentionSnapshot | null,
  next: AttentionSnapshot,
): AttentionEvent[] {
  if (!prev) return []
  const events: AttentionEvent[] = []
  for (const thread of next.threads) {
    const before = prev.threads.find((item) => item.id === thread.id)
    if (!before) continue
    const approval = thread.approvals.find((id) => {
      const run = id.split(':')[0]
      return (
        !before.approvals.includes(id) &&
        !before.approvals.includes(`${run}:pending`) &&
        !(id.endsWith(':pending') && before.approvals.some((old) => old.startsWith(`${run}:`)))
      )
    })
    if (approval && next.settings.needsInput) {
      events.push({
        key: `${thread.id}:needsInput:${approval}`,
        threadId: thread.id,
        title: thread.title,
        type: 'needsInput',
        body: 'Needs your approval',
      })
    }
    if (before.working && !thread.working && next.settings.turnFinished) {
      events.push({
        key: `${thread.id}:turnFinished:${before.mark}`,
        threadId: thread.id,
        title: thread.title,
        type: 'turnFinished',
        body: thread.failed ? 'Failed' : 'Finished',
      })
    }
  }
  for (const task of next.tasks) {
    const before = prev.tasks.find((item) => item.id === task.id && item.threadId === task.threadId)
    const thread = next.threads.find((item) => item.id === task.threadId)
    if (
      !before ||
      !thread ||
      before.status === task.status ||
      !['done', 'failed'].includes(task.status) ||
      !next.settings.turnFinished
    )
      continue
    events.push({
      key: `${task.threadId}:turnFinished:task:${task.id}:${task.mark}:${task.status}`,
      threadId: task.threadId,
      title: thread.title,
      type: 'turnFinished',
      body: task.status === 'failed' ? 'Failed' : 'Finished',
    })
  }
  return events
}
