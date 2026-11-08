import { afterEach, beforeEach, expect, test } from 'bun:test'
import {
  DEFAULT_TERMINAL_SETTINGS,
  normalizeTerminalSettings,
  parseTerminalSettings,
  readTerminalSettings,
  subscribeTerminalSettings,
  writeTerminalSettings,
} from './terminal-settings'

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
let values: Map<string, string>
let host: EventTarget
beforeEach(() => {
  values = new Map()
  host = new EventTarget()
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: Object.assign(host, {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
      },
    }),
  })
})
afterEach(() => {
  if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow)
  else Reflect.deleteProperty(globalThis, 'window')
})

test('defaults and malformed settings retain existing terminal behavior', () => {
  expect(readTerminalSettings()).toEqual(DEFAULT_TERMINAL_SETTINGS)
  for (const raw of ['{broken', 'null', '[]', '42', '"terminal"'])
    expect(parseTerminalSettings(raw)).toEqual(DEFAULT_TERMINAL_SETTINGS)
  expect(
    normalizeTerminalSettings({
      fontFamily: '  ',
      fontSize: NaN,
      scrollback: Infinity,
      cursorStyle: 'other',
      cursorBlink: 1,
      lineHeight: '2',
    }),
  ).toEqual(DEFAULT_TERMINAL_SETTINGS)
})

test('normalizes finite bounds, integers, line height steps and font names', () => {
  expect(
    normalizeTerminalSettings({
      fontFamily: ' x '.repeat(100),
      fontSize: 30,
      scrollback: 1,
      lineHeight: 1.26,
      cursorStyle: 'underline',
      cursorBlink: false,
    }),
  ).toEqual({
    fontFamily: ' x '.repeat(100).trim().slice(0, 200),
    fontSize: 24,
    scrollback: 100,
    lineHeight: 1.3,
    cursorStyle: 'underline',
    cursorBlink: false,
  })
  expect(normalizeTerminalSettings({ fontSize: 1, scrollback: 100001, lineHeight: 3 })).toEqual({
    ...DEFAULT_TERMINAL_SETTINGS,
    fontSize: 10,
    scrollback: 100000,
    lineHeight: 2,
  })
  expect(
    normalizeTerminalSettings({ fontSize: 13.7, scrollback: 120.7, lineHeight: 0 }).fontSize,
  ).toBe(14)
  expect(normalizeTerminalSettings({ scrollback: 120.7 }).scrollback).toBe(121)
  expect(normalizeTerminalSettings({ lineHeight: 0 }).lineHeight).toBe(1)
})

test('writes merge, persist, notify and keep stable snapshots', () => {
  let notifications = 0
  const unsubscribe = subscribeTerminalSettings(() => notifications++)
  writeTerminalSettings({ fontSize: 16, cursorStyle: 'bar' })
  const next = writeTerminalSettings({ cursorBlink: false })
  expect(next).toEqual({
    ...DEFAULT_TERMINAL_SETTINGS,
    fontSize: 16,
    cursorStyle: 'bar',
    cursorBlink: false,
  })
  expect(JSON.parse(values.get('orchestos-terminal')!)).toEqual(next)
  expect(readTerminalSettings()).toBe(readTerminalSettings())
  expect(notifications).toBe(2)
  unsubscribe()
  writeTerminalSettings({ fontSize: 13 })
  expect(notifications).toBe(2)
})

test('storage synchronizes tabs and clearing; server reads defaults', () => {
  let notifications = 0
  const unsubscribe = subscribeTerminalSettings(() => notifications++)
  values.set('orchestos-terminal', JSON.stringify({ fontSize: 18 }))
  host.dispatchEvent(Object.assign(new Event('storage'), { key: 'orchestos-terminal' }))
  expect(readTerminalSettings().fontSize).toBe(18)
  host.dispatchEvent(Object.assign(new Event('storage'), { key: 'other' }))
  expect(notifications).toBe(1)
  values.clear()
  host.dispatchEvent(Object.assign(new Event('storage'), { key: null }))
  expect(readTerminalSettings()).toEqual(DEFAULT_TERMINAL_SETTINGS)
  expect(notifications).toBe(2)
  unsubscribe()
  Reflect.deleteProperty(globalThis, 'window')
  expect(readTerminalSettings()).toEqual(DEFAULT_TERMINAL_SETTINGS)
})
