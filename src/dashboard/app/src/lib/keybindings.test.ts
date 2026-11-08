import { afterEach, beforeEach, expect, test } from 'bun:test'
import {
  KEYBINDINGS,
  chordFromEvent,
  chordKeys,
  effectiveChord,
  matchesKeybinding,
  readChords,
  reachesAppFromTerminal,
  resetAllChords,
  resetChord,
  setChord,
  subscribeChords,
  validateChord,
} from './keybindings'

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
let storage: Map<string, string>
let hostWindow: EventTarget
beforeEach(() => {
  storage = new Map()
  hostWindow = new EventTarget()
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: Object.assign(hostWindow, {
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
      },
    }),
  })
  resetAllChords()
})
const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
function platform(value: string) {
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { platform: value } })
}
afterEach(() => {
  if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow)
  else Reflect.deleteProperty(globalThis, 'window')
  if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator)
  else Reflect.deleteProperty(globalThis, 'navigator')
})

const event = (overrides: Partial<KeyboardEvent> = {}) => ({
  key: '',
  code: '',
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  ...overrides,
})

const physical: Record<string, [string, string]> = {
  'command-palette': ['k', 'KeyK'],
  'settings-search': ['k', 'KeyK'],
  'go-to-file': ['p', 'KeyP'],
  'open-settings': [',', 'Comma'],
  'mode-chat': ['1', 'Digit1'],
  'mode-dev': ['2', 'Digit2'],
  'new-chat': ['n', 'KeyN'],
  'toggle-sidebar': ['b', 'KeyB'],
  'toggle-right-panel': ['b', 'KeyB'],
  'new-terminal': ['`', 'Backquote'],
  'close-tab': ['w', 'KeyW'],
  'next-tab': [']', 'BracketRight'],
  'previous-tab': ['[', 'BracketLeft'],
  'stop-turn': ['Escape', 'Escape'],
}

for (const host of ['Linux x86_64', 'Win32']) {
  test(`terminal keeps Ctrl shortcuts on ${host}, except new terminal`, () => {
    platform(host)
    for (const id of [
      'command-palette',
      'go-to-file',
      'toggle-sidebar',
      'open-settings',
    ] as const) {
      const binding = KEYBINDINGS.find((entry) => entry.id === id)!
      const [key, code] = physical[id]
      const shortcut = event({ key, code, ctrlKey: true })
      expect(binding.match(shortcut)).toBe(true)
      expect(reachesAppFromTerminal(binding, shortcut)).toBe(false)
    }
    const binding = KEYBINDINGS.find((entry) => entry.id === 'new-terminal')!
    const shortcut = event({ key: '`', code: 'Backquote', ctrlKey: true })
    expect(binding.match(shortcut)).toBe(true)
    expect(reachesAppFromTerminal(binding, shortcut)).toBe(true)
  })
}

test('terminal allows Command+K on Mac and keeps Ctrl+K', () => {
  platform('MacIntel')
  const binding = KEYBINDINGS.find((entry) => entry.id === 'command-palette')!
  const shortcut = event({ key: 'k', code: 'KeyK', metaKey: true })
  expect(binding.match(shortcut)).toBe(true)
  expect(reachesAppFromTerminal(binding, shortcut)).toBe(true)
  expect(reachesAppFromTerminal(binding, { ...shortcut, metaKey: false, ctrlKey: true })).toBe(
    false,
  )
})

test('14 unique commands, unique chords within each context', () => {
  expect(KEYBINDINGS).toHaveLength(14)
  expect(new Set(KEYBINDINGS.map((entry) => entry.id)).size).toBe(14)
  expect(new Set(KEYBINDINGS.map((entry) => `${entry.when}:${entry.keys.join('+')}`)).size).toBe(14)
})

