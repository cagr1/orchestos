import { afterEach, expect, test } from 'bun:test'
import { KEYBINDINGS, matchesKeybinding, reachesAppFromTerminal } from './keybindings'

const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
function platform(value: string) {
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { platform: value } })
}
afterEach(() => {
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
    for (const id of ['command-palette', 'go-to-file', 'toggle-sidebar', 'open-settings'] as const) {
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
  expect(reachesAppFromTerminal(binding, { ...shortcut, metaKey: false, ctrlKey: true })).toBe(false)
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
        altKey: binding.keys.includes('Alt'),
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
