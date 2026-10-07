export const TASK_MARKER = '[[orchestos:task]]'

export function hasTaskMarker(text: string): boolean {
  return (
    text.split(/\r?\n/).some((line) => line.trim() === TASK_MARKER) ||
    text.trimEnd().endsWith(TASK_MARKER)
  )
}

export function stripTaskMarker(text: string): string {
  const withoutMarkerLines = text
    .split(/\r?\n/)
    .filter((line) => line.trim() !== TASK_MARKER)
    .join('\n')
  const trimmed = withoutMarkerLines.trimEnd()
  return trimmed.endsWith(TASK_MARKER)
    ? trimmed
        .slice(0, -TASK_MARKER.length)
        .replace(/[ \t]+$/, '')
        .trimEnd()
    : trimmed
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
    .replace(/\[\[orchestos:task\]?$/, '')
    .trimEnd()
  return { turnId: live.turnId, text }
}

export function clearLiveText(sessionId: string, turnId: string): void {
  if (liveText.get(sessionId)?.turnId === turnId) liveText.delete(sessionId)
}
