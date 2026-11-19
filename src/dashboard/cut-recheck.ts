import {
  appendCutReport,
  getChatSession,
  getClaudeChatSession,
  listChatMessages,
} from '../db/chat-sessions.ts'
import { cutCheck } from './cut-check.ts'

export function recheckCutAfterTask(sessionId: string, root: string): void {
  try {
    const messages = listChatMessages(sessionId)
    const lastUser = messages.findLastIndex((message) => message.role === 'user')
    if (lastUser < 0 || messages[lastUser]?.content.trim() !== '/cut') return
    const previous = messages
      .slice(lastUser + 1)
      .findLast((message) => message.cutReport)?.cutReport
    if (!previous) return
    const cliSessionId =
      getChatSession(sessionId)?.agent === 'claude'
        ? getClaudeChatSession(sessionId).sessionId
        : undefined
    const report = cutCheck(root, cliSessionId, { baseHead: previous.baseHead ?? null, reply: '' })
    if (report.handoff === null) report.handoff = previous.handoff
    appendCutReport(sessionId, report)
  } catch (error) {
    console.warn('[cut] could not recheck after task', error)
  }
}
