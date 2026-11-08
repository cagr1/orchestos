import type { ApprovalMode, ChatAttachment } from '../types/orchestos'

export type QueuedMessage = {
  failed?: boolean
  id: string
  content: string
  attachments: ChatAttachment[]
  cli: string
  model: string
  effort?: string
  isShellCmd: boolean
  approvalMode?: ApprovalMode
}
const queues = new Map<string, QueuedMessage[]>()
const listeners = new Set<() => void>()
const empty: QueuedMessage[] = []
export const readChatQueue = (threadId: string) => queues.get(threadId) ?? empty
export function subscribeChatQueue(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
export function writeChatQueue(threadId: string, messages: QueuedMessage[]) {
  if (messages.length) queues.set(threadId, messages)
  else queues.delete(threadId)
  for (const listener of listeners) listener()
}
export function discardChatQueue(threadId: string) {
  deleted.add(threadId)
  writeChatQueue(threadId, [])
}

const sending = new Set<string>()
const deleted = new Set<string>()
export const chatQueueSending = (threadId: string) => sending.has(threadId)
export const chatQueueDeleted = (threadId: string) => deleted.has(threadId)
export function lockChatQueue(threadId: string) {
  sending.add(threadId)
}
export function unlockChatQueue(threadId: string) {
  sending.delete(threadId)
}
