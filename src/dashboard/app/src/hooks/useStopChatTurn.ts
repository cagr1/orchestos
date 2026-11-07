import { useEffect, useRef, useState } from 'react'
import { stopChatTurn } from '../api/chat'

let activeStop: (() => Promise<void>) | undefined

/** Only the mounted Chat/Dev view registers a running turn. */
export function stopActiveChatTurn(): boolean {
  if (!activeStop) return false
  void activeStop()
  return true
}

/** Stop failures are deliberately silent: the running response remains usable. */
export function useStopChatTurn(
  sessionId: string | undefined,
  turnId: string | undefined,
  busy: boolean,
  projectId: string | null,
) {
  const [stoppingTurn, setStoppingTurn] = useState<string | null>(null)
  const requested = useRef<string | null>(null)
  const key = sessionId && turnId ? `${sessionId}/${turnId}` : null
  const onStop =
    busy && sessionId && turnId && key
      ? async () => {
          if (requested.current === key) return
          requested.current = key
          setStoppingTurn(key)
          try {
            await stopChatTurn(sessionId, turnId, projectId)
          } catch {
            if (requested.current === key) requested.current = null
            setStoppingTurn((current) => (current === key ? null : current))
          }
        }
      : undefined
  useEffect(() => {
    activeStop = onStop
    return () => {
      if (activeStop === onStop) activeStop = undefined
    }
  }, [onStop])
  return { onStop, stopping: busy && key !== null && stoppingTurn === key }
}
