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

  it('Mes 22 (2026-07-17): shrinks max_tokens on later rounds as tool results grow the prompt, instead of reusing the stale initial budget', async () => {
    // Repro of the live 400: caller computes maxTokens against a small initial
    // prompt, then a tool call appends a large result to history — the FINAL
    // round's real prompt is now much bigger, so its max_tokens must shrink
    // by roughly that growth, not stay pinned to the original number.
    process.env.OPENROUTER_API_KEY = 'sk-test-or-key'
    const bodies: any[] = []
    let call = 0
    globalThis.fetch = (async (_url: string | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body))
      bodies.push(body)
      call++
      if (call === 1) {
        // first round: model asks to call the tool
        return new Response(JSON.stringify({
          choices: [{ message: { tool_calls: [{ id: 't1', type: 'function', function: { name: FETCH_URL_TOOL.name, arguments: '{}' } }] } }],
          usage: { prompt_tokens: 1, completion_tokens: 1 },
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
      // second round (closing round): plain text answer
      return new Response(JSON.stringify({
        choices: [{ message: { content: 'ok' } }],
        usage: { prompt_tokens: 1, completion_tokens: 1 },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }) as unknown as typeof fetch

    const largeToolResult = 'x'.repeat(40000) // ~10k tokens by the chars/4 estimate

    await runToolLoop('openrouter', 'openai/gpt-4o-mini', {
      system: 'sys',
      messages: [{ role: 'user', content: 'hi' }],
      tools: [FETCH_URL_TOOL],
      executeTool: async () => largeToolResult,
      maxTokens: 187000,
    })

    expect(bodies[0].max_tokens).toBe(187000) // first round: no growth yet, honors caller's number exactly
    expect(bodies[1].max_tokens).toBeLessThan(187000) // closing round: shrunk by the tool result's growth
    expect(bodies[1].max_tokens).toBeGreaterThan(170000) // shrunk, not collapsed to near-zero or clamped to some other cap
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
