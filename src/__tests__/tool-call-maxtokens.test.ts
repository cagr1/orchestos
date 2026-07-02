import { describe, it, expect, afterEach } from 'bun:test'
import { runToolLoop, callWithTools, FETCH_URL_TOOL } from '../providers/tool-call.ts'

// Fix del bug real de G.5 (2026-07-02): las rondas de tool-calling y el
// dispatcher single-turn tenían max_tokens=4096 hardcodeado, sin forma de
// pasar el presupuesto real derivado de contextWindowFor(model). Un
// write_file con contenido grande se truncaba a mitad de la llamada de
// función. Estos tests confirman que el body HTTP real ahora lleva el
// max_tokens explícito que el caller pasa, y que sigue habiendo un fallback
// documentado (DEFAULT_MAX_OUTPUT_TOKENS) cuando el caller no pasa nada.

const originalFetch = globalThis.fetch
const originalKey = process.env.OPENROUTER_API_KEY
const originalAnthropicKey = process.env.ANTHROPIC_API_KEY

afterEach(() => {
  globalThis.fetch = originalFetch
  if (originalKey === undefined) delete process.env.OPENROUTER_API_KEY
  else process.env.OPENROUTER_API_KEY = originalKey
  if (originalAnthropicKey === undefined) delete process.env.ANTHROPIC_API_KEY
  else process.env.ANTHROPIC_API_KEY = originalAnthropicKey
})

function captureBodyFetch() {
  let capturedBody: any = null
  globalThis.fetch = (async (_url: string | URL, init?: RequestInit) => {
    capturedBody = JSON.parse(String(init?.body))
    return new Response(JSON.stringify({
      choices: [{ message: { content: 'ok' } }],
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }) as unknown as typeof fetch
  return () => capturedBody
}

describe('G.5 fix — maxTokens threaded through tool-calling, never hardcoded', () => {
  it('runToolLoop (openrouter round) forwards opts.maxTokens as the real max_tokens in the request body', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-test-or-key'
    const getBody = captureBodyFetch()

    await runToolLoop('openrouter', 'openai/gpt-4o-mini', {
      system: 'sys',
      messages: [{ role: 'user', content: 'hi' }],
      tools: [FETCH_URL_TOOL],
      executeTool: async () => '',
      maxTokens: 187000,
    })

    expect(getBody().max_tokens).toBe(187000)
  })

  it('runToolLoop falls back to DEFAULT_MAX_OUTPUT_TOKENS (8192) when the caller passes no maxTokens', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-test-or-key'
    const getBody = captureBodyFetch()

    await runToolLoop('openrouter', 'openai/gpt-4o-mini', {
      system: 'sys',
      messages: [{ role: 'user', content: 'hi' }],
      tools: [FETCH_URL_TOOL],
      executeTool: async () => '',
    })

    expect(getBody().max_tokens).toBe(8192)
  })

  it('callWithTools (single-turn dispatcher) forwards maxTokens for the openrouter path', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-test-or-key'
    const getBody = captureBodyFetch()

    await callWithTools('openrouter', 'openai/gpt-4o-mini', {
      system: 'sys',
      userMessage: 'hi',
      tools: [FETCH_URL_TOOL],
      maxTokens: 42000,
    })

    expect(getBody().max_tokens).toBe(42000)
  })

  it('callWithTools (anthropic direct) forwards maxTokens', async () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test-anthropic-key'
    let capturedBody: any = null
    globalThis.fetch = (async (_url: string | URL, init?: RequestInit) => {
      capturedBody = JSON.parse(String(init?.body))
      return new Response(JSON.stringify({
        content: [{ type: 'text', text: 'ok' }],
        usage: { input_tokens: 1, output_tokens: 1 },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }) as unknown as typeof fetch

    await callWithTools('anthropic', 'anthropic/claude-haiku-4-5', {
      system: 'sys',
      userMessage: 'hi',
      tools: [FETCH_URL_TOOL],
      maxTokens: 99000,
    })

    expect(capturedBody.max_tokens).toBe(99000)
  })
})
