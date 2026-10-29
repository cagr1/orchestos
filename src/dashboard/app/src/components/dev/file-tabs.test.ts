import { describe, expect, test } from 'bun:test'
import {
  closeFileTab,
  emptyFileTabs,
  openFileTab,
  persistedFileTabs,
  restoreFileTabs,
} from './file-tabs'

describe('Dev file tabs', () => {
  test('single click replaces preview in place and keeps pinned files', () => {
    const pinned = openFileTab(emptyFileTabs(), 'fixed.ts', true)
    const first = openFileTab(pinned, 'README.md')
    const replaced = openFileTab(first, 'context.json')
    expect(replaced).toEqual({
      tabs: [
        { path: 'fixed.ts', pinned: true },
        { path: 'context.json', pinned: false },
      ],
      activePath: 'context.json',
    })
    expect(first.tabs[1]?.path).toBe('README.md')
  })
  test('pinning preview fixes it; later opens do not duplicate or unpin', () => {
    const preview = openFileTab(emptyFileTabs(), 'a.ts')
    const fixed = openFileTab(preview, 'a.ts', true)
    expect(openFileTab(fixed, 'a.ts')).toEqual(fixed)
    expect(openFileTab(fixed, 'b.ts').tabs).toHaveLength(2)
    expect(fixed.tabs[0]?.pinned).toBe(true)
  })
  test('close selects right then left neighbour; last close empties panel', () => {
    const state = openFileTab(openFileTab(emptyFileTabs(), 'a', true), 'b', true)
    expect(closeFileTab({ ...state, activePath: 'a' }, 'a').activePath).toBe('b')
    expect(closeFileTab(state, 'b').activePath).toBe('a')
    expect(closeFileTab(closeFileTab(state, 'a'), 'b')).toEqual(emptyFileTabs())
    expect(closeFileTab(state, 'a').activePath).toBe('b')
  })
  test('persistence saves only pinned tabs and restores a pinned active path', () => {
    const state = openFileTab(openFileTab(emptyFileTabs(), 'fixed', true), 'preview')
    expect(persistedFileTabs(state)).toEqual({
      tabs: [{ path: 'fixed', pinned: true }],
      activePath: 'fixed',
    })
    expect(restoreFileTabs(state)).toEqual(persistedFileTabs(state))
  })
  test('restore drops dead paths, duplicates and malformed data', () => {
    const value = {
      tabs: [
        { path: 'dead', pinned: true },
        { path: 'live', pinned: true },
        { path: 'live', pinned: true },
        null,
      ],
      activePath: 'dead',
    }
    expect(restoreFileTabs(value, ['live'])).toEqual({
      tabs: [{ path: 'live', pinned: true }],
      activePath: 'live',
    })
    for (const invalid of [null, [], 'bad', { tabs: 'bad' }])
      expect(restoreFileTabs(invalid)).toEqual(emptyFileTabs())
  })
})
