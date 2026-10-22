import { describe, expect, test } from 'bun:test'
import type { ChatThread } from '../types/orchestos'
import { activeAfterLoad, mergeLoadedThreads, threadPendingForSend } from './merge-threads'

function thread(id: string, messageIds: string[] = []): ChatThread {
  return {
    id,
    title: id,
    agent: 'codex',
    mode: 'orchestrator',
    status: 'active',
    createdAt: '',
    updatedAt: '',
    tokenCount: 0,
    costUsd: 0,
    messages: messageIds.map((mid) => ({ id: mid, role: 'user', content: '', timestamp: '' })),
  }
}

describe('mergeLoadedThreads', () => {
  test('una lectura vacía y tardía no borra el hilo creado mientras tanto', () => {
    const created = thread('new')
    const merged = mergeLoadedThreads([created], [], null)
    expect(merged.map((t) => t.id)).toEqual(['new'])
    expect(activeAfterLoad('new', merged, [])).toBe('new')
  })

  test('el hilo local con mensaje pendiente gana sobre el cargado', () => {
    const local = thread('a', ['pending_1'])
    const merged = mergeLoadedThreads([local], [thread('a')], null)
    expect(merged[0]).toBe(local)
  })

  test('un hilo local de otro proyecto no pasa a la lista del proyecto leído', () => {
    const fromA = { ...thread('a-chat'), projectId: 'A' }
    const createdInB = { ...thread('b-new'), projectId: 'B' }
    const merged = mergeLoadedThreads([fromA, createdInB], [thread('b-old')], 'B')
    expect(merged.map((t) => t.id)).toEqual(['b-new', 'b-old'])
  })

  test('sin hilo activo propio, toma el primero de la lectura', () => {
    const loaded = [thread('x'), thread('y')]
    expect(activeAfterLoad('', mergeLoadedThreads([], loaded, null), loaded)).toBe('x')
  })
})

describe('threadPendingForSend', () => {
  test('sin hilo activo espera el New chat en vuelo', async () => {
    const created = thread('codex-chat')
    expect(await threadPendingForSend('', Promise.resolve(created))).toBe(created)
  })

  test('con hilo activo o sin creación en vuelo no espera nada', async () => {
    expect(await threadPendingForSend('a', Promise.resolve(thread('b')))).toBeNull()
    expect(await threadPendingForSend('', null)).toBeNull()
  })
})
