import { describe, it, expect, afterEach } from 'bun:test'
import { handleApiChat, handleApiChatModels } from '../dashboard/handlers/chat.ts'

// BACK.3: handleApiChat valida `effort` antes de tocar cualquier estado async
// (catálogo, fetch, db) — esta es la única parte de BACK.3 que se puede probar
// sin un seam de DI para `fetch`/`ensureCatalogLoaded`. El "¿llega reasoning al
// body?" ya está cubierto deterministamente en openrouter-chat.test.ts y
// tool-loop.test.ts (BACK.2); intentar repetirlo acá vía mock de globalThis.fetch
// es racy en la suite completa — handleApiChat tiene un preámbulo async largo
// (loadTasks/listRuns/db/loadContext/ensureCatalogLoaded) que deja una ventana
// grande para que OTRO archivo de test, corriendo concurrentemente en el mismo
// proceso de `bun test`, pise `globalThis.fetch` a mitad de camino — confirmado
// empíricamente (5 fails con output de graph-runner.test.ts intercalado en el
// stack trace). Mismo género de problema que [[reference-bun-mock-module-gotcha]]
// pero con `fetch` global en vez de `mock.module()`.
function chatRequest(body: unknown): Request {
  return new Request('http://localhost/api/chat', { method: 'POST', body: JSON.stringify(body) })
}

describe('handleApiChat — BACK.3 reasoning effort', () => {
  it('rejects an invalid effort value with 400, before touching catalog/fetch/db', async () => {
    const res = await handleApiChat(chatRequest({ message: 'hi', history: [], effort: 'turbo' }))
    expect(res.status).toBe(400)
    const data = await res.json() as any
    expect(data.error).toMatch(/effort must be one of/)
  })

  it('accepts the 3 valid effort values without 400 (no model check needed at validation time)', async () => {
    for (const effort of ['low', 'medium', 'high']) {
      const res = await handleApiChat(chatRequest({ message: '', history: [], effort }))
      // message vacío → 400 por "message is required", NUNCA por effort inválido.
      const data = await res.json() as any
      expect(data.error).not.toMatch(/effort/)
    }
  })
})

// BACK.4: handleApiChatModels solo hace UN fetch (sin preámbulo async largo),
// así que mockear globalThis.fetch acá no tiene la ventana de carrera de
// handleApiChat — seguro de testear directamente.
describe('handleApiChatModels — BACK.4 supportsReasoning field', () => {
  const originalFetch = globalThis.fetch
  const prevKey = process.env.OPENROUTER_API_KEY

  afterEach(() => {
    globalThis.fetch = originalFetch
    if (prevKey === undefined) delete process.env.OPENROUTER_API_KEY
    else process.env.OPENROUTER_API_KEY = prevKey
  })

  it('marks each model with supportsReasoning from supported_parameters', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-test-or-key'
    globalThis.fetch = (async () => new Response(JSON.stringify({
      data: [
        { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1', context_length: 64_000, pricing: { prompt: '0.0000005' }, supported_parameters: ['reasoning'] },
        { id: 'openai/gpt-4o-mini', name: 'GPT-4o mini', context_length: 128_000, pricing: { prompt: '0.0000001' }, supported_parameters: ['temperature'] },
        { id: 'no/params-field', name: 'No params', context_length: 32_000, pricing: { prompt: '0.0000001' } },
      ],
    }), { status: 200 })) as unknown as typeof fetch

    const res = await handleApiChatModels()
    const models = await res.json() as Array<{ id: string; supportsReasoning: boolean }>

    expect(models.find(m => m.id === 'deepseek/deepseek-r1')?.supportsReasoning).toBe(true)
    expect(models.find(m => m.id === 'openai/gpt-4o-mini')?.supportsReasoning).toBe(false)
    expect(models.find(m => m.id === 'no/params-field')?.supportsReasoning).toBe(false)
  })
})
