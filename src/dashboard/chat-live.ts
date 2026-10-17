type LiveTurn = { turnId: string; text: string }
const liveText = new Map<string, LiveTurn>()

export function appendLiveText(sessionId: string, turnId: string, delta: string): void {
  const current = liveText.get(sessionId)
  liveText.set(sessionId, {
    turnId,
    text: (current?.turnId === turnId ? current.text : '') + delta,
  })
}

export function replaceLiveText(sessionId: string, turnId: string, text: string): void {
  const current = liveText.get(sessionId)
  const accumulated = current?.turnId === turnId ? current.text.trimEnd() : ''
  if (accumulated && text.startsWith(accumulated)) liveText.set(sessionId, { turnId, text })
  else if (accumulated && accumulated.startsWith(text)) return
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
