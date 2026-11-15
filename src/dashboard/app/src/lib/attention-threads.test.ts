import { expect, test } from 'bun:test'
import type { ChatThread } from '../types/orchestos'
import { detectAttentionEvents } from './attention-events'
import { mergeAttentionThreads } from './attention-threads'

test('Dev approval remains observable after navigating to general Chat', () => {
  const dev = { id: 'dev', projectId: 'project', title: 'Dev' } as ChatThread
  const chat = { id: 'chat', projectId: null, title: 'Chat' } as ChatThread
  const watched = mergeAttentionThreads([dev], [chat], 'project')
  expect(watched).toEqual([dev, chat])
  const settings = { turnFinished: true, needsInput: true, sound: true }
  const threads = watched.map((thread) => ({
    id: thread.id,
    title: thread.title,
    working: false,
    mark: '1',
    approvals: [] as string[],
  }))
  const before = { settings, tasks: [], threads }
  const after = {
    ...before,
    threads: threads.map((thread) =>
      thread.id === 'dev' ? { ...thread, approvals: ['run:approval'] } : thread,
    ),
  }
  expect(detectAttentionEvents(before, after)).toMatchObject([
    { threadId: 'dev', type: 'needsInput', body: 'Needs your approval' },
  ])
  expect(mergeAttentionThreads(watched, [], 'other')).toEqual([chat])
  const completed = { ...dev, running: false, updatedAt: 'new' }
  expect(mergeAttentionThreads(watched, [completed], 'project')[0]).toBe(completed)
})
