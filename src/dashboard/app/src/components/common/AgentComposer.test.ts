import { describe, expect, test } from 'bun:test'
import {
  persistApprovalMode,
  readApprovalMode,
  selectionFromDefaults,
  sendComposerDraft,
} from './AgentComposer'

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

test('approval mode defaults safely and persists each supported selection', () => {
  const values = new Map<string, string>()
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
  }
  expect(readApprovalMode(storage)).toBe('auto-edit')
  for (const mode of ['supervised', 'auto-edit', 'full'] as const) {
    persistApprovalMode(mode, storage)
    expect(values.get('orchestos.approvalMode')).toBe(mode)
    expect(readApprovalMode(storage)).toBe(mode)
  }
  values.set('orchestos.approvalMode', 'invalid')
  expect(readApprovalMode(storage)).toBe('auto-edit')
  expect(
    readApprovalMode({
      getItem() {
        throw new Error('blocked')
      },
    }),
  ).toBe('auto-edit')
  expect(() =>
    persistApprovalMode('full', {
      setItem() {
        throw new Error('blocked')
      },
    }),
  ).not.toThrow()
})
