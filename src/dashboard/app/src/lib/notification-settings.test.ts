import { afterEach, expect, test } from 'bun:test'
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  readNotificationSettings,
  subscribeNotificationSettings,
  writeNotificationSettings,
} from './notification-settings'

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

test('notification defaults enable both types and sound', () => {
  installWindow()
  expect(readNotificationSettings()).toEqual({ turnFinished: true, needsInput: true, sound: true })
})

test('invalid JSON and fields fall back to defaults', () => {
  installWindow()
  for (const raw of [
    '{broken',
    'null',
    '[]',
    'true',
    '42',
    '{"turnFinished":1,"needsInput":null,"sound":"yes"}',
  ]) {
    values.set('orchestos-notifications', raw)
    expect(readNotificationSettings()).toEqual(DEFAULT_NOTIFICATION_SETTINGS)
  }
})

test('writes merge and persist disabled preferences and notify subscribers', () => {
  installWindow()
  let calls = 0
  const unsubscribe = subscribeNotificationSettings(() => calls++)
  writeNotificationSettings({ turnFinished: false })
  writeNotificationSettings({ sound: false })
  unsubscribe()
  const expected = { turnFinished: false, needsInput: true, sound: false }
  expect(readNotificationSettings()).toEqual(expected)
  expect(JSON.parse(values.get('orchestos-notifications') ?? 'null')).toEqual(expected)
  expect(calls).toBe(2)
})
