import { describe, expect, test } from 'bun:test'
import { getShellState, setShellState } from './shell-store.ts'

describe('setShellState', () => {
  test('does not erase an array when another changed key carries undefined', () => {
    setShellState({ generalSessions: [] })
    setShellState({ screen: 'project', generalSessions: undefined })

    expect(getShellState().screen).toBe('project')
    expect(getShellState().generalSessions).toEqual([])
  })
})
