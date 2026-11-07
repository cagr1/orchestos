import { afterEach, expect, test } from 'bun:test'
import {
  dirtyPaths,
  drop,
  getBuffer,
  getSnapshot,
  hasDirtyBuffers,
  isDirty,
  markSaved,
  replaceFromDisk,
  setDraft,
  subscribe,
} from './file-buffers'

afterEach(() => {
  for (const project of ['one', 'two']) for (const path of ['a.txt', 'b.txt']) drop(project, path)
})

test('draft survives other files and projects, with project-scoped dirty paths', () => {
  replaceFromDisk('one', 'a.txt', 'a', 1)
  setDraft('one', 'a.txt', 'edited')
  replaceFromDisk('one', 'b.txt', 'b', 2)
  replaceFromDisk('two', 'a.txt', 'other project', 3)
  expect(getBuffer('one', 'a.txt')).toEqual({ saved: 'a', draft: 'edited', mtimeMs: 1 })
  expect(isDirty('one', 'a.txt')).toBe(true)
  expect(isDirty('two', 'a.txt')).toBe(false)
  expect(dirtyPaths('one')).toEqual(new Set(['a.txt']))
  expect(dirtyPaths('two')).toEqual(new Set())
  expect(hasDirtyBuffers()).toBe(true)
  setDraft('one', 'a.txt', 'a')
  expect(isDirty('one', 'a.txt')).toBe(false)
  expect(hasDirtyBuffers()).toBe(false)
})

test('markSaved acknowledges the saved snapshot while preserving typing during a save', () => {
  replaceFromDisk('one', 'a.txt', 'a', 1)
  setDraft('one', 'a.txt', 'saved')
  markSaved('one', 'a.txt', 'saved', 2)
  expect(getBuffer('one', 'a.txt')).toEqual({ saved: 'saved', draft: 'saved', mtimeMs: 2 })
  expect(isDirty('one', 'a.txt')).toBe(false)
  setDraft('one', 'a.txt', 'new typing')
  markSaved('one', 'a.txt', 'saved', 3)
  expect(getBuffer('one', 'a.txt')?.draft).toBe('new typing')
  expect(isDirty('one', 'a.txt')).toBe(true)
})

test('reload replaces both strings and drop removes dirty state', () => {
  replaceFromDisk('one', 'a.txt', 'a', 1)
  setDraft('one', 'a.txt', 'draft')
  replaceFromDisk('one', 'a.txt', 'disk', 2)
  expect(getBuffer('one', 'a.txt')).toEqual({ saved: 'disk', draft: 'disk', mtimeMs: 2 })
  expect(isDirty('one', 'a.txt')).toBe(false)
  setDraft('one', 'a.txt', 'draft')
  drop('one', 'a.txt')
  expect(getBuffer('one', 'a.txt')).toBeUndefined()
  expect(isDirty('one', 'a.txt')).toBe(false)
  expect(dirtyPaths('one').size).toBe(0)
  markSaved('one', 'a.txt', 'late save', 3)
  expect(getBuffer('one', 'a.txt')).toBeUndefined()
})

test('subscribers receive mutations and can unsubscribe; no-op drafts do not notify', () => {
  let calls = 0
  const initial = getSnapshot()
  const unsubscribe = subscribe(() => calls++)
  replaceFromDisk('one', 'a.txt', 'a', 1)
  setDraft('one', 'a.txt', 'a')
  setDraft('one', 'b.txt', 'no buffer')
  expect(calls).toBe(1)
  expect(getSnapshot()).toBe(initial + 1)
  unsubscribe()
  setDraft('one', 'a.txt', 'draft')
  expect(calls).toBe(1)
})
