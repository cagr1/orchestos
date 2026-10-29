import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { handleApiSetup, handleApiSetupApiKey } from '../handlers/setup.ts'
import { envFilePath } from '../settings-store.ts'

// L62-002 (gate de seguridad L.6.2, 2026-08-02) — `handleApiSetupApiKey()`
// escribía la key en el .env ANTES de validarla contra el proveedor, y solo
// revertía si la respuesta era 401. Un timeout, un error de red o cualquier
// otro status dejaba una key sin validar persistida en texto plano.
//
// Estos tests corren contra un ORCHESTOS_HOME temporal — NUNCA contra el
// ~/.orchestos/.env real (ver [[reference-test-fixtures-leak-into-real-db]]:
// este repo no tiene aislamiento de fixtures por defecto y ya se filtró antes).

const originalHome = process.env.ORCHESTOS_HOME
const originalFetch = globalThis.fetch
const originalTestUrl = process.env.ORCHESTOS_OPENROUTER_TEST_URL
let tmpHome: string

beforeEach(() => {
  tmpHome = mkdtempSync(join(tmpdir(), 'orchestos-l62-'))
  process.env.ORCHESTOS_HOME = tmpHome
  delete process.env.ORCHESTOS_OPENROUTER_TEST_URL
})

afterEach(() => {
  globalThis.fetch = originalFetch
  if (originalTestUrl === undefined) delete process.env.ORCHESTOS_OPENROUTER_TEST_URL
  else process.env.ORCHESTOS_OPENROUTER_TEST_URL = originalTestUrl
  if (originalHome === undefined) delete process.env.ORCHESTOS_HOME
  else process.env.ORCHESTOS_HOME = originalHome
  rmSync(tmpHome, { recursive: true, force: true })
})

function keyRequest(key = 'sk-or-v1-testkeyvalue0000000000') {
  return new Request('http://localhost/api/setup/api-key', {
    method: 'POST',
    body: JSON.stringify({ provider: 'openrouter', key }),
  })
}

function persistedEnv(): string {
  const f = envFilePath()
  return existsSync(f) ? readFileSync(f, 'utf-8') : ''
}

describe('handleApiSetupApiKey — no persiste una key sin validar (L62-002)', () => {
  test('el ORCHESTOS_HOME temporal aísla de verdad el .env real', () => {
    expect(envFilePath().startsWith(tmpHome)).toBe(true)
  })

  test('key válida (200) SÍ se persiste', async () => {
    globalThis.fetch = (async () => new Response('{}', { status: 200 })) as unknown as typeof fetch
    const res = await handleApiSetupApiKey(keyRequest())
    expect(await res.json()).toEqual({ valid: true })
    expect(persistedEnv()).toContain('sk-or-v1-testkeyvalue0000000000')
  })

  test('el override de OpenRouter se lee en cada llamada y conserva el default', async () => {
    const urls: string[] = []
    globalThis.fetch = (async (url: string | URL | Request) => {
      urls.push(String(url))
      return new Response('unauthorized', { status: 401 })
    }) as typeof fetch

    process.env.ORCHESTOS_OPENROUTER_TEST_URL = 'http://127.0.0.1:9/'
    await handleApiSetupApiKey(keyRequest('ui-gate-key'))
    process.env.ORCHESTOS_OPENROUTER_TEST_URL = 'http://127.0.0.1:10/'
    await handleApiSetupApiKey(keyRequest('ui-gate-key'))
    delete process.env.ORCHESTOS_OPENROUTER_TEST_URL
    await handleApiSetupApiKey(keyRequest('ui-gate-key'))

    expect(urls).toEqual([
      'http://127.0.0.1:9/',
      'http://127.0.0.1:10/',
      'https://openrouter.ai/api/v1/chat/completions',
    ])
    expect(persistedEnv()).toBe('')
  })

  test('timeout / error de red NO persiste la key', async () => {
    globalThis.fetch = (async () => {
      throw Object.assign(new Error('aborted'), { name: 'AbortError' })
    }) as unknown as typeof fetch
    const res = await handleApiSetupApiKey(keyRequest())
    const body = (await res.json()) as { valid: boolean }
    expect(body.valid).toBe(false)
    expect(persistedEnv()).not.toContain('sk-or-v1-testkeyvalue0000000000')
  })

  test('401 NO persiste la key', async () => {
    globalThis.fetch = (async () =>
      new Response('unauthorized', { status: 401 })) as unknown as typeof fetch
    const res = await handleApiSetupApiKey(keyRequest())
    expect(((await res.json()) as { valid: boolean }).valid).toBe(false)
    expect(persistedEnv()).not.toContain('sk-or-v1-testkeyvalue0000000000')
  })

  test('500 del proveedor NO persiste la key (el caso que el fix agrega)', async () => {
    globalThis.fetch = (async () =>
      new Response('server error', { status: 500 })) as unknown as typeof fetch
    const res = await handleApiSetupApiKey(keyRequest())
    expect(((await res.json()) as { valid: boolean }).valid).toBe(false)
    expect(persistedEnv()).not.toContain('sk-or-v1-testkeyvalue0000000000')
  })

  test('un fallo no borra ni corrompe una key ya guardada de otro proveedor', async () => {
    mkdirSync(join(tmpHome, '.orchestos'), { recursive: true })
    writeFileSync(envFilePath(), 'ANTHROPIC_API_KEY=sk-ant-existing-value\n', 'utf-8')

    globalThis.fetch = (async () =>
      new Response('server error', { status: 500 })) as unknown as typeof fetch
    await handleApiSetupApiKey(keyRequest())

    expect(persistedEnv()).toContain('sk-ant-existing-value')
    expect(persistedEnv()).not.toContain('sk-or-v1-testkeyvalue0000000000')
  })
})

describe('handleApiSetup — OpenRouter no es crítico', () => {
  test('sin clave, openrouter-key.critical === false', async () => {
    const prev = process.env.OPENROUTER_API_KEY
    delete process.env.OPENROUTER_API_KEY
    try {
      const res = handleApiSetup(tmpHome)
      const body = (await res.json()) as { items: { id: string; critical: boolean; ok: boolean }[] }
      const item = body.items.find((i) => i.id === 'openrouter-key')!
      expect(item.ok).toBe(false)
      expect(item.critical).toBe(false)
    } finally {
      if (prev !== undefined) process.env.OPENROUTER_API_KEY = prev
    }
  })
})
