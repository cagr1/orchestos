import { afterEach, expect, test } from 'bun:test'
import {
  DEFAULT_EDITOR_SETTINGS,
  readEditorSettings,
  subscribeEditorSettings,
  writeEditorSettings,
} from './editor-settings'

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

test('defaults match the current editor behavior', () => {
  installWindow()
  expect(readEditorSettings()).toEqual(DEFAULT_EDITOR_SETTINGS)
})

test('invalid JSON and fields fall back to defaults', () => {
  installWindow()
  values.set('orchestos-editor', '{broken')
  expect(readEditorSettings()).toEqual(DEFAULT_EDITOR_SETTINGS)
  values.set(
    'orchestos-editor',
    JSON.stringify({ autoSave: 'always', autoSaveDelayMs: 'slow', wordWrap: 1, fontSize: null }),
  )
  expect(readEditorSettings()).toEqual(DEFAULT_EDITOR_SETTINGS)
})

test('delay and font size are clipped to supported values', () => {
  installWindow()
  values.set(
    'orchestos-editor',
    JSON.stringify({ autoSaveDelayMs: 20000, fontSize: 4 }),
  )
  expect(readEditorSettings()).toMatchObject({ autoSaveDelayMs: 10000, fontSize: 10 })
  values.set('orchestos-editor', JSON.stringify({ autoSaveDelayMs: 100, fontSize: 40 }))
  expect(readEditorSettings()).toMatchObject({ autoSaveDelayMs: 500, fontSize: 24 })
})

test('write merges preferences and persists them', () => {
  installWindow()
  let notifications = 0
  const unsubscribe = subscribeEditorSettings(() => notifications++)
  writeEditorSettings({ wordWrap: true })
  unsubscribe()
  expect(readEditorSettings()).toEqual({ ...DEFAULT_EDITOR_SETTINGS, wordWrap: true })
  expect(notifications).toBe(1)
  expect(JSON.parse(values.get('orchestos-editor') ?? 'null')).toEqual({
    ...DEFAULT_EDITOR_SETTINGS,
    wordWrap: true,
  })
})
