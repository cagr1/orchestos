import { useSyncExternalStore } from 'react'

export type ChatSettings = {
  sendKey: 'enter' | 'mod-enter'
  whileRunning: 'queue' | 'stop-and-send'
  closeRunningTab: 'ask' | 'stop' | 'keep'
  confirmDelete: boolean
  confirmArchive: boolean
}

export const DEFAULT_CHAT_SETTINGS: ChatSettings = {
  sendKey: 'enter',
  whileRunning: 'queue',
  closeRunningTab: 'ask',
  confirmDelete: true,
  confirmArchive: true,
}

const STORAGE_KEY = 'orchestos-chat'
const listeners = new Set<() => void>()
let storageListening = false
let cachedRaw: string | null | undefined
let cachedSettings: ChatSettings = { ...DEFAULT_CHAT_SETTINGS }

function parseSettings(raw: string | null): ChatSettings {
  if (!raw) return { ...DEFAULT_CHAT_SETTINGS }
  try {
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object' || Array.isArray(value))
      return { ...DEFAULT_CHAT_SETTINGS }
    const record = value as Record<string, unknown>
    return {
      sendKey: record.sendKey === 'mod-enter' ? 'mod-enter' : 'enter',
      whileRunning: record.whileRunning === 'stop-and-send' ? 'stop-and-send' : 'queue',
      closeRunningTab:
        record.closeRunningTab === 'stop' || record.closeRunningTab === 'keep'
          ? record.closeRunningTab
          : 'ask',
      confirmDelete: typeof record.confirmDelete === 'boolean' ? record.confirmDelete : true,
      confirmArchive: typeof record.confirmArchive === 'boolean' ? record.confirmArchive : true,
    }
  } catch {
    return { ...DEFAULT_CHAT_SETTINGS }
  }
}

export function readChatSettings(): ChatSettings {
  if (typeof window === 'undefined') return DEFAULT_CHAT_SETTINGS
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

export function subscribeChatSettings(listener: () => void) {
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

export function writeChatSettings(partial: Partial<ChatSettings>): ChatSettings {
  const next = { ...readChatSettings(), ...partial }
  if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  notify()
  return next
}

export function useChatSettings(): ChatSettings {
  return useSyncExternalStore(subscribeChatSettings, readChatSettings, () => DEFAULT_CHAT_SETTINGS)
}

export function isMacPlatform() {
  return typeof navigator !== 'undefined' && /Mac/.test(navigator.platform)
}

export function sendIntent(
  event: {
    key: string
    shiftKey: boolean
    metaKey: boolean
    ctrlKey: boolean
    isComposing?: boolean
  },
  sendKey: ChatSettings['sendKey'],
  mac: boolean,
): 'send' | 'newline' | 'none' {
  if (event.key !== 'Enter' || event.isComposing) return 'none'
  if (event.shiftKey) return 'newline'
  return sendKey === 'enter' || (mac ? event.metaKey : event.ctrlKey) ? 'send' : 'newline'
}
