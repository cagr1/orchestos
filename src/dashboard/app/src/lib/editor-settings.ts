import { useSyncExternalStore } from 'react'

export type EditorSettings = {
  autoSave: 'off' | 'afterDelay'
  autoSaveDelayMs: number
  wordWrap: boolean
  fontSize: number
}

export const DEFAULT_EDITOR_SETTINGS: EditorSettings = {
  autoSave: 'off',
  autoSaveDelayMs: 1000,
  wordWrap: false,
  fontSize: 12,
}

const STORAGE_KEY = 'orchestos-editor'
const listeners = new Set<() => void>()
let storageListening = false
let cachedRaw: string | null | undefined
let cachedSettings: EditorSettings = { ...DEFAULT_EDITOR_SETTINGS }

function boundedNumber(value: unknown, min: number, max: number, step: number, fallback: number) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  const rounded = Math.round(value / step) * step
  return Math.min(max, Math.max(min, rounded))
}

function parseSettings(raw: string | null): EditorSettings {
  if (!raw) return { ...DEFAULT_EDITOR_SETTINGS }
  try {
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object' || Array.isArray(value))
      return { ...DEFAULT_EDITOR_SETTINGS }
    const record = value as Record<string, unknown>
    return {
      autoSave:
        record.autoSave === 'off' || record.autoSave === 'afterDelay'
          ? record.autoSave
          : DEFAULT_EDITOR_SETTINGS.autoSave,
      autoSaveDelayMs: boundedNumber(
        record.autoSaveDelayMs,
        500,
        10000,
        500,
        DEFAULT_EDITOR_SETTINGS.autoSaveDelayMs,
      ),
      wordWrap:
        typeof record.wordWrap === 'boolean' ? record.wordWrap : DEFAULT_EDITOR_SETTINGS.wordWrap,
      fontSize: boundedNumber(record.fontSize, 10, 24, 1, DEFAULT_EDITOR_SETTINGS.fontSize),
    }
  } catch {
    return { ...DEFAULT_EDITOR_SETTINGS }
  }
}

export function readEditorSettings(): EditorSettings {
  if (typeof window === 'undefined') return DEFAULT_EDITOR_SETTINGS
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (raw === cachedRaw) return cachedSettings
  cachedRaw = raw
  cachedSettings = parseSettings(raw)
  return cachedSettings
}

function notify() {
  for (const listener of listeners) listener()
}

function onStorage(event: StorageEvent) {
  if (event.key === STORAGE_KEY || event.key === null) notify()
}

export function subscribeEditorSettings(listener: () => void) {
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

export function writeEditorSettings(partial: Partial<EditorSettings>): EditorSettings {
  const next = { ...readEditorSettings(), ...partial }
  if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  notify()
  return next
}

export function useEditorSettings(): EditorSettings {
  return useSyncExternalStore(subscribeEditorSettings, readEditorSettings, () => DEFAULT_EDITOR_SETTINGS)
}
