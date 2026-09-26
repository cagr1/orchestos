import { describe, expect, test } from 'bun:test'
import { selectionFromDefaults, sendComposerDraft } from './AgentComposer'

describe('AgentComposer defaults', () => {
  test('syncs a mounted API composer to its Codex orchestrator defaults', () => {
    expect(selectionFromDefaults('codex', 'gpt-6-luna', 'medium')).toEqual({
      cli: 'codex',
      model: 'gpt-6-luna',
      effort: 'medium',
    })
  })

  test('uses the locked CLI and clears a model removed from session defaults', () => {
    expect(selectionFromDefaults('api', undefined, 'high', 'codex')).toEqual({
      cli: 'codex',
      model: '',
      effort: 'high',
    })
  })

  test('keeps the draft when the send callback rejects the message', async () => {
    expect(await sendComposerDraft(async () => false)).toBe(false)
    expect(
      await sendComposerDraft(async () => {
        throw new Error('send failed')
      }),
    ).toBe(false)
    expect(await sendComposerDraft(async () => true)).toBe(true)
  })
})
