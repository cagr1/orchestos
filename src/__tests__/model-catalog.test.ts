import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import {
  ensureCatalogLoaded,
  contextWindowFor,
  hasRealContextWindow,
  _resetCatalog,
} from '../router/model-catalog.ts'

// Aísla el cache en disco vía ORCHESTOS_HOME para no tocar ~/.orchestos real.
let home: string
const prevHome = process.env.ORCHESTOS_HOME
const prevKey = process.env.OPENROUTER_API_KEY

function seedDiskCache(models: Record<string, { contextLength: number; priceIn: number }>, fetchedAt: number) {
  const dir = join(home, '.orchestos', 'cache')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'models.json'), JSON.stringify({ fetchedAt, models }), 'utf-8')
}

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'orchestos-catalog-'))
  process.env.ORCHESTOS_HOME = home
  // Sin API key: ensureCatalogLoaded nunca pega a la red en los tests.
  delete process.env.OPENROUTER_API_KEY
  _resetCatalog()
})

afterEach(() => {
  _resetCatalog()
  if (prevHome === undefined) delete process.env.ORCHESTOS_HOME
  else process.env.ORCHESTOS_HOME = prevHome
  if (prevKey === undefined) delete process.env.OPENROUTER_API_KEY
  else process.env.OPENROUTER_API_KEY = prevKey
  try { rmSync(home, { recursive: true, force: true }) } catch { /* noop */ }
})

describe('model-catalog', () => {
  it('cae a la tabla de familias cuando no hay catálogo cargado', () => {
    // 'claude' → 200K por la tabla hardcodeada de context-monitor.
    expect(contextWindowFor('anthropic/claude-haiku-4-5')).toBe(200_000)
    // id desconocido → default conservador (128K).
    expect(contextWindowFor('totally/unknown-model')).toBe(128_000)
    expect(hasRealContextWindow('anthropic/claude-haiku-4-5')).toBe(false)
  })

  it('usa el context_length real del cache fresco en disco, no la familia', async () => {
    // gpt-3.5 por familia daría 16K; sembramos un valor distinto y exacto.
    seedDiskCache(
      { 'openai/gpt-3.5-turbo': { contextLength: 16_385, priceIn: 0.5 } },
      Date.now(),
    )
    await ensureCatalogLoaded()
    expect(contextWindowFor('openai/gpt-3.5-turbo')).toBe(16_385)
    expect(hasRealContextWindow('openai/gpt-3.5-turbo')).toBe(true)
  })

  it('un modelo de ventana chica reporta su valor real, evitando el falso 128K', async () => {
    seedDiskCache(
      { 'tiny/model-4k': { contextLength: 4_096, priceIn: 0.1 } },
      Date.now(),
    )
    await ensureCatalogLoaded()
    // Sin catálogo habría caído al default de 128K — peligro de alucinación.
    expect(contextWindowFor('tiny/model-4k')).toBe(4_096)
  })

  it('usa el cache vencido si no hay red/API key (mejor que la tabla a secas)', async () => {
    const stale = Date.now() - 48 * 60 * 60 * 1000 // 48h: vencido (TTL 24h)
    seedDiskCache(
      { 'some/cached-model': { contextLength: 64_000, priceIn: 0.2 } },
      stale,
    )
    await ensureCatalogLoaded({ apiKey: '' }) // offline forzado → no refetch → usa el disco vencido
    expect(contextWindowFor('some/cached-model')).toBe(64_000)
  })

  it('ignora entradas con contextLength 0 y cae al fallback', async () => {
    seedDiskCache(
      { 'broken/no-context': { contextLength: 0, priceIn: 0 } },
      Date.now(),
    )
    await ensureCatalogLoaded()
    // contextLength 0 no es confiable → fallback por familia (default 128K).
    expect(contextWindowFor('broken/no-context')).toBe(128_000)
    expect(hasRealContextWindow('broken/no-context')).toBe(false)
  })

  it('ensureCatalogLoaded no lanza cuando no hay cache ni API key', async () => {
    await expect(ensureCatalogLoaded({ apiKey: '' })).resolves.toBeUndefined()
    expect(contextWindowFor('anthropic/claude-haiku-4-5')).toBe(200_000)
  })

  it('AR.2: con key presente + cache vencido + red caída, solo intenta el fetch una vez por proceso', async () => {
    const stale = Date.now() - 48 * 60 * 60 * 1000
    seedDiskCache(
      { 'some/cached-model': { contextLength: 64_000, priceIn: 0.2 } },
      stale,
    )
    const originalFetch = globalThis.fetch
    let fetchCalls = 0
    globalThis.fetch = (async () => {
      fetchCalls++
      throw new Error('network down')
    }) as unknown as typeof fetch

    try {
      // Llamada 1: intenta fetch real (key presente), falla, cae al disco vencido.
      await ensureCatalogLoaded({ apiKey: 'fake-key' })
      expect(fetchCalls).toBe(1)
      expect(contextWindowFor('some/cached-model')).toBe(64_000)

      // Llamada 2 (mismo proceso, sin force): antes del fix, memoryFetchedAt
      // seguía siendo el timestamp vencido → isFresh() daba false → reintentaba
      // el fetch (10s de timeout) en cada tarea del grafo. Con el fix no reintenta.
      await ensureCatalogLoaded({ apiKey: 'fake-key' })
      expect(fetchCalls).toBe(1)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('AR.7: un pricing.prompt no numérico no contamina el cache con NaN/null', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async () => new Response(
      JSON.stringify({ data: [{ id: 'weird/model', context_length: 32_000, pricing: { prompt: 'not-a-number' } }] }),
      { status: 200 },
    )) as unknown as typeof fetch

    try {
      await ensureCatalogLoaded({ apiKey: 'fake-key', force: true })
      const cache = JSON.parse(readFileSync(join(home, '.orchestos', 'cache', 'models.json'), 'utf-8'))
      // Antes del fix: Number('not-a-number') * 1e6 = NaN → JSON.stringify lo serializa como null.
      expect(cache.models['weird/model'].priceIn).toBe(0)
      expect(contextWindowFor('weird/model')).toBe(32_000) // contextLength no afectado
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
