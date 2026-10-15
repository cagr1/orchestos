import type { ChatMessage } from '../../types/orchestos'

/**
 * Tras recargar los mensajes del servidor (que no traen adjuntos), devuelve los adjuntos del mensaje
 * optimista al último mensaje `user` del servidor con el mismo contenido que aún no tenga adjuntos.
 * Aplicar las entradas de la más nueva a la más vieja.
 */
export function mergeOptimisticAttachments(
  serverMessages: ChatMessage[],
  optimistic: Pick<ChatMessage, 'content' | 'attachments'>,
): ChatMessage[] {
  if (!optimistic.attachments?.length) return serverMessages
  let target = -1
  for (let index = serverMessages.length - 1; index >= 0; index--) {
    const message = serverMessages[index]
    if (
      message.role === 'user' &&
      message.content === optimistic.content &&
      !message.attachments?.length
    ) {
      target = index
      break
    }
  }
  if (target < 0) return serverMessages
  return serverMessages.map((message, index) =>
    index === target ? { ...message, attachments: optimistic.attachments } : message,
  )
}
