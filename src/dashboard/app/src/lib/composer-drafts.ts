const drafts = new Map<string, string>()
const listeners = new Set<() => void>()
const storageKey = (threadId: string) => `orchestos:composer-draft:${threadId}`

export function readComposerDraft(threadId: string): string {
  const cached = drafts.get(threadId)
  if (cached !== undefined) return cached
  try {
    const saved = sessionStorage.getItem(storageKey(threadId)) ?? ''
    if (saved) drafts.set(threadId, saved)
    return saved
  } catch {
    return ''
  }
}

export function writeComposerDraft(threadId: string, text: string): void {
  if (text) drafts.set(threadId, text)
  else drafts.delete(threadId)
  try {
    if (text) sessionStorage.setItem(storageKey(threadId), text)
    else sessionStorage.removeItem(storageKey(threadId))
  } catch {
    /* Storage may be unavailable. */
  }
  for (const listener of listeners) listener()
}

export function subscribeComposerDrafts(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Hands a draft to a just-created session (Dev "new" tab → launched agent) unless it already has one. */
export function moveComposerDraft(from: string, to: string): void {
  const text = readComposerDraft(from)
  if (!text || readComposerDraft(to)) return
  writeComposerDraft(to, text)
  writeComposerDraft(from, '')
}
