import { describe, expect, test } from 'bun:test'
import { openFileTab } from './file-tabs'
import { emptySessionTabs, openSessionTab } from './session-tabs'

describe('Files in unified Dev tabs', () => {
  test('opening a file replaces only preview, preserving session and pinned file', () => {
    const state = openFileTab(
      openFileTab(openSessionTab(emptySessionTabs(), 'a'), 'fixed', true),
      'preview',
    )
    expect(openFileTab(state, 'next').tabs.map((tab) => tab.id)).toEqual([
      'a',
      'file:fixed',
      'file:next',
    ])
    expect(state.tabs[2]?.id).toBe('file:preview')
  })
  test('double click pins; later clicks neither duplicate nor unpin', () => {
    const fixed = openFileTab(openFileTab(emptySessionTabs(), 'a.ts'), 'a.ts', true)
    expect(openFileTab(fixed, 'a.ts')).toEqual(fixed)
    expect(fixed.tabs[0]).toEqual({ type: 'file', id: 'file:a.ts', path: 'a.ts', pinned: true })
    expect(openFileTab(fixed, 'next').tabs).toHaveLength(2)
  })
})
