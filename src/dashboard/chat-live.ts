type LiveTurn = { turnId: string; text: string; messageStart?: number }
const liveText = new Map<string, LiveTurn>()

export function appendLiveText(sessionId: string, turnId: string, delta: string): void {
  const stored = liveText.get(sessionId)
  const current = stored?.turnId === turnId ? stored : undefined
  const text = current?.text ?? ''
  const messageStart = current?.messageStart ?? text.length
  const separator =
    text && current?.messageStart === undefined && !delta.startsWith('\n\n') ? '\n\n' : ''
  liveText.set(sessionId, {
    turnId,
    text: text + separator + delta,
    messageStart,
  })
}

export function replaceLiveText(sessionId: string, turnId: string, text: string): void {
  const current = liveText.get(sessionId)
  // A text step completes one message, not the whole turn. Reconcile against
  // that message's deltas so earlier messages around tool calls stay intact.
  if (current?.turnId === turnId && current.messageStart !== undefined) {
    const prefix = current.text.slice(0, current.messageStart).trimEnd()
    liveText.set(sessionId, { turnId, text: prefix ? `${prefix}\n\n${text}` : text })
    return
  }
  const accumulated = current?.turnId === turnId ? current.text.trimEnd() : ''
  if (accumulated && text.startsWith(accumulated)) liveText.set(sessionId, { turnId, text })
  else if (accumulated?.startsWith(text)) return
  else liveText.set(sessionId, { turnId, text: accumulated ? `${accumulated}\n\n${text}` : text })
}

export function getLiveText(sessionId: string): LiveTurn | null {
  const live = liveText.get(sessionId)
  if (!live) return null
  return { turnId: live.turnId, text: live.text.trimEnd() }
}

export function clearLiveText(sessionId: string, turnId: string): void {
  if (liveText.get(sessionId)?.turnId === turnId) liveText.delete(sessionId)
}