for (const host of ['MacIntel', 'Linux x86_64', 'Win32']) {
  test(`all commands match exact platform modifiers on ${host}`, () => {
    platform(host)
    for (const binding of KEYBINDINGS) {
      const [key, code] = physical[binding.id]
      const shortcut = event({
        key,
        code,
        altKey: binding.keys.includes('Alt') || binding.keys.includes('⌥'),
        metaKey: binding.keys.includes('⌘'),
        ctrlKey: binding.keys.includes('Ctrl'),
      })
      expect(binding.match(shortcut)).toBe(true)
      expect(matchesKeybinding(shortcut, binding.id)).toBe(true)
      expect(binding.match({ ...shortcut, shiftKey: true })).toBe(false)
      expect(binding.match({ ...shortcut, metaKey: !shortcut.metaKey })).toBe(false)
      expect(binding.match({ ...shortcut, ctrlKey: !shortcut.ctrlKey })).toBe(false)
      expect(binding.match({ ...shortcut, altKey: !shortcut.altKey })).toBe(false)
      expect(binding.match({ ...shortcut, key: 'x', code: 'KeyX' })).toBe(false)
      if (shortcut.altKey) {
        expect(binding.match({ ...shortcut, key: '≠' })).toBe(true)
        expect(binding.match({ ...shortcut, code: 'KeyX' })).toBe(false)
      }
    }
    expect(KEYBINDINGS[0].keys).toEqual([host === 'MacIntel' ? '⌘' : 'Ctrl', 'K'])
  })

  test(`browser-owned shortcuts stay untouched on ${host}`, () => {
    platform(host)
    for (const key of ['w', 't', 'n', '1', '2', '3', '4', '5', '6', '7', '8', '9']) {
      const shortcut = event({ key, metaKey: host === 'MacIntel', ctrlKey: host !== 'MacIntel' })
      expect(KEYBINDINGS.some((binding) => binding.match(shortcut))).toBe(false)
    }
  })
}

for (const host of ['MacIntel', 'Linux x86_64']) {
  test(`record, display, persist, disable and reset chords on ${host}`, () => {
    platform(host)
    const mac = host === 'MacIntel'
    const shortcut = event({ code: 'KeyE', metaKey: mac, ctrlKey: !mac, shiftKey: true })
    const value = chordFromEvent(shortcut)!
    expect(value).toEqual({ primary: true, ctrl: false, alt: false, shift: true, code: 'KeyE' })
    expect(chordKeys(value)).toEqual(mac ? ['⌘', '⇧', 'E'] : ['Ctrl', 'Shift', 'E'])
    expect(validateChord('toggle-sidebar', value)).toEqual({})
    let notifications = 0
    const unsubscribe = subscribeChords(() => notifications++)
    setChord('toggle-sidebar', value)
    expect(notifications).toBe(1)
    expect(JSON.parse(storage.get('orchestos-keybindings')!)).toEqual({ 'toggle-sidebar': value })
    expect(matchesKeybinding(shortcut, 'toggle-sidebar')).toBe(true)
    expect(matchesKeybinding({ ...shortcut, shiftKey: false }, 'toggle-sidebar')).toBe(false)
    expect(validateChord('go-to-file', value)).toEqual({ conflictWith: 'toggle-sidebar' })
    setChord('toggle-sidebar', null)
    expect(effectiveChord('toggle-sidebar')).toBeNull()
    expect(matchesKeybinding(shortcut, 'toggle-sidebar')).toBe(false)
    expect(KEYBINDINGS.find((entry) => entry.id === 'toggle-sidebar')!.keys).toEqual([])
    expect(validateChord('go-to-file', value)).toEqual({})
    resetChord('toggle-sidebar')
    expect(effectiveChord('toggle-sidebar')).toEqual(
      KEYBINDINGS.find((entry) => entry.id === 'toggle-sidebar')!.defaultChord,
    )
    setChord('go-to-file', value)
    resetAllChords()
    expect(readChords()).toEqual({})
    unsubscribe()
  })
}

