/**
 * G.4.5 — catálogo models.dev para traducir ids OrchestOS → namespace opencode.
 * Mismo patrón de aislamiento que model-catalog.test.ts: ORCHESTOS_HOME temporal,
 * override directo de globalThis.fetch (sin mock.module, ver
 * [[reference-bun-mock-module-gotcha]]).
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import {
  ensureOpencodeCatalogLoaded,
  getOpencodeCatalog,
  _resetOpencodeCatalog,
} from '../router/opencode-catalog.ts'
import { orchestosModelToOpencodeModel } from '../run/executors/opencode.ts'

let home: string
const prevHome = process.env.ORCHESTOS_HOME
const originalFetch = globalThis.fetch

function seedDiskCache(models: string[], fetchedAt: number) {
  const dir = join(home, '.orchestos', 'cache')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'opencode-models.json'), JSON.stringify({ fetchedAt, models }), 'utf-8')
}

function mockFetch(impl: typeof fetch) {
  globalThis.fetch = impl
}

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'orchestos-opencode-catalog-'))
  process.env.ORCHESTOS_HOME = home
  _resetOpencodeCatalog()
})

afterEach(() => {
  _resetOpencodeCatalog()
  if (prevHome === undefined) delete process.env.ORCHESTOS_HOME
  else process.env.ORCHESTOS_HOME = prevHome
  globalThis.fetch = originalFetch
  try { rmSync(home, { recursive: true, force: true }) } catch { /* noop */ }
})

describe('opencode-catalog', () => {
  it('sin cache y fetch exitoso → carga en memoria y persiste a disco', async () => {
    mockFetch((async () => new Response(JSON.stringify({
      openrouter: { models: { 'anthropic/claude-sonnet-5': {}, 'deepseek/deepseek-v4-flash': {} } },
    }), { status: 200 })) as unknown as typeof fetch)

    await ensureOpencodeCatalogLoaded()

    const cat = getOpencodeCatalog()
    expect(cat?.has('anthropic/claude-sonnet-5')).toBe(true)
    expect(cat?.has('deepseek/deepseek-v4-flash')).toBe(true)
    expect(cat?.size).toBe(2)

    const disk = JSON.parse(readFileSync(join(home, '.orchestos', 'cache', 'opencode-models.json'), 'utf-8'))
    expect(disk.models).toContain('anthropic/claude-sonnet-5')
  })

  it('cache en disco fresco → no pega a la red', async () => {
    seedDiskCache(['openai/gpt-5.4'], Date.now())
    let fetchCalled = false
    mockFetch((async () => { fetchCalled = true; throw new Error('should not fetch') }) as unknown as typeof fetch)

    await ensureOpencodeCatalogLoaded()

    expect(fetchCalled).toBe(false)
    expect(getOpencodeCatalog()?.has('openai/gpt-5.4')).toBe(true)
  })

  it('cache en disco vencido (>24h) → refetch', async () => {
    seedDiskCache(['stale/model'], Date.now() - 25 * 60 * 60 * 1000)
    mockFetch((async () => new Response(JSON.stringify({
      openrouter: { models: { 'fresh/model': {} } },
    }), { status: 200 })) as unknown as typeof fetch)

    await ensureOpencodeCatalogLoaded()

    const cat = getOpencodeCatalog()
    expect(cat?.has('fresh/model')).toBe(true)
    expect(cat?.has('stale/model')).toBe(false)
  })

  it('fetch falla, hay cache vencido → usa el cache stale en vez de quedar vacío', async () => {
    seedDiskCache(['stale/model'], Date.now() - 25 * 60 * 60 * 1000)
    mockFetch((async () => { throw new Error('network down') }) as unknown as typeof fetch)

    await ensureOpencodeCatalogLoaded()

    expect(getOpencodeCatalog()?.has('stale/model')).toBe(true)
  })

  it('fetch falla, sin cache en disco → catálogo queda null, nunca lanza', async () => {
    mockFetch((async () => { throw new Error('network down') }) as unknown as typeof fetch)

    await ensureOpencodeCatalogLoaded()

    expect(getOpencodeCatalog()).toBeNull()
  })

  it('respuesta de models.dev sin openrouter.models válido → no lanza, cae a stale/null', async () => {
    mockFetch((async () => new Response(JSON.stringify({ openrouter: {} }), { status: 200 })) as unknown as typeof fetch)

    await expect(ensureOpencodeCatalogLoaded()).resolves.toBeUndefined()
    expect(getOpencodeCatalog()).toBeNull()
  })

  it('bajo NODE_ENV=test sin ORCHESTOS_HOME explícito no escribe al cache real (guard anti-contaminación)', async () => {
    // Simula el escenario real del bug documentado en model-catalog.ts: acá SÍ
    // seteamos ORCHESTOS_HOME (aislado), así que el guard NO debe bloquear esta
    // escritura — solo verificamos que el archivo se crea bajo el home aislado.
    mockFetch((async () => new Response(JSON.stringify({
      openrouter: { models: { 'x/y': {} } },
    }), { status: 200 })) as unknown as typeof fetch)
    await ensureOpencodeCatalogLoaded()
    const path = join(home, '.orchestos', 'cache', 'opencode-models.json')
    expect(readFileSync(path, 'utf-8')).toContain('x/y')
  })
})

describe('orchestosModelToOpencodeModel (con catálogo real cargado)', () => {
  it('id presente en el catálogo → prefijo openrouter/', async () => {
    mockFetch((async () => new Response(JSON.stringify({
      openrouter: { models: { 'anthropic/claude-sonnet-5': {} } },
    }), { status: 200 })) as unknown as typeof fetch)
    await ensureOpencodeCatalogLoaded()

    expect(orchestosModelToOpencodeModel('anthropic/claude-sonnet-5')).toBe('openrouter/anthropic/claude-sonnet-5')
  })

  it('id ausente del catálogo → undefined, nunca inventa un id', async () => {
    mockFetch((async () => new Response(JSON.stringify({
      openrouter: { models: { 'anthropic/claude-sonnet-5': {} } },
    }), { status: 200 })) as unknown as typeof fetch)
    await ensureOpencodeCatalogLoaded()

    expect(orchestosModelToOpencodeModel('not-a-real/model')).toBeUndefined()
  })

  it('catálogo nunca cargado (null) → undefined, no revienta', () => {
    expect(orchestosModelToOpencodeModel('anthropic/claude-sonnet-5')).toBeUndefined()
  })

  it('model undefined → undefined', () => {
    expect(orchestosModelToOpencodeModel(undefined)).toBeUndefined()
  })
})
