import { describe, expect, test } from 'bun:test'
import {
  closeSessionTab,
  emptySessionTabs,
  openSessionTab,
  restoreSessionTabs,
} from './session-tabs'

describe('Dev session tabs', () => {
  test('opens in order and activates an existing tab without duplicating it', () => {
    let state = openSessionTab(emptySessionTabs(), 'a')
    state = openSessionTab(state, 'b')
    expect(openSessionTab(state, 'a')).toEqual({ ids: ['a', 'b'], activeId: 'a' })
  })
  test('closing the active tab selects its right neighbour, then its left', () => {
    const state = { ids: ['a', 'b', 'c'], activeId: 'b' }
    expect(closeSessionTab(state, 'b')).toEqual({ ids: ['a', 'c'], activeId: 'c' })
    expect(closeSessionTab({ ...state, activeId: 'c' }, 'c')).toEqual({
      ids: ['a', 'b'],
      activeId: 'b',
    })
  })
  test('closing the final tab returns to New session; closing another preserves selection', () => {
    expect(closeSessionTab({ ids: ['a'], activeId: 'a' }, 'a')).toEqual(emptySessionTabs())
    expect(closeSessionTab({ ids: ['a', 'b'], activeId: 'a' }, 'b')).toEqual({
      ids: ['a'],
      activeId: 'a',
    })
    expect(closeSessionTab({ ids: ['a'], activeId: null }, 'a')).toEqual(emptySessionTabs())
  })
  test('persisted order and active tab roundtrip, discarding dead and duplicate ids', () => {
    const stored = JSON.parse(JSON.stringify({ ids: ['b', 'dead', 'a', 'b'], activeId: 'a' }))
    expect(restoreSessionTabs(stored, ['a', 'b', 'closed'])).toEqual({
      ids: ['b', 'a'],
      activeId: 'a',
    })
    expect(restoreSessionTabs({ ...stored, activeId: 'dead' }, ['a', 'b'])).toEqual({
      ids: ['b', 'a'],
      activeId: 'b',
    })
  })
  test('New session persists without losing open tabs and malformed storage is harmless', () => {
    expect(restoreSessionTabs({ ids: ['a'], activeId: null }, ['a'])).toEqual({
      ids: ['a'],
      activeId: null,
    })
    for (const invalid of [null, false, 'bad', { ids: 1 }, { ids: [null, 5, 'dead'] }])
      expect(restoreSessionTabs(invalid, ['a'])).toEqual(emptySessionTabs())
  })
})
