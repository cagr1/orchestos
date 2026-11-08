import { afterEach, expect, test } from 'bun:test'
import {
  DEFAULT_CHAT_SETTINGS,
  sendIntent,
  readChatSettings,
  subscribeChatSettings,
  writeChatSettings,
} from './chat-settings'

const originalWindow = globalThis.window
const values = new Map<string, string>()
const storage = {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => values.set(key, value),
  removeItem: (key: string) => values.delete(key),
}

function installWindow() {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: storage,
      addEventListener() {},
      removeEventListener() {},
    },
  })
}

afterEach(() => {
  values.clear()
  Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow })
})

test('defaults match the specified chat behavior', () => {
  installWindow()
  expect(readChatSettings()).toEqual({
    sendKey: 'enter',
    whileRunning: 'queue',
    confirmDelete: true,
    confirmArchive: true,
  })
})

test('invalid JSON and fields fall back to defaults', () => {
  installWindow()
  for (const raw of ['{broken', 'null', '[]', 'true', '42']) {
    values.set('orchestos-chat', raw)
    expect(readChatSettings()).toEqual(DEFAULT_CHAT_SETTINGS)
  }
  values.set(
    'orchestos-chat',
    JSON.stringify({
      sendKey: 'always',
      whileRunning: 'drop',
      confirmDelete: 1,
      confirmArchive: null,
    }),
  )
  expect(readChatSettings()).toEqual(DEFAULT_CHAT_SETTINGS)
})

test('write merges preferences and persists them', () => {
  installWindow()
  let notifications = 0
  const unsubscribe = subscribeChatSettings(() => notifications++)
  writeChatSettings({ sendKey: 'mod-enter', whileRunning: 'stop-and-send' })
  writeChatSettings({ confirmDelete: false })
  unsubscribe()
  expect(readChatSettings()).toEqual({
    ...DEFAULT_CHAT_SETTINGS,
    sendKey: 'mod-enter',
    whileRunning: 'stop-and-send',
    confirmDelete: false,
  })
  expect(notifications).toBe(2)
  expect(JSON.parse(values.get('orchestos-chat') ?? 'null')).toEqual({
    ...DEFAULT_CHAT_SETTINGS,
    sendKey: 'mod-enter',
    whileRunning: 'stop-and-send',
    confirmDelete: false,
  })
})

test('send intent handles both modes on both platforms', () => {
  const keys = [
    { key: 'Enter', shiftKey: false, metaKey: false, ctrlKey: false },
    { key: 'Enter', shiftKey: true, metaKey: false, ctrlKey: false },
    { key: 'Enter', shiftKey: false, metaKey: true, ctrlKey: false },
    { key: 'Enter', shiftKey: false, metaKey: false, ctrlKey: true },
    { key: 'Enter', shiftKey: true, metaKey: true, ctrlKey: true },
    { key: 'a', shiftKey: false, metaKey: false, ctrlKey: false },
    { key: 'Enter', shiftKey: false, metaKey: true, ctrlKey: true, isComposing: true },
  ]
  const cases = [
    {
      mode: 'enter',
      mac: true,
      expected: ['send', 'newline', 'send', 'send', 'newline', 'none', 'none'],
    },
    {
      mode: 'enter',
      mac: false,
      expected: ['send', 'newline', 'send', 'send', 'newline', 'none', 'none'],
    },
    {
      mode: 'mod-enter',
      mac: true,
      expected: ['newline', 'newline', 'send', 'newline', 'newline', 'none', 'none'],
    },
    {
      mode: 'mod-enter',
      mac: false,
      expected: ['newline', 'newline', 'newline', 'send', 'newline', 'none', 'none'],
    },
  ] as const
  for (const { mode, mac, expected } of cases) {
    expect(keys.map((event) => sendIntent(event, mode, mac))).toEqual([...expected])
  }
})
