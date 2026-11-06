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

  it.each(['codex', 'claude'])(
    '%s final messages reconcile only their own deltas after a tool call',
    (cli) => {
      const session = `tool-${cli}`
      const first = 'Voy a consultar el estado y la tarea disponible antes de hacer cambios.'
      const second = 'He enviado la tarea para añadir la línea solicitada al archivo del proyecto.'
      appendLiveText(session, 'turn-1', first)
      replaceLiveText(session, 'turn-1', first)
      // Tool steps do not write to the text buffer. Codex separates message items;
      // Claude emits the next text block without a separator.
      const separator = cli === 'codex' ? '\n\n' : ''
      appendLiveText(session, 'turn-1', separator + second.slice(0, 20))
      appendLiveText(session, 'turn-1', second.slice(20))
      replaceLiveText(session, 'turn-1', second)
      expect(getLiveText(session)?.text).toBe(`${first}\n\n${second}`)
      clearLiveText(session, 'turn-1')
    },
  )

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
