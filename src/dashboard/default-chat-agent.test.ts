import { describe, expect, test } from 'bun:test'
import {
  aiSessionSetupCheck,
  type DefaultChatAgentDeps,
  NO_AI_CHAT_MESSAGE,
  readDefaultChatAgent,
  resolveChatErrorMessage,
  resolveDefaultChatAgent,
} from './default-chat-agent.ts'
import { handleApiChatDefaultAgent } from './handlers/chat.ts'

const cli = (id: string, functional = true) => ({ id, installed: true, chat: true, functional })
const deps: DefaultChatAgentDeps = {
  detect: () => [cli('claude'), cli('codex')],
  health: async () => [cli('claude', false), cli('codex')],
  chat: () => true,
  key: () => undefined,
}

describe('default chat agent', () => {
  test('config wins without probing the host', async () => {
    expect(
      resolveDefaultChatAgent({
        configAgent: 'api',
        clis: [cli('codex')],
        hasOpenRouterKey: false,
      }),
    ).toBe('api')
    expect(
      await readDefaultChatAgent('api', {
        detect: () => {
          throw new Error('must not probe')
        },
      }),
    ).toBe('api')
  })
  test('takes the first installed, functional chat CLI in registry order', () => {
    expect(
      resolveDefaultChatAgent({ clis: [cli('opencode'), cli('claude')], hasOpenRouterKey: true }),
    ).toBe('opencode')
    expect(
      resolveDefaultChatAgent({
        clis: [
          { ...cli('a'), installed: false },
          { ...cli('b'), chat: false },
          cli('c', false),
          cli('codex'),
        ],
        hasOpenRouterKey: false,
      }),
    ).toBe('codex')
  })
  test('falls back to API only with a key, otherwise null', () => {
    expect(resolveDefaultChatAgent({ clis: [], hasOpenRouterKey: true })).toBe('api')
    expect(
      resolveDefaultChatAgent({ clis: [cli('claude', false)], hasOpenRouterKey: false }),
    ).toBeNull()
  })
  test('real wrapper joins injected detection, chat capability and health', async () => {
    expect(await readDefaultChatAgent(undefined, deps)).toBe('codex')
    expect(await readDefaultChatAgent(undefined, { ...deps, chat: () => false })).toBeNull()
    expect(
      await readDefaultChatAgent(undefined, { ...deps, chat: () => false, key: () => 'present' }),
    ).toBe('api')
  })
  test('default-agent endpoint exposes the resolver result including null', async () => {
    expect(await (await handleApiChatDefaultAgent(deps)).json()).toEqual({ agent: 'codex' })
    expect(await (await handleApiChatDefaultAgent({ ...deps, detect: () => [] })).json()).toEqual({
      agent: null,
    })
  })
  test('setup requires one usable CLI or an OpenRouter key', async () => {
    const check = aiSessionSetupCheck(
      await readDefaultChatAgent(undefined, deps),
      '/home/.orchestos/.env',
    )
    expect(check).toEqual({ label: 'CLI de IA con sesión: codex', ok: true })
    const missing = aiSessionSetupCheck(null, '/home/.orchestos/.env')
    expect([missing].filter((item) => !item.ok)).toHaveLength(1)
    expect(missing.label).toBe('Ninguna CLI de IA con sesión')
    expect(missing.hint).toBe(
      'Instala e inicia sesión en Claude Code, Codex u OpenCode, o añade OPENROUTER_API_KEY en /home/.orchestos/.env',
    )
    expect(aiSessionSetupCheck('api', '/env').ok).toBe(true)
  })
})

test('missing-key error explains both setup options only without a usable CLI', async () => {
  const message = 'OPENROUTER_API_KEY not found.\nSet it in ~/.orchestos/.env:'
  expect(await resolveChatErrorMessage(message, { ...deps, detect: () => [] })).toBe(
    NO_AI_CHAT_MESSAGE,
  )
  expect(await resolveChatErrorMessage(message, deps)).toBe(message)
  expect(
    await resolveChatErrorMessage('offline', {
      detect: () => {
        throw new Error('must not probe')
      },
    }),
  ).toBe('offline')
})
