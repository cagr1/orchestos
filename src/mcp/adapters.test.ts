import { expect, test } from 'bun:test'
import {
  claudeMcpArgs,
  codexMcpThreadConfig,
  MESSAGE_SESSION_STEP_LABEL,
  mcpOfferKey,
  messageSessionApiTool,
  messageSessionProposalFromStep,
  orchestosMcpServerCommand,
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

test('Preview directory reaches MCP commands, adapters and offer identity', () => {
  const offer = {
    root: '/project',
    tools: ['preview_screenshot'],
    previewDir: '/home/previews/project',
  }
  const command = orchestosMcpServerCommand(offer)
  expect(command.args.slice(-2)).toEqual(['--preview-dir', offer.previewDir])
  const claude = claudeMcpArgs(offer)
  expect(JSON.parse(claude[1] ?? '{}').mcpServers.orchestos.args).toEqual(command.args)
  expect(claude).toContain('mcp__orchestos__preview_screenshot')
  expect(codexMcpThreadConfig(offer)).toMatchObject({
    mcp_servers: { orchestos: { args: command.args, default_tools_approval_mode: 'approve' } },
  })
  expect(mcpOfferKey(offer)).not.toBe(mcpOfferKey({ ...offer, previewDir: '/other' }))
  expect(mcpOfferKey(offer)).not.toBe(mcpOfferKey({ ...offer, previewDir: undefined }))
})
