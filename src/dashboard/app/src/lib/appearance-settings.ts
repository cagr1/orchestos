import { useSyncExternalStore } from 'react'

export const UI_SCALES = [0.8, 0.9, 1, 1.1, 1.25, 1.5] as const
export type AppearanceSettings = {
  uiScale: number
  showGitIgnored: boolean
  diffPalette: 'default' | 'colorblind'
}
export const DEFAULT_APPEARANCE_SETTINGS: AppearanceSettings = {
  uiScale: 1,
  showGitIgnored: true,
  diffPalette: 'default',
}
const STORAGE_KEY = 'orchestos-appearance'
const listeners = new Set<() => void>()
let storageListening = false
let cachedRaw: string | null | undefined
let cachedSettings = DEFAULT_APPEARANCE_SETTINGS

export function normalizeAppearanceSettings(value: unknown): AppearanceSettings {
  const record =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {}
  const scale = record.uiScale
  return {
    uiScale:
      typeof scale === 'number' && Number.isFinite(scale)
        ? UI_SCALES.reduce(
            (nearest, step) =>
              Math.abs(step - scale) < Math.abs(nearest - scale) ? step : nearest,
            1 as number,
          )
        : 1,
    showGitIgnored: typeof record.showGitIgnored === 'boolean' ? record.showGitIgnored : true,
    diffPalette: record.diffPalette === 'colorblind' ? 'colorblind' : 'default',
  }
}
export function parseAppearanceSettings(raw: string | null): AppearanceSettings {
  try {
    return normalizeAppearanceSettings(JSON.parse(raw ?? 'null'))
  } catch {
    return { ...DEFAULT_APPEARANCE_SETTINGS }
  }
}
export function stepScale(current: number, direction: 1 | -1): number {
  const normalized = normalizeAppearanceSettings({ uiScale: current }).uiScale
  const index = UI_SCALES.findIndex((scale) => scale === normalized)
  return UI_SCALES[Math.max(0, Math.min(UI_SCALES.length - 1, index + direction))]
}
export function resetScale(): number {
  return 1
}
export function readAppearanceSettings(): AppearanceSettings {
  if (typeof window === 'undefined') return DEFAULT_APPEARANCE_SETTINGS
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (raw === cachedRaw) return cachedSettings
  cachedRaw = raw
  cachedSettings = parseAppearanceSettings(raw)
  return cachedSettings
}

function notify() {
  for (const listener of listeners) listener()
}

function onStorage(event: StorageEvent) {
  if (event.key === STORAGE_KEY || event.key === null) notify()
}

export function subscribeAppearanceSettings(listener: () => void) {
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

export function writeAppearanceSettings(partial: Partial<AppearanceSettings>): AppearanceSettings {
  const next = normalizeAppearanceSettings({ ...readAppearanceSettings(), ...partial })
  if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  notify()
  return next
}

export function useAppearanceSettings(): AppearanceSettings {
  return useSyncExternalStore(
    subscribeAppearanceSettings,
    readAppearanceSettings,
    () => DEFAULT_APPEARANCE_SETTINGS,
  )
}
