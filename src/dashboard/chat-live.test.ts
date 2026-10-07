import { describe, expect, it } from 'bun:test'
import { appendLiveText, clearLiveText, getLiveText, replaceLiveText } from './chat-live.ts'

describe('chat live text buffer', () => {
  it('appendLiveText accumulates deltas', () => {
    appendLiveText('append', 'turn-1', 'hello')
    appendLiveText('append', 'turn-1', ' world')
    expect(getLiveText('append')).toEqual({ turnId: 'turn-1', text: 'hello world' })
  })

  it('replaceLiveText does not duplicate text already received as deltas', () => {
    appendLiveText('replace', 'turn-1', 'hello')
    replaceLiveText('replace', 'turn-1', 'hello world')
    expect(getLiveText('replace')?.text).toBe('hello world')
  })

  it('replaceLiveText joins complete messages when there were no deltas', () => {
    replaceLiveText('messages', 'turn-1', 'first')
    replaceLiveText('messages', 'turn-1', 'second')
    expect(getLiveText('messages')?.text).toBe('first\n\nsecond')
  })

  it('hides complete and incomplete task markers', () => {
    replaceLiveText('markers', 'turn-1', `visible\n[[orchestos:task]]`)
    expect(getLiveText('markers')?.text).toBe('visible')
    appendLiveText('markers', 'turn-1', '\n[[orch')
    expect(getLiveText('markers')?.text).toBe('visible')
  })

  it('hides a partial task marker with one closing bracket at the end', () => {
    appendLiveText('partial-task-marker', 'turn-1', 'Hecho. [[orchestos:task]')
    expect(getLiveText('partial-task-marker')?.text).toBe('Hecho.')
  })

  it('hides a complete task marker at the end of a line', () => {
    appendLiveText('complete-task-marker', 'turn-1', 'Hecho. [[orchestos:task]]')
    expect(getLiveText('complete-task-marker')?.text).toBe('Hecho.')
  })

  it('clearLiveText removes only the matching active turn', () => {
    replaceLiveText('clear', 'turn-1', 'old')
    clearLiveText('clear', 'wrong-turn')
    expect(getLiveText('clear')?.text).toBe('old')
    clearLiveText('clear', 'turn-1')
    expect(getLiveText('clear')).toBeNull()
  })

  it('a new turn replaces the previous turn in the session', () => {
    appendLiveText('new-turn', 'turn-1', 'old')
    appendLiveText('new-turn', 'turn-2', 'new')
    expect(getLiveText('new-turn')).toEqual({ turnId: 'turn-2', text: 'new' })
  })
})
