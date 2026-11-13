interface ActiveChatTurn {
  turnId: string
  controller: AbortController
  stopping: boolean
}

const activeTurns = new Map<string, ActiveChatTurn>()

export function registerChatTurn(sessionId: string, turnId: string): AbortSignal {
  if (activeTurns.has(sessionId)) throw new Error('Chat session already registered')
  const controller = new AbortController()
  activeTurns.set(sessionId, { turnId, controller, stopping: false })
  return controller.signal
}

export function stopChatTurn(sessionId: string, turnId: string): boolean {
  const turn = activeTurns.get(sessionId)
  if (!turn || turn.turnId !== turnId) return false
  turn.stopping = true
  turn.controller.abort()
  return true
}

/** SES.1 — detiene el turno vivo de la sesión, sea cual sea su id (archivar nunca deja un CLI corriendo). */
export function stopActiveChatTurn(sessionId: string): boolean {
  const turn = activeTurns.get(sessionId)
  return turn ? stopChatTurn(sessionId, turn.turnId) : false
}

export function unregisterChatTurn(sessionId: string, turnId: string): void {
  if (activeTurns.get(sessionId)?.turnId === turnId) activeTurns.delete(sessionId)
}

/** Waits for work without abort support (context loading/OCR), without retaining an abort listener. */
export function waitForChatWork<T>(work: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return work
  return new Promise((resolve, reject) => {
    const abort = () => {
      signal.removeEventListener('abort', abort)
      reject(signal.reason)
    }
    signal.addEventListener('abort', abort, { once: true })
    if (signal.aborted) abort()
    work.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort))
  })
}
