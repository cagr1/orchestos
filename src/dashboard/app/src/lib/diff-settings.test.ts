import { afterEach, beforeEach, expect, test } from 'bun:test'
import {
  DEFAULT_DIFF_SETTINGS,
  normalizeDiffSettings,
  parseDiffSettings,
  readDiffSettings,
  subscribeDiffSettings,
  writeDiffSettings,
} from './diff-settings'

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

test('defaults preserve unified list and reject malformed preferences', () => {
  expect(readDiffSettings()).toEqual(DEFAULT_DIFF_SETTINGS)
  for (const raw of ['{broken', 'null', '[]', '42', '"diff"'])
    expect(parseDiffSettings(raw)).toEqual(DEFAULT_DIFF_SETTINGS)
  expect(
    normalizeDiffSettings({
      view: 'other',
      changesLayout: 'other',
      ignoreWhitespace: 1,
      foldersExpanded: 'yes',
    }),
  ).toEqual(DEFAULT_DIFF_SETTINGS)
})

test('writes normalize, merge, persist, notify and keep a stable snapshot', () => {
  let notifications = 0
  const unsubscribe = subscribeDiffSettings(() => notifications++)
  writeDiffSettings({ ignoreWhitespace: true, changesLayout: 'tree' })
  const next = writeDiffSettings({ view: 'split', foldersExpanded: false })
  expect(next).toEqual({
    view: 'split',
    foldersExpanded: false,
    ignoreWhitespace: true,
    changesLayout: 'tree',
  })
  expect(JSON.parse(values.get('orchestos-diff')!)).toEqual(next)
  const snapshot = readDiffSettings()
  expect(readDiffSettings()).toBe(snapshot)
  expect(notifications).toBe(2)
  unsubscribe()
  writeDiffSettings({ view: 'unified' })
  expect(notifications).toBe(2)
})

test('storage events synchronize other tabs and clearing preferences', () => {
  let notifications = 0
  const unsubscribe = subscribeDiffSettings(() => notifications++)
  values.set('orchestos-diff', JSON.stringify({ view: 'split', foldersExpanded: false }))
  host.dispatchEvent(Object.assign(new Event('storage'), { key: 'orchestos-diff' }))
  expect(readDiffSettings()).toEqual({
    ...DEFAULT_DIFF_SETTINGS,
    view: 'split',
    foldersExpanded: false,
  })
  host.dispatchEvent(Object.assign(new Event('storage'), { key: 'other' }))
  expect(notifications).toBe(1)
  values.clear()
  host.dispatchEvent(Object.assign(new Event('storage'), { key: null }))
  expect(readDiffSettings()).toEqual(DEFAULT_DIFF_SETTINGS)
  expect(notifications).toBe(2)
  unsubscribe()
})

test('server snapshot uses defaults without a browser', () => {
  Reflect.deleteProperty(globalThis, 'window')
  expect(readDiffSettings()).toEqual(DEFAULT_DIFF_SETTINGS)
})
