import { expect, test } from 'bun:test'
import {
  MESSAGE_SESSION_STEP_LABEL,
  messageSessionApiTool,
  messageSessionProposalFromStep,
} from './adapters.ts'
import { MESSAGE_SESSION_RESPONSE } from './server.ts'

test('MSG.1 recognizes message_session steps and API calls with the same parser', async () => {
  const input = { session_id: 'target', content: 'review' }
  const step = {
    type: 'tool_use' as const,
    label: MESSAGE_SESSION_STEP_LABEL,
    detail: JSON.stringify(input),
  }
  expect(messageSessionProposalFromStep(step)).toEqual({ ok: true, ...input })
  expect(messageSessionProposalFromStep({ ...step, detail: '{' })).toMatchObject({ ok: false })
  expect(messageSessionProposalFromStep({ ...step, label: 'other' })).toBeNull()
  expect(messageSessionProposalFromStep({ ...step, type: 'text' })).toBeNull()
  const proposals: unknown[] = []
  const api = messageSessionApiTool((proposal) => proposals.push(proposal))
  expect(api.tool.name).toBe('message_session')
  expect(await api.execute('message_session', input)).toBe(MESSAGE_SESSION_RESPONSE)
  expect(await api.execute('message_session', {})).toStartWith('[Error:')
  expect(proposals).toEqual([{ ok: true, ...input }, expect.objectContaining({ ok: false })])
})
