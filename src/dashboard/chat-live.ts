export const TASK_MARKER = '[[orchestos:task]]'

export function stripTaskMarker(text: string): string {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim() !== TASK_MARKER)
    .join('\n')
    .trimEnd()
}

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
  // Deltas llegan crudos (con marcador); el paso `text` llega ya limpio: comparar ambos limpios.
  const accumulated = current?.turnId === turnId ? stripTaskMarker(current.text) : ''
  if (accumulated && text.startsWith(accumulated)) liveText.set(sessionId, { turnId, text })
  else if (accumulated && accumulated.startsWith(text)) return
  else liveText.set(sessionId, { turnId, text: accumulated ? `${accumulated}\n\n${text}` : text })
}

export function getLiveText(sessionId: string): LiveTurn | null {
  const live = liveText.get(sessionId)
  if (!live) return null
  const text = stripTaskMarker(live.text)
    .replace(/\[\[[^\]\n]*$/, '')
    .trimEnd()
  return { turnId: live.turnId, text }
}

export function clearLiveText(sessionId: string, turnId: string): void {
  if (liveText.get(sessionId)?.turnId === turnId) liveText.delete(sessionId)
}
