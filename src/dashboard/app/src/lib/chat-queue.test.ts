import { expect, test } from 'bun:test'
import { queueDevSessionMessage, readChatQueue, discardChatQueue } from './chat-queue'
import { mapSessionToAgent } from '../api/projects'

test('Dev continuation queues the source model and effort instead of configured defaults', () => {
  const source = mapSessionToAgent(
    {
      id: 'source',
      projectId: 'project',
      title: 'Old',
      agent: 'codex',
      mode: 'code',
      lastModel: 'gpt',
      lastEffort: 'high',
      createdAt: '',
      updatedAt: '',
    },
    undefined,
    { agent: 'codex', model: 'default', effort: 'medium' },
  )
  queueDevSessionMessage('new', 'Continue.', source.agent!, source.model, source.effort)
  try {
    expect(readChatQueue('new')).toHaveLength(1)
    expect(readChatQueue('new')[0]).toMatchObject({
      content: 'Continue.',
      cli: 'codex',
      model: 'gpt',
      effort: 'high',
    })
    expect(readChatQueue('source')).toEqual([])
  } finally {
    discardChatQueue('new')
  }
})
