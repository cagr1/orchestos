import { useSyncExternalStore } from 'react'

export type TerminalSettings = {
  fontFamily: string
  fontSize: number
  cursorStyle: 'block' | 'bar' | 'underline'
  cursorBlink: boolean
  scrollback: number
  lineHeight: number
}
export const DEFAULT_TERMINAL_SETTINGS: TerminalSettings = {
  fontFamily: '"Fira Code", monospace',
  fontSize: 13,
  cursorStyle: 'block',
  cursorBlink: true,
  scrollback: 1000,
  lineHeight: 1,
}
const STORAGE_KEY = 'orchestos-terminal'
const listeners = new Set<() => void>()
let storageListening = false
let cachedRaw: string | null | undefined
let cachedSettings = DEFAULT_TERMINAL_SETTINGS

export function normalizeTerminalSettings(value: unknown): TerminalSettings {
  const record =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {}
  const number = (value: unknown, fallback: number, min: number, max: number, factor = 1) =>
    typeof value === 'number' && Number.isFinite(value)
      ? Math.round(Math.min(max, Math.max(min, value)) * factor) / factor
      : fallback
  return {
    fontFamily:
      typeof record.fontFamily === 'string' && record.fontFamily.trim()
        ? record.fontFamily.trim().slice(0, 200)
        : DEFAULT_TERMINAL_SETTINGS.fontFamily,
    fontSize: number(record.fontSize, 13, 10, 24),
    cursorStyle:
      record.cursorStyle === 'bar' || record.cursorStyle === 'underline'
        ? record.cursorStyle
        : 'block',
    cursorBlink: typeof record.cursorBlink === 'boolean' ? record.cursorBlink : true,
    scrollback: number(record.scrollback, 1000, 100, 100000),
    lineHeight: number(record.lineHeight, 1, 1, 2, 10),
  }
}

export function parseTerminalSettings(raw: string | null): TerminalSettings {
  try {
    return normalizeTerminalSettings(JSON.parse(raw ?? 'null'))
  } catch {
    return { ...DEFAULT_TERMINAL_SETTINGS }
  }
}
export function readTerminalSettings(): TerminalSettings {
  if (typeof window === 'undefined') return DEFAULT_TERMINAL_SETTINGS
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (raw === cachedRaw) return cachedSettings
  cachedRaw = raw
  cachedSettings = parseTerminalSettings(raw)
  return cachedSettings
}

function notify() {
  for (const listener of listeners) listener()
}

function onStorage(event: StorageEvent) {
  if (event.key === STORAGE_KEY || event.key === null) notify()
}

export function subscribeTerminalSettings(listener: () => void) {
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

export function writeTerminalSettings(partial: Partial<TerminalSettings>): TerminalSettings {
  const next = normalizeTerminalSettings({ ...readTerminalSettings(), ...partial })
  if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  notify()
  return next
}

export function useTerminalSettings(): TerminalSettings {
  return useSyncExternalStore(
    subscribeTerminalSettings,
    readTerminalSettings,
    () => DEFAULT_TERMINAL_SETTINGS,
  )
}
