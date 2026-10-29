import { describe, expect, test } from 'bun:test'
import { openFileTab } from './file-tabs'
import {
  closeSessionTab,
  convertNewTab,
  emptySessionTabs,
  openNewTab,
  openSessionTab,
  persistedDevTabs,
  restoreSessionTabs,
} from './session-tabs'

describe('Unified Dev tabs', () => {
  test('sessions and files share ordered tabs; activating a session does not duplicate', () => {
    let state = openSessionTab(emptySessionTabs(), 'a')
    state = openFileTab(state, 'README.md', true)
    state = openSessionTab(state, 'b')
    expect(openSessionTab(state, 'a')).toEqual({ ...state, activeId: 'a' })
    expect(state.tabs.map((tab) => tab.type)).toEqual(['session', 'file', 'session'])
  })
  test('plus appends independent drafts; first send converts same position', () => {
    let state = openNewTab(openSessionTab(emptySessionTabs(), 'a'), 'draft')
    state = openFileTab(state, 'a.ts', true)
    const converted = convertNewTab(state, 'draft', 'b')
    expect(converted.tabs.map((tab) => tab.id)).toEqual(['a', 'b', 'file:a.ts'])
    expect(converted.activeId).toBe('file:a.ts')
    expect(convertNewTab({ ...state, activeId: 'draft' }, 'draft', 'b').activeId).toBe('b')
    expect(openNewTab(openNewTab(emptySessionTabs())).tabs).toHaveLength(2)
  })
  test('closing selects right then left neighbour across types', () => {
    const state = openSessionTab(
      openFileTab(openSessionTab(emptySessionTabs(), 'a'), 'a.ts', true),
      'b',
    )
    expect(closeSessionTab({ ...state, activeId: 'file:a.ts' }, 'file:a.ts').activeId).toBe('b')
    expect(closeSessionTab(state, 'b').activeId).toBe('file:a.ts')
    expect(closeSessionTab(state, 'a').activeId).toBe('b')
    expect(closeSessionTab(openSessionTab(emptySessionTabs(), 'a'), 'a')).toEqual(
      emptySessionTabs(),
    )
  })
  test('roundtrip prunes dead and duplicate sessions and files; retains draft selection', () => {
    const state = openNewTab(
      openFileTab(openSessionTab(emptySessionTabs(), 'a'), 'fixed', true),
      'draft',
    )
    const stored = JSON.parse(JSON.stringify(state))
    stored.tabs.push(
      { type: 'session', id: 'dead' },
      stored.tabs[0],
      { type: 'file', id: 'file:dead', path: 'dead', pinned: true },
      null,
    )
    expect(restoreSessionTabs(stored, ['a'], undefined, ['fixed'])).toEqual(state)
    expect(restoreSessionTabs({ ...state, activeId: 'dead' }, ['a']).activeId).toBe('a')
  })
  test('without saved tabs restores last session; otherwise first available or New session', () => {
    for (const invalid of [null, false, 'bad', { tabs: 1 }, { tabs: [null, 5] }]) {
      expect(restoreSessionTabs(invalid, ['a', 'b'], 'b').activeId).toBe('b')
      expect(restoreSessionTabs(invalid, ['a'], 'dead').activeId).toBe('a')
      expect(restoreSessionTabs(invalid, []).tabs[0]?.type).toBe('new')
    }
  })
  test('persistence omits previews and retains session and fixed-file active ids', () => {
    const fixed = openFileTab(openSessionTab(emptySessionTabs(), 'a'), 'fixed', true)
    expect(restoreSessionTabs(persistedDevTabs(fixed), ['a'])).toEqual(fixed)
    expect(persistedDevTabs(openFileTab(fixed, 'preview')).tabs).toEqual(fixed.tabs)
    expect(persistedDevTabs(openSessionTab(fixed, 'a')).activeId).toBe('a')
  })
})
