import { afterEach, beforeEach, expect, test } from 'bun:test'
import {
  DEFAULT_APPEARANCE_SETTINGS,
  UI_SCALES,
  normalizeAppearanceSettings,
  parseAppearanceSettings,
  readAppearanceSettings,
  resetScale,
  stepScale,
  subscribeAppearanceSettings,
  writeAppearanceSettings,
} from './appearance-settings'

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

test('defaults preserve existing appearance and malformed storage falls back', () => {
  expect(readAppearanceSettings()).toEqual(DEFAULT_APPEARANCE_SETTINGS)
  for (const raw of ['{broken', 'null', '[]', '42', '"scale"'])
    expect(parseAppearanceSettings(raw)).toEqual(DEFAULT_APPEARANCE_SETTINGS)
  expect(
    normalizeAppearanceSettings({ uiScale: NaN, showGitIgnored: 0, diffPalette: 'red' }),
  ).toEqual(DEFAULT_APPEARANCE_SETTINGS)
  expect(normalizeAppearanceSettings({ uiScale: Infinity })).toEqual(DEFAULT_APPEARANCE_SETTINGS)
  expect(normalizeAppearanceSettings({ uiScale: '1.25' })).toEqual(DEFAULT_APPEARANCE_SETTINGS)
})

test('scale rounds to nearest supported step and clamps both ends', () => {
  for (const scale of UI_SCALES)
    expect(normalizeAppearanceSettings({ uiScale: scale }).uiScale).toBe(scale)
  for (const [value, expected] of [
    [-10, 0.8],
    [10, 1.5],
    [0.87, 0.9],
    [1.19, 1.25],
  ])
    expect(normalizeAppearanceSettings({ uiScale: value }).uiScale).toBe(expected!)
  UI_SCALES.forEach((scale, index) => {
    expect(stepScale(scale, 1)).toBe(UI_SCALES[Math.min(index + 1, UI_SCALES.length - 1)]!)
    expect(stepScale(scale, -1)).toBe(UI_SCALES[Math.max(index - 1, 0)]!)
  })
  expect(stepScale(1.19, -1)).toBe(1.1)
  expect(resetScale()).toBe(1)
})

test('writes normalize, merge, persist, notify and keep a stable snapshot', () => {
  let notifications = 0
  const unsubscribe = subscribeAppearanceSettings(() => notifications++)
  writeAppearanceSettings({ showGitIgnored: false, diffPalette: 'colorblind' })
  const next = writeAppearanceSettings({ uiScale: 1.19 })
  expect(next).toEqual({ uiScale: 1.25, showGitIgnored: false, diffPalette: 'colorblind' })
  expect(JSON.parse(values.get('orchestos-appearance')!)).toEqual(next)
  const snapshot = readAppearanceSettings()
  expect(readAppearanceSettings()).toBe(snapshot)
  expect(notifications).toBe(2)
  unsubscribe()
  writeAppearanceSettings({ uiScale: resetScale() })
  expect(notifications).toBe(2)
})

test('storage events synchronize other tabs and clearing preferences', () => {
  let notifications = 0
  const unsubscribe = subscribeAppearanceSettings(() => notifications++)
  values.set('orchestos-appearance', JSON.stringify({ uiScale: 1.5, showGitIgnored: false }))
  host.dispatchEvent(Object.assign(new Event('storage'), { key: 'orchestos-appearance' }))
  expect(readAppearanceSettings()).toEqual({
    ...DEFAULT_APPEARANCE_SETTINGS,
    uiScale: 1.5,
    showGitIgnored: false,
  })
  host.dispatchEvent(Object.assign(new Event('storage'), { key: 'other' }))
  expect(notifications).toBe(1)
  values.clear()
  host.dispatchEvent(Object.assign(new Event('storage'), { key: null }))
  expect(readAppearanceSettings()).toEqual(DEFAULT_APPEARANCE_SETTINGS)
  expect(notifications).toBe(2)
  unsubscribe()
})

test('server snapshot uses defaults without a browser', () => {
  Reflect.deleteProperty(globalThis, 'window')
  expect(readAppearanceSettings()).toEqual(DEFAULT_APPEARANCE_SETTINGS)
})
