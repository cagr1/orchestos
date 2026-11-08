import { useSyncExternalStore } from 'react'

export type DiffSettings = {
  view: 'unified' | 'split'
  ignoreWhitespace: boolean
  changesLayout: 'list' | 'tree'
  foldersExpanded: boolean
}
export const DEFAULT_DIFF_SETTINGS: DiffSettings = {
  view: 'unified',
  ignoreWhitespace: false,
  changesLayout: 'list',
  foldersExpanded: true,
}
const STORAGE_KEY = 'orchestos-diff'
const listeners = new Set<() => void>()
let storageListening = false
let cachedRaw: string | null | undefined
let cachedSettings = DEFAULT_DIFF_SETTINGS

export function normalizeDiffSettings(value: unknown): DiffSettings {
  const record =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {}
  return {
    view: record.view === 'split' ? 'split' : 'unified',
    ignoreWhitespace:
      typeof record.ignoreWhitespace === 'boolean' ? record.ignoreWhitespace : false,
    changesLayout: record.changesLayout === 'tree' ? 'tree' : 'list',
    foldersExpanded: typeof record.foldersExpanded === 'boolean' ? record.foldersExpanded : true,
  }
}

export function parseDiffSettings(raw: string | null): DiffSettings {
  try {
    return normalizeDiffSettings(JSON.parse(raw ?? 'null'))
  } catch {
    return { ...DEFAULT_DIFF_SETTINGS }
  }
}
export function readDiffSettings(): DiffSettings {
  if (typeof window === 'undefined') return DEFAULT_DIFF_SETTINGS
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (raw === cachedRaw) return cachedSettings
  cachedRaw = raw
  cachedSettings = parseDiffSettings(raw)
  return cachedSettings
}

function notify() {
  for (const listener of listeners) listener()
}

function onStorage(event: StorageEvent) {
  if (event.key === STORAGE_KEY || event.key === null) notify()
}

export function subscribeDiffSettings(listener: () => void) {
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

export function writeDiffSettings(partial: Partial<DiffSettings>): DiffSettings {
  const next = normalizeDiffSettings({ ...readDiffSettings(), ...partial })
  if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  notify()
  return next
}

export function useDiffSettings(): DiffSettings {
  return useSyncExternalStore(subscribeDiffSettings, readDiffSettings, () => DEFAULT_DIFF_SETTINGS)
}
