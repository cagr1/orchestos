import { describe, it, expect, afterEach } from 'bun:test'
import * as anthropic from '../providers/anthropic.ts'
import * as openai from '../providers/openai.ts'

// F0.9 — verifica en el nivel de unidad lo que un run real contra Anthropic/OpenAI
// directo no puede verificarse acá por falta de API key (ver PLAN.md F0.9): que
// max_tokens en el body HTTP real es el valor calculado por harness.ts
// (contextWindow - promptTokens - SAFETY_MARGIN, típicamente >> 8192), no el
// 8192 hardcoded que causaba el truncamiento. Cada chat() hace UNA sola llamada
// fetch (sin preámbulo async largo antes), así que stubear globalThis.fetch acá
// es seguro contra la suite completa — mismo patrón que chat-effort.test.ts BACK.4.
describe('providers/anthropic.ts — max_tokens wiring (F0.6/F0.9)', () => {
  const originalFetch = globalThis.fetch
  const prevKey = process.env.ANTHROPIC_API_KEY

  afterEach(() => {
    globalThis.fetch = originalFetch
    if (prevKey === undefined) delete process.env.ANTHROPIC_API_KEY
    else process.env.ANTHROPIC_API_KEY = prevKey
  })

  it('sends the harness-calculated maxTokens, not the 8192 default', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key'
    let capturedBody: any
    globalThis.fetch = (async (_url: string, init: RequestInit) => {
      capturedBody = JSON.parse(init.body as string)
      return new Response(JSON.stringify({
        content: [{ type: 'text', text: 'ok' }],
        usage: { input_tokens: 10, output_tokens: 5 },
        model: 'claude-haiku-4-5',
      }), { status: 200 })
    }) as unknown as typeof fetch

    await anthropic.chat({
      model: 'anthropic/claude-haiku-4-5',
      system: 'sys',
      messages: [{ role: 'user', content: 'hi' }],
      maxTokens: 187_000, // valor grande — imposible de confundir con el 8192 hardcoded viejo
    })

    expect(capturedBody.max_tokens).toBe(187_000)
    expect(capturedBody.max_tokens).not.toBe(8192)
  })

  it('falls back to 8192 only when maxTokens is not passed at all (direct/manual call, not via harness)', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key'
    let capturedBody: any
    globalThis.fetch = (async (_url: string, init: RequestInit) => {
      capturedBody = JSON.parse(init.body as string)
      return new Response(JSON.stringify({
        content: [{ type: 'text', text: 'ok' }],
        usage: { input_tokens: 10, output_tokens: 5 },
        model: 'claude-haiku-4-5',
      }), { status: 200 })
    }) as unknown as typeof fetch

    await anthropic.chat({ model: 'anthropic/claude-haiku-4-5', system: 'sys', messages: [{ role: 'user', content: 'hi' }] })

    expect(capturedBody.max_tokens).toBe(8192)
  })
})

describe('providers/openai.ts — max_tokens wiring (F0.6/F0.9)', () => {
  const originalFetch = globalThis.fetch
  const prevKey = process.env.OPENAI_API_KEY

  afterEach(() => {
    globalThis.fetch = originalFetch
    if (prevKey === undefined) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY = prevKey
  })

  it('sends the harness-calculated maxTokens, not the 8192 default', async () => {
    process.env.OPENAI_API_KEY = 'sk-oai-test-key'
    let capturedBody: any
    globalThis.fetch = (async (_url: string, init: RequestInit) => {
      capturedBody = JSON.parse(init.body as string)
      return new Response(JSON.stringify({
        choices: [{ message: { content: 'ok' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
        model: 'gpt-4o-mini',
      }), { status: 200 })
    }) as unknown as typeof fetch

    await openai.chat({
      model: 'openai/gpt-4o-mini',
      system: 'sys',
      messages: [{ role: 'user', content: 'hi' }],
      maxTokens: 112_000,
    })

    expect(capturedBody.max_tokens).toBe(112_000)
    expect(capturedBody.max_tokens).not.toBe(8192)
  })
})
