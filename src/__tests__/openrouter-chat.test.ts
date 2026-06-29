import { describe, it, expect, beforeAll, afterAll } from 'bun:test'

const originalFetch = globalThis.fetch

// Import dinámico (no estático) a propósito: diagnose.test.ts usa mock.module()
// sobre este mismo archivo (../providers/openrouter.ts) y, por cómo Bun resuelve
// imports estáticos durante la fase de collection (antes de correr ningún test),
// un `import { chat } from ...` de nivel de módulo acá quedaría atado al mock de
// diagnose.test.ts si ese archivo se importa primero (alfabéticamente 'd' < 'o').
// El import dinámico ocurre en fase de ejecución, después de que el afterAll de
// diagnose.test.ts ya restauró el módulo real. Mismo género de problema que
// [[reference-bun-mock-module-gotcha]].
let chat: typeof import('../providers/openrouter.ts')['chat']

beforeAll(async () => {
  process.env.OPENROUTER_API_KEY = 'sk-test-or-key'
  ;({ chat } = await import('../providers/openrouter.ts'))
})

afterAll(() => {
  delete process.env.OPENROUTER_API_KEY
  globalThis.fetch = originalFetch
})

function mockFetchCapture() {
  let capturedBody: any = null
  globalThis.fetch = ((_url: string | URL, init?: RequestInit): Promise<Response> => {
    capturedBody = JSON.parse(String(init?.body))
    return Promise.resolve(new Response(JSON.stringify({
      choices: [{ message: { content: 'ok' } }],
      usage: { prompt_tokens: 1, completion_tokens: 1 },
      model: 'deepseek/deepseek-r1',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
  }) as unknown as typeof globalThis.fetch
  return () => capturedBody
}

describe('openrouter.chat — BACK.2 reasoning effort', () => {
  it('includes reasoning.effort in the body when effort is passed', async () => {
    const getBody = mockFetchCapture()
    await chat({
      model: 'deepseek/deepseek-r1',
      system: 'Be concise',
      messages: [{ role: 'user', content: 'Hi' }],
      effort: 'medium',
    })
    expect(getBody().reasoning).toEqual({ effort: 'medium' })
  })

  it('omits reasoning when no effort is passed', async () => {
    const getBody = mockFetchCapture()
    await chat({
      model: 'openai/gpt-4o-mini',
      system: 'Be concise',
      messages: [{ role: 'user', content: 'Hi' }],
    })
    expect(getBody().reasoning).toBeUndefined()
  })
})
