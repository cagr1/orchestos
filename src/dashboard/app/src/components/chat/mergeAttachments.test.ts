import { describe, expect, test } from 'bun:test'
import type { ChatMessage } from '../../types/orchestos'
import { mergeOptimisticAttachments } from './mergeAttachments'

const attachment = { id: 'att_1', name: 'a.txt', size: '1 KB', type: 'file' as const }
const msg = (id: string, role: 'user' | 'assistant', content: string): ChatMessage =>
  ({ id, role, content, timestamp: '' }) as ChatMessage

describe('mergeOptimisticAttachments', () => {
  test('copies the attachments to the last server user message with the same content', () => {
    const server = [msg('1', 'user', 'hi'), msg('2', 'assistant', 'ok'), msg('3', 'user', 'hi')]
    const merged = mergeOptimisticAttachments(server, { content: 'hi', attachments: [attachment] })
    expect(merged[0].attachments).toBeUndefined()
    expect(merged[2].attachments).toEqual([attachment])
  })

  test('leaves messages alone with no attachments or no matching message', () => {
    const server = [msg('1', 'user', 'hi')]
    expect(mergeOptimisticAttachments(server, { content: 'hi' })).toBe(server)
    expect(mergeOptimisticAttachments(server, { content: 'x', attachments: [attachment] })).toBe(
      server,
    )
  })

  test('two sends of the same text each land on their own message, newest first', () => {
    const older = { ...attachment, id: 'att_old' }
    const newer = { ...attachment, id: 'att_new' }
    const server = [msg('1', 'user', 'hi'), msg('2', 'assistant', 'ok'), msg('3', 'user', 'hi')]
    const entries = [
      { content: 'hi', attachments: [older] },
      { content: 'hi', attachments: [newer] },
    ]
    const merged = [...entries]
      .reverse()
      .reduce((acc, entry) => mergeOptimisticAttachments(acc, entry), server)
    expect(merged[0].attachments).toEqual([older])
    expect(merged[2].attachments).toEqual([newer])
  })
})
