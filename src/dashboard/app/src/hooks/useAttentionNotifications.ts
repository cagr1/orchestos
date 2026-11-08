import { useEffect, useRef } from 'react'
import { getTimeline, listSessions } from '../api/chat'
import type { PendingApproval } from '../api/runs'
import { deliverAttention } from '../lib/attention-delivery'
import { type AttentionSnapshot, detectAttentionEvents } from '../lib/attention-events'
import { useNotificationSettings } from '../lib/notification-settings'
import type { ChatThread, TaskItem } from '../types/orchestos'

type TaskSource = { projectId: string | null | undefined; tasks: TaskItem[] }
type Input = {
  ready: boolean
  threads: ChatThread[]
  runningIds: Set<string>
  failedIds: Set<string>
  projectId: string | null
  taskSources: TaskSource[]
  approvals: {
    projectId: string | null | undefined
    byRun: Record<string, PendingApproval[]>
  } | null
  onSessions: (threads: ChatThread[]) => void
  onOpen: (thread: ChatThread) => void
}

/** Mounted once: navigation and settings changes share one transition history. */
export function useAttentionNotifications(input: Input) {
  const settings = useNotificationSettings()
  const latest = useRef(input)
  latest.current = input
  const previous = useRef<AttentionSnapshot | null>(null)
  const delivered = useRef(new Set<string>())
  const marks = useRef(new Map<string, string>())
  const sequence = useRef(0)
  const previousProject = useRef(input.projectId)
  const tasks = input.taskSources.flatMap((source) => source.tasks)
  const waiting = tasks.some(
    (task) => task.status === 'running' || (task.pendingApprovals ?? 0) > 0,
  )
  const shouldPoll =
    input.runningIds.size > 0 ||
    waiting ||
    input.threads.some((thread) => thread.status === 'waiting_approval')

  useEffect(() => {
    if (!shouldPoll) return
    let disposed = false
    let polling = false
    const poll = async () => {
      if (polling) return
      polling = true
      try {
        const sessions = await listSessions(latest.current.projectId)
        if (!disposed) latest.current.onSessions(sessions)
      } catch {
        // A failed read is not a completion transition.
      } finally {
        polling = false
      }
    }
    const timer = window.setInterval(() => void poll(), 5_000)
    return () => {
      disposed = true
      window.clearInterval(timer)
    }
  }, [shouldPoll, input.projectId])

  useEffect(() => {
    if (previousProject.current !== input.projectId) {
      previousProject.current = input.projectId
      previous.current = null
    }
    if (!input.ready) return
    const snapshot: AttentionSnapshot = {
      settings,
      threads: input.threads.map((thread) => {
        const working = input.runningIds.has(thread.id)
        const before = previous.current?.threads.find((item) => item.id === thread.id)
        if (working && !before?.working) marks.current.set(thread.id, String(++sequence.current))
        const threadTasks = input.taskSources
          .filter((source) => source.projectId === thread.projectId)
          .flatMap((source) => source.tasks)
          .filter((task) => task.sessionId === thread.id)
        const pending = threadTasks.filter((task) => (task.pendingApprovals ?? 0) > 0)
        const approvals = pending.flatMap((task) => {
          const requests =
            input.approvals?.projectId === thread.projectId && task.runId
              ? input.approvals.byRun[task.runId]
              : undefined
          return requests?.length
            ? requests.map((request) => `${task.runId}:${request.approvalId}`)
            : [`${task.runId ?? task.id}:pending`]
        })
        if (thread.status === 'waiting_approval' && !pending.length) approvals.push('waiting')
        return {
          id: thread.id,
          title: thread.title,
          working,
          failed: input.failedIds.has(thread.id),
          mark: marks.current.get(thread.id) ?? thread.updatedAt,
          approvals,
        }
      }),
      tasks: input.taskSources.flatMap((source) =>
        source.tasks.flatMap((task) => {
          const thread = input.threads.find(
            (thread) => thread.id === task.sessionId && thread.projectId === source.projectId,
          )
          return thread
            ? [
                {
                  id: task.id,
                  threadId: thread.id,
                  status: task.status,
                  mark: `${task.runId ?? ''}:${task.retryCount}`,
                },
              ]
            : []
        }),
      ),
    }
    const events = detectAttentionEvents(previous.current, snapshot)
    previous.current = snapshot
    for (const event of events) {
      if (delivered.current.has(event.key)) continue
      delivered.current.add(event.key)
      if (!document.hidden && document.hasFocus()) continue
      const thread = input.threads.find((item) => item.id === event.threadId)
      if (!thread) continue
      const send = async () => {
        if (event.type === 'turnFinished' && !event.key.includes(':task:')) {
          const timeline = await getTimeline(thread.id, thread.projectId).catch(() => null)
          const lastTurn = timeline?.turns.at(-1)
          if (lastTurn?.error || lastTurn?.status === 'failed') event.body = 'Failed'
        }
        if (!document.hidden && document.hasFocus()) return
        deliverAttention(event, settings.sound, () => latest.current.onOpen(thread))
      }
      void send()
    }
  }, [input, settings])
}
