// UI.24.7 — decide qué mensajes animan su entrada. Un mensaje anima una sola vez, cuando
// aparece en un hilo ya abierto. El registro vive en el módulo (no en el componente) para
// sobrevivir a los re-montajes de OrchestChatView. La identidad es rol + contenido por
// ocurrencia: la copia del servidor que reemplaza al optimista no cuenta como nueva.

export type EntranceMode = 'animate' | 'static'

interface EntranceMessage {
  id: string
  role: string
  content: string
}

interface SessionEntrance {
  baselined: boolean
  seen: Map<string, number>
  sendPending: boolean
  streamed: boolean
}

const sessions = new Map<string, SessionEntrance>()

function session(sessionId: string): SessionEntrance {
  let entry = sessions.get(sessionId)
  if (!entry) {
    entry = { baselined: false, seen: new Map(), sendPending: false, streamed: false }
    sessions.set(sessionId, entry)
  }
  return entry
}

function occurrences(messages: EntranceMessage[]): { id: string; key: string; nth: number }[] {
  const counts = new Map<string, number>()
  return messages.map((message) => {
    const key = `${message.role}\u0000${message.content}`
    const nth = (counts.get(key) ?? 0) + 1
    counts.set(key, nth)
    return { id: message.id, key, nth }
  })
}

/** La vista entra en la sesión: la primera lista cargada cuenta como historial, aunque ya se hubiera visto antes. */
export function enterSession(sessionId: string): void {
  session(sessionId).baselined = false
}

/** El usuario acaba de enviar desde este hilo: el primer mensaje que llegue es nuevo, no historial. */
export function noteLocalSend(sessionId: string): void {
  session(sessionId).sendPending = true
}

/** Hubo respuesta en streaming: el mensaje final que la sustituye no vuelve a animar. */
export function noteStreamed(sessionId: string): void {
  session(sessionId).streamed = true
}

export function hasStreamed(sessionId: string): boolean {
  return session(sessionId).streamed
}

/** Modo de entrada por id. Idempotente: no muta el registro (eso lo hace `markEntered`). */
export function entranceModes(
  sessionId: string,
  messages: EntranceMessage[],
): Map<string, EntranceMode> {
  const entry = session(sessionId)
  const modes = new Map<string, EntranceMode>()
  const items = occurrences(messages)
  const asHistory = !entry.baselined && !entry.sendPending
  let streamedAvailable = entry.streamed
  for (const message of messages.map((m, i) => ({ ...m, ...items[i] }))) {
    const known = (entry.seen.get(message.key) ?? 0) >= message.nth
    if (known || asHistory) {
      modes.set(message.id, 'static')
    } else if (message.role === 'assistant' && streamedAvailable) {
      streamedAvailable = false
      modes.set(message.id, 'static')
    } else {
      modes.set(message.id, 'animate')
    }
  }
  return modes
}

/**
 * Tras el commit: lo renderizado pasa a "ya visto". `loaded=false` = los mensajes aún se leen
 * (no es un hilo vacío); `loaded=true` con lista vacía deja la línea base puesta.
 */
export function markEntered(sessionId: string, messages: EntranceMessage[], loaded = true): void {
  const entry = session(sessionId)
  if (!loaded) return
  if (messages.length > 0) {
    // Refleja la última lista no vacía, no un máximo: un optimista retirado no cuenta.
    entry.seen = new Map()
    for (const { key, nth } of occurrences(messages)) entry.seen.set(key, nth)
  }
  entry.baselined = true
  entry.sendPending = false
  if (messages.at(-1)?.role === 'assistant') entry.streamed = false
}

export function resetEntrances(): void {
  sessions.clear()
}
