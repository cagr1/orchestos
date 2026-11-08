import { useSyncExternalStore } from 'react'

/** Global commands shared by App, the palette and Settings. Input keys stay local. */
type KeyEvent = Pick<KeyboardEvent, 'key' | 'code' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey'>
export type Chord = { primary: boolean; ctrl: boolean; alt: boolean; shift: boolean; code: string }

export function isMacPlatform(): boolean {
  return typeof navigator !== 'undefined' && /Mac/.test(navigator.platform)
}

function chord(code: string, modifiers: Partial<Omit<Chord, 'code'>> = {}): Chord {
  return { primary: false, ctrl: false, alt: false, shift: false, code, ...modifiers }
}

export function chordKeys(value: Chord): string[] {
  const mac = isMacPlatform()
  const names: Record<string, string> = {
    Equal: '=',
    Minus: '-',
    Comma: ',',
    Backquote: '`',
    BracketLeft: '[',
    BracketRight: ']',
    Escape: 'Esc',
    ArrowLeft: '←',
    ArrowUp: '↑',
    ArrowRight: '→',
    ArrowDown: '↓',
  }
  return [
    ...(value.primary ? [mac ? '⌘' : 'Ctrl'] : []),
    ...(value.ctrl && (mac || !value.primary) ? ['Ctrl'] : []),
    ...(value.alt ? [mac ? '⌥' : 'Alt'] : []),
    ...(value.shift ? [mac ? '⇧' : 'Shift'] : []),
    names[value.code] ?? value.code.replace(/^(Key|Digit)/, ''),
  ]
}

function matchesChord(event: KeyEvent, value: Chord): boolean {
  return (
    event.code === value.code &&
    !!event.metaKey === (value.primary && isMacPlatform()) &&
    !!event.ctrlKey === (value.ctrl || (value.primary && !isMacPlatform())) &&
    !!event.altKey === value.alt &&
    !!event.shiftKey === value.shift
  )
}

function command<const Id extends string>(
  id: Id,
  title: string,
  defaultChord: Chord,
  when: 'App' | 'Settings' | 'Dev' | 'Turn running',
) {
  return {
    id,
    title,
    defaultChord,
    when,
    get keys() {
      const value = effectiveChord(id as CommandId)
      return value ? chordKeys(value) : []
    },
    match(event: KeyEvent): boolean {
      const value = effectiveChord(id as CommandId)
      return (
        value !== null &&
        matchesChord(
          id === 'zoom-in' && value.code === 'Equal' && !value.shift
            ? {
                key: event.key,
                code: event.code,
                metaKey: event.metaKey,
                ctrlKey: event.ctrlKey,
                altKey: event.altKey,
                shiftKey: false,
              }
            : event,
          value,
        )
      )
    },
  }
}

export const KEYBINDINGS = [
  command('zoom-in', 'Zoom in', chord('Equal', { primary: true }), 'App'),
  command('zoom-out', 'Zoom out', chord('Minus', { primary: true }), 'App'),
  command('zoom-reset', 'Reset zoom', chord('Digit0', { primary: true }), 'App'),
  command('command-palette', 'Command palette', chord('KeyK', { primary: true }), 'App'),
  command('settings-search', 'Search settings', chord('KeyK', { primary: true }), 'Settings'),
  command('go-to-file', 'Go to file', chord('KeyP', { primary: true }), 'App'),
  command('open-settings', 'Open settings', chord('Comma', { primary: true }), 'App'),
  command('mode-chat', 'Switch to Chat', chord('Digit1', { alt: true }), 'App'),
  command('mode-dev', 'Switch to Dev', chord('Digit2', { alt: true }), 'App'),
  command('new-chat', 'New chat', chord('KeyN', { alt: true }), 'App'),
  command('toggle-sidebar', 'Toggle sidebar', chord('KeyB', { primary: true }), 'App'),
  command(
    'toggle-right-panel',
    'Toggle right panel',
    chord('KeyB', { primary: true, alt: true }),
    'App',
  ),
  command('new-terminal', 'New terminal', chord('Backquote', { ctrl: true }), 'Dev'),
  command('close-tab', 'Close tab', chord('KeyW', { alt: true }), 'Dev'),
  command('next-tab', 'Next tab', chord('BracketRight', { alt: true }), 'Dev'),
  command('previous-tab', 'Previous tab', chord('BracketLeft', { alt: true }), 'Dev'),
  command('stop-turn', 'Stop', chord('Escape'), 'Turn running'),
] as const

export type CommandId = (typeof KEYBINDINGS)[number]['id']
type Overrides = Partial<Record<CommandId, Chord | null>>
const STORAGE_KEY = 'orchestos-keybindings'
const EMPTY: Overrides = {}
const listeners = new Set<() => void>()
let storageListening = false
let cachedRaw: string | null | undefined
let cachedOverrides: Overrides = EMPTY