test('modifier-only events keep recording; validation restricts unmodified and browser chords', () => {
  platform('MacIntel')
  for (const key of ['Meta', 'Control', 'Alt', 'Shift'])
    expect(chordFromEvent(event({ key, code: `${key}Left` }))).toBeNull()
  const plain = chordFromEvent(event({ code: 'Escape' }))!
  expect(validateChord('stop-turn', plain)).toEqual({})
  expect(validateChord('go-to-file', plain)).toEqual({ error: 'Add a modifier' })
  expect(validateChord('go-to-file', { ...plain, code: 'KeyA' })).toEqual({
    error: 'Add a modifier',
  })
  for (let i = 1; i <= 12; i++)
    expect(validateChord('go-to-file', { ...plain, code: `F${i}` })).toEqual({})
  expect(validateChord('go-to-file', { ...plain, code: 'F13' })).toEqual({
    error: 'Add a modifier',
  })
  for (const code of [
    'KeyW',
    'KeyT',
    'KeyN',
    'KeyQ',
    'KeyR',
    'KeyL',
    'Tab',
    ...Array.from({ length: 9 }, (_, i) => `Digit${i + 1}`),
  ]) {
    expect(validateChord('go-to-file', { ...plain, primary: true, code })).toEqual({
      error: 'Reserved by the browser',
    })
  }
})

test('context overlap and designed palette/search sharing', () => {
  platform('MacIntel')
  const f2 = chordFromEvent(event({ code: 'F2' }))!
  setChord('settings-search', f2)
  expect(validateChord('next-tab', f2)).toEqual({})
  expect(validateChord('command-palette', f2)).toEqual({})
  expect(validateChord('go-to-file', f2)).toEqual({ conflictWith: 'settings-search' })
  setChord('next-tab', f2)
  expect(validateChord('previous-tab', f2)).toEqual({ conflictWith: 'next-tab' })
  setChord('command-palette', f2)
  expect(effectiveChord('settings-search')).toEqual(f2)
  resetChord('command-palette')
  expect(effectiveChord('settings-search')).toEqual(f2)
})

test('storage validates structure and refreshes subscribers for other tabs and clear', () => {
  platform('MacIntel')
  let notifications = 0
  const unsubscribe = subscribeChords(() => notifications++)
  const value = chordFromEvent(event({ code: 'F3' }))!
  storage.set(
    'orchestos-keybindings',
    JSON.stringify({
      'new-chat': null,
      'go-to-file': value,
      unknown: value,
      'next-tab': { code: 'F4' },
      'previous-tab': [],
    }),
  )
  hostWindow.dispatchEvent(Object.assign(new Event('storage'), { key: 'orchestos-keybindings' }))
  expect(notifications).toBe(1)
  expect(readChords()).toEqual({ 'new-chat': null, 'go-to-file': value })
  expect(matchesKeybinding(event({ code: 'F3' }), 'go-to-file')).toBe(true)
  hostWindow.dispatchEvent(Object.assign(new Event('storage'), { key: 'other' }))
  expect(notifications).toBe(1)
  storage.clear()
  hostWindow.dispatchEvent(Object.assign(new Event('storage'), { key: null }))
  expect(notifications).toBe(2)
  expect(readChords()).toEqual({})
  for (const raw of ['invalid', 'null', '[]', '42']) {
    storage.set('orchestos-keybindings', raw)
    expect(readChords()).toEqual({})
  }
  unsubscribe()
})

test('physical code matches independently of keyboard layout, and key labels cover special keys', () => {
  platform('MacIntel')
  expect(
    matchesKeybinding(event({ code: 'KeyK', key: 'л', metaKey: true }), 'command-palette'),
  ).toBe(true)
  for (const [code, label] of Object.entries({
    KeyK: 'K',
    Digit1: '1',
    Comma: ',',
    Backquote: '`',
    BracketLeft: '[',
    BracketRight: ']',
    Escape: 'Esc',
    F1: 'F1',
    ArrowLeft: '←',
    ArrowUp: '↑',
    ArrowRight: '→',
    ArrowDown: '↓',
    Space: 'Space',
  })) {
    expect(chordKeys({ primary: false, ctrl: false, alt: false, shift: false, code })).toEqual([
      label,
    ])
  }
  expect(chordKeys({ primary: true, ctrl: true, alt: true, shift: true, code: 'KeyE' })).toEqual([
    '⌘',
    'Ctrl',
    '⌥',
    '⇧',
    'E',
  ])
  platform('Linux')
  expect(chordKeys({ primary: true, ctrl: true, alt: true, shift: true, code: 'KeyE' })).toEqual([
    'Ctrl',
    'Alt',
    'Shift',
    'E',
  ])
})
