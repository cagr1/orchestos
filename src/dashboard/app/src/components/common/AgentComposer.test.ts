import { describe, expect, test } from 'bun:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { stopChatTurn } from '../../api/chat'
import { findExplorerFiles } from '../../api/explorer'
import { StoppedResponse } from '../thread/StoppedResponse'
import {
  ComposerSubmitButton,
  cliDisplayName,
  fileReferenceToken,
  persistApprovalMode,
  readApprovalMode,
  selectionFromDefaults,
  sendComposerDraft,
} from './AgentComposer'

test('composer renders Send → Stop → Stopping, then Send after completion', () => {
  const onStop = async () => {}
  const render = (busy: boolean, stopping = false) =>
    renderToStaticMarkup(
      createElement(ComposerSubmitButton, {
        onSend: () => {},
        onStop,
        busy,
        stopping,
        hasDraft: false,
        sendDisabled: true,
      }),
    )
  expect(render(false)).toContain('aria-label="Send message"')
  const stop = render(true)
  expect(stop).toContain('aria-label="Stop response"')
  expect(stop.match(/<button[^>]*aria-label="Stop response"[^>]*>/)?.[0]).not.toContain('disabled')
  expect(stop).toContain('lucide-square')
  const stopping = render(true, true)
  expect(stopping.match(/<button[^>]*aria-label="Stopping response"[^>]*>/)?.[0]).toContain(
    'disabled',
  )
  expect(stopping).toContain('Deteniendo…')
  expect(render(false, true)).toContain('aria-label="Send message"')
})

test('stopped response is a muted text mark without an error alert', () => {
  expect(renderToStaticMarkup(createElement(StoppedResponse, { stopped: false }))).toBe('')
  const mark = renderToStaticMarkup(createElement(StoppedResponse, { stopped: true }))
  expect(mark).toContain('Respuesta detenida')
  expect(mark).toContain('text-xs text-app-muted')
  expect(mark).not.toContain('alert')
  expect(mark).not.toContain('<svg')
})

test('Stop click calls the endpoint with the current turn rather than sending a draft', async () => {
  const originalFetch = globalThis.fetch
  let received: unknown
  let sends = 0
  globalThis.fetch = (async (_path, init) => {
    received = JSON.parse(String(init?.body))
    return new Response(JSON.stringify({ status: 'stopping' }), { status: 202 })
  }) as typeof fetch
  try {
    const props = {
      busy: true,
      stopping: false,
      hasDraft: false,
      sendDisabled: true,
      onStop: () => stopChatTurn('session-1', 'current-turn'),
      onSend: () => {
        sends++
      },
    }
    const button = ComposerSubmitButton(props)
    await button.props.onClick()
    expect(received).toEqual({ turnId: 'current-turn' })
    expect(sends).toBe(0)
    expect(ComposerSubmitButton({ ...props, stopping: true }).props.disabled).toBe(true)
    expect(ComposerSubmitButton({ ...props, onStop: undefined }).props.disabled).toBe(true)
  } finally {
    globalThis.fetch = originalFetch
  }
})

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

test('file reference token starts at @ or after whitespace, never inside an email', () => {
  expect(fileReferenceToken('@', 1)).toEqual({ start: 0, end: 1, query: '' })
  expect(fileReferenceToken('Read @README then', 12)).toEqual({
    start: 5,
    end: 12,
    query: 'README',
  })
  expect(fileReferenceToken('a@b', 3)).toBeNull()
  expect(fileReferenceToken('@README ', 8)).toBeNull()
  expect(fileReferenceToken('line\n@file', 10)).toEqual({ start: 5, end: 10, query: 'file' })
})

test('file search traverses nested folders with the session project and caps at 20 matches', async () => {
  const originalFetch = globalThis.fetch
  const requested: string[] = []
  const controller = new AbortController()
  globalThis.fetch = (async (path, init) => {
    expect(new Headers(init?.headers).get('x-orchestos-project-id')).toBe('session-project')
    expect(init?.signal).toBe(controller.signal)
    const folder = new URL(String(path), 'http://localhost').searchParams.get('path')
    requested.push(folder ?? '')
    const entries =
      folder === ''
        ? [
            { name: 'src', path: 'src', type: 'dir' },
            { name: 'other.md', path: 'other.md', type: 'file' },
          ]
        : Array.from({ length: 25 }, (_, index) => ({
            name: `file-${index}.ts`,
            path: `src/file-${index}.ts`,
            type: 'file',
          }))
    return Response.json({ entries })
  }) as typeof fetch
  try {
    const files = await findExplorerFiles('FILE-', 'session-project', controller.signal)
    expect(requested).toEqual(['', 'src'])
    expect(files).toHaveLength(20)
    expect(files[0].path).toBe('src/file-0.ts')
    controller.abort()
    await expect(findExplorerFiles('', 'session-project', controller.signal)).rejects.toThrow()
    expect(requested).toHaveLength(2)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('API engine is labeled OpenRouter', () => {
  expect(cliDisplayName('api')).toBe('OpenRouter')
})

test('composer without a thread takes the backend default and honors an explicit CLI', () => {
  const backendDefault = { agent: 'codex' }
  expect(selectionFromDefaults(backendDefault.agent, undefined, 'medium').cli).toBe('codex')
  expect(selectionFromDefaults(backendDefault.agent, undefined, 'medium', 'claude').cli).toBe(
    'claude',
  )
})
