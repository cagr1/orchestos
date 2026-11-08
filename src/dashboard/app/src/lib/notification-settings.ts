import { useSyncExternalStore } from 'react'

export type NotificationSettings = {
  turnFinished: boolean
  needsInput: boolean
  sound: boolean
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  turnFinished: true,
  needsInput: true,
  sound: true,
}

const STORAGE_KEY = 'orchestos-notifications'
const listeners = new Set<() => void>()
let storageListening = false
let cachedRaw: string | null | undefined
let cachedSettings: NotificationSettings = { ...DEFAULT_NOTIFICATION_SETTINGS }

function parseSettings(raw: string | null): NotificationSettings {
  if (!raw) return { ...DEFAULT_NOTIFICATION_SETTINGS }
  try {
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object' || Array.isArray(value))
      return { ...DEFAULT_NOTIFICATION_SETTINGS }
    const record = value as Record<string, unknown>
    return {
      turnFinished: typeof record.turnFinished === 'boolean' ? record.turnFinished : true,
      needsInput: typeof record.needsInput === 'boolean' ? record.needsInput : true,
      sound: typeof record.sound === 'boolean' ? record.sound : true,
    }
  } catch {
    return { ...DEFAULT_NOTIFICATION_SETTINGS }
  }
}

export function readNotificationSettings(): NotificationSettings {
  if (typeof window === 'undefined') return DEFAULT_NOTIFICATION_SETTINGS
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

export function subscribeNotificationSettings(listener: () => void) {
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

export function writeNotificationSettings(
  partial: Partial<NotificationSettings>,
): NotificationSettings {
  const next = { ...readNotificationSettings(), ...partial }
  if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  notify()
  return next
}

export function useNotificationSettings(): NotificationSettings {
  return useSyncExternalStore(
    subscribeNotificationSettings,
    readNotificationSettings,
    () => DEFAULT_NOTIFICATION_SETTINGS,
  )
}
