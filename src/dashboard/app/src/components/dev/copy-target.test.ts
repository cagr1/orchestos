import { describe, expect, test } from 'bun:test'
import { assistantCopyTarget } from './copy-target'

describe('assistantCopyTarget', () => {
  test('chooses the assistant response belonging to each exchange', () => {
    const first = { id: 'exchange-1', assistantMessage: { id: 12, content: 'First answer' } }
    const second = { id: 'exchange-2', assistantMessage: { id: '13', content: 'Second answer' } }

    expect(assistantCopyTarget(first, 'Visible first answer')).toEqual({
      id: '12',
      text: 'First answer',
    })
    expect(assistantCopyTarget(second, 'Visible second answer')).toEqual({
      id: '13',
      text: 'Second answer',
    })
  })

  test('uses the live exchange id when its answer is still streaming', () => {
    expect(assistantCopyTarget({ id: 'exchange-3' }, 'Live answer')).toEqual({
      id: 'live-exchange-3',
      text: 'Live answer',
    })
  })

  test('returns null when there is no assistant answer to copy', () => {
    expect(assistantCopyTarget({ id: 'exchange-4' }, '')).toBeNull()
  })
})