function isChord(value: unknown): value is Chord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  return (
    ['primary', 'ctrl', 'alt', 'shift'].every((key) => typeof record[key] === 'boolean') &&
    typeof record.code === 'string' &&
    record.code.length > 0 &&
    !/^(Meta|Control|Alt|Shift)(Left|Right)?$/.test(record.code)
  )
}

export function readChords(): Overrides {
  if (typeof window === 'undefined') return EMPTY
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (raw === cachedRaw) return cachedOverrides
  cachedRaw = raw
  cachedOverrides = {}
  try {
    const value: unknown = JSON.parse(raw ?? '{}')
    if (!value || typeof value !== 'object' || Array.isArray(value)) return cachedOverrides
    for (const { id } of KEYBINDINGS) {
      const entry = (value as Record<string, unknown>)[id]
      if (entry === null) cachedOverrides[id] = null
      else if (isChord(entry)) cachedOverrides[id] = entry
    }
  } catch {
    /* Ignore invalid local settings. */
  }
  return cachedOverrides
}

function notify() {
  for (const listener of listeners) listener()
}
function onStorage(event: StorageEvent) {
  if (event.key === STORAGE_KEY || event.key === null) notify()
}
export function subscribeChords(listener: () => void) {
  listeners.add(listener)
  if (!storageListening && typeof window !== 'undefined') {
    window.addEventListener('storage', onStorage)
    storageListening = true
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && storageListening && typeof window !== 'undefined') {
      window.removeEventListener('storage', onStorage)
      storageListening = false
    }
  }
}
export function useKeybindings() {
  return useSyncExternalStore(subscribeChords, readChords, () => EMPTY)
}
function writeChords(value: Overrides) {
  if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  notify()
}
export function setChord(id: CommandId, value: Chord | null) {
  writeChords({ ...readChords(), [id]: value })
}
export function resetChord(id: CommandId) {
  const next = { ...readChords() }
  delete next[id]
  writeChords(next)
}
export function resetAllChords() {
  writeChords({})
}
export function effectiveChord(id: CommandId): Chord | null {
  const overrides = readChords()
  return Object.hasOwn(overrides, id)
    ? overrides[id]!
    : KEYBINDINGS.find((entry) => entry.id === id)!.defaultChord
}

export function chordFromEvent(event: KeyEvent): Chord | null {
  if (
    /^(Meta|Control|Alt|Shift)$/.test(event.key) ||
    /^(Meta|Control|Alt|Shift)(Left|Right)?$/.test(event.code)
  )
    return null
  return chord(event.code, {
    primary: isMacPlatform() ? !!event.metaKey : !!event.ctrlKey,
    ctrl: isMacPlatform() && !!event.ctrlKey,
    alt: !!event.altKey,
    shift: !!event.shiftKey,
  })
}

type Validation =
  | { error: 'Add a modifier' | 'Reserved by the browser'; conflictWith?: never }
  | { conflictWith: CommandId; error?: never }
  | { error?: never; conflictWith?: never }
export function validateChord(id: CommandId, value: Chord): Validation {
  if (
    !value.primary &&
    !value.ctrl &&
    !value.alt &&
    !value.shift &&
    !(value.code === 'Escape' && id === 'stop-turn') &&
    !/^F([1-9]|1[0-2])$/.test(value.code)
  ) {
    return { error: 'Add a modifier' }
  }
  if (
    (value.primary || (!isMacPlatform() && value.ctrl)) &&
    /^(Key[WTNQRL]|Digit[1-9]|Tab)$/.test(value.code)
  ) {
    return { error: 'Reserved by the browser' }
  }
  const current = KEYBINDINGS.find((entry) => entry.id === id)!
  const conflict = KEYBINDINGS.find((other) => {
    if (other.id === id) return false
    if ([id, other.id].includes('command-palette') && [id, other.id].includes('settings-search'))
      return false
    const overlaps =
      current.when === other.when ||
      current.when === 'App' ||
      other.when === 'App' ||
      current.when === 'Turn running' ||
      other.when === 'Turn running'
    const effective = effectiveChord(other.id)
    return (
      overlaps &&
      effective !== null &&
      matchesChord(
        {
          key: '',
          code: value.code,
          metaKey: value.primary && isMacPlatform(),
          ctrlKey: value.ctrl || (value.primary && !isMacPlatform()),
          altKey: value.alt,
          shiftKey: value.shift,
        },
        effective,
      )
    )
  })
  return conflict ? { conflictWith: conflict.id } : {}
}

export function reachesAppFromTerminal(
  binding: (typeof KEYBINDINGS)[number],
  event: KeyEvent,
): boolean {
  return binding.id === 'new-terminal' || event.metaKey
}
export function matchesKeybinding(event: KeyEvent, id: CommandId, _ignoreCase = false): boolean {
  return KEYBINDINGS.find((entry) => entry.id === id)!.match(event)
}
