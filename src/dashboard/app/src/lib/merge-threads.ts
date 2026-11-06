import type { ChatThread } from '../types/orchestos'

/**
 * Una lectura de sesiones puede resolver después de que el usuario creó o eligió un hilo
 * (Dev → Chat → New chat). Lo cargado no pisa lo creado mientras tanto: los hilos locales
 * ausentes de la lectura y del mismo proyecto se conservan y el hilo local con mensajes pendientes gana.
 * También gana el local que ya tiene mensajes que la lectura no trae (la lectura empezó antes del envío
 * y resuelve después del turno: pisarlo borraría el mensaje enviado y sus adjuntos).
 */
export function mergeLoadedThreads(
  current: ChatThread[],
  loaded: ChatThread[],
  projectId: string | null,
): ChatThread[] {
  const loadedIds = new Set(loaded.map((thread) => thread.id))
  const currentById = new Map(current.map((thread) => [thread.id, thread]))
  const localOnly = current.filter(
    (thread) => !loadedIds.has(thread.id) && (thread.projectId ?? null) === projectId,
  )
  const merged = loaded.map((thread) => {
    const local = currentById.get(thread.id)
    if (!local) return thread
    const loadedMessageIds = new Set(thread.messages.map((message) => message.id))
    const newerLocally = local.messages.some(
      (message) => message.id.startsWith('pending_') || !loadedMessageIds.has(message.id),
    )
    return newerLocally ? local : thread
  })
  return [...localOnly, ...merged]
}

/** Conserva el hilo activo si sigue existiendo; si no, el primero de la lectura. */
export function activeAfterLoad(
  currentId: string,
  merged: ChatThread[],
  loaded: ChatThread[],
): string {
  return currentId && merged.some((thread) => thread.id === currentId)
    ? currentId
    : loaded[0]?.id || ''
}

/** Sin hilo activo pero con un New chat en vuelo, el mensaje espera ese hilo y no abre uno general. */
export async function threadPendingForSend(
  activeId: string,
  pending: Promise<ChatThread | null> | null,
): Promise<ChatThread | null> {
  return activeId || !pending ? null : pending
}
