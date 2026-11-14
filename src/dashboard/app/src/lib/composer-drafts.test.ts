import { afterEach, beforeEach, expect, test } from 'bun:test'
import {
  moveComposerDraft,
  readComposerDraft,
  subscribeComposerDrafts,
  writeComposerDraft,
} from './composer-drafts'

const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage')
let values: Map<string, string>

beforeEach(() => {
  values = new Map()
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    },
  })
})

afterEach(() => {
  if (originalStorage) Object.defineProperty(globalThis, 'sessionStorage', originalStorage)
  else Reflect.deleteProperty(globalThis, 'sessionStorage')
})

test('reads and updates independent thread drafts', () => {
  expect(readComposerDraft('thread-a')).toBe('')
  writeComposerDraft('thread-a', 'first')
  writeComposerDraft('thread-b', 'second')
  writeComposerDraft('thread-a', 'edited')
  expect(readComposerDraft('thread-a')).toBe('edited')
  expect(readComposerDraft('thread-b')).toBe('second')
})

test('empty text deletes the draft from memory and sessionStorage', () => {
  writeComposerDraft('clear', 'sent message')
  expect(values.get('orchestos:composer-draft:clear')).toBe('sent message')
  writeComposerDraft('clear', '')
  expect(values.has('orchestos:composer-draft:clear')).toBe(false)
  expect(readComposerDraft('clear')).toBe('')
  values.set('orchestos:composer-draft:clear', 'storage after deletion')
  expect(readComposerDraft('clear')).toBe('storage after deletion')
})

test('hydrates a draft from sessionStorage without an in-memory entry', () => {
  values.set('orchestos:composer-draft:reload', 'survives reload')
  expect(readComposerDraft('reload')).toBe('survives reload')
  values.clear()
  expect(readComposerDraft('reload')).toBe('survives reload')
})

test('notifies subscribers on writes and supports unsubscribing', () => {
  let notifications = 0
  const unsubscribe = subscribeComposerDrafts(() => notifications++)
  writeComposerDraft('notify', 'draft')
  writeComposerDraft('notify', '')
  unsubscribe()
  writeComposerDraft('notify', 'unsubscribed')
  expect(notifications).toBe(2)
})

test('keeps working when sessionStorage access throws', () => {
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    get() {
      throw new Error('Storage unavailable')
    },
  })
  expect(readComposerDraft('blocked')).toBe('')
  writeComposerDraft('blocked', 'in memory')
  expect(readComposerDraft('blocked')).toBe('in memory')
  writeComposerDraft('blocked', '')
  expect(readComposerDraft('blocked')).toBe('')
})

test('moves a new-tab draft to the launched session and clears the new tab', () => {
  writeComposerDraft('new:project', 'typing during launch')
  moveComposerDraft('new:project', 'session')
  expect(readComposerDraft('session')).toBe('typing during launch')
  expect(readComposerDraft('new:project')).toBe('')
  writeComposerDraft('session', '')
})

test('never overwrites a session that already has its own draft', () => {
  writeComposerDraft('new:project', 'new text')
  writeComposerDraft('session', 'existing')
  moveComposerDraft('new:project', 'session')
  expect(readComposerDraft('session')).toBe('existing')
  expect(readComposerDraft('new:project')).toBe('new text')
  writeComposerDraft('session', '')
  writeComposerDraft('new:project', '')
})
