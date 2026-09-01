import { afterEach, describe, expect, it } from 'bun:test'
import {
  cascadeTaskFields,
  resolveAgentSelection,
  resolveCascadeTier,
} from '../router/engine-cascade.ts'

// G.1 (Bloque G, PLAN.md) — resolveCascadeTier() decide el tier (local → cli → api)
// para las tareas de build auto-creadas desde el chat. Mismo patrón que
// external-engine.test.ts (override directo de Bun.which) y model-catalog.test.ts
// (override directo de globalThis.fetch) — NO mock.module, ver
// [[reference-bun-mock-module-gotcha]]: no tiene scope por archivo y contamina
// el resto de la suite.

const originalWhich = Bun.which
const originalFetch = globalThis.fetch

function mockWhich(result: string | null) {
  ;(Bun as any).which = (_bin: string) => result
}

function mockFetch(impl: typeof fetch) {
  globalThis.fetch = impl
}

afterEach(() => {
  ;(Bun as any).which = originalWhich
  globalThis.fetch = originalFetch
})

describe('resolveCascadeTier()', () => {
  it('Ollama con modelos detectados → tier local, sin importar si claude tambien esta', async () => {
    mockFetch(
      (async () =>
        new Response(JSON.stringify({ models: [{ name: 'llama3' }] }), {
          status: 200,
        })) as unknown as typeof fetch,
    )
    mockWhich('/usr/local/bin/claude')

    const res = await resolveCascadeTier()

    expect(res.tier).toBe('local')
    expect(res.engine).toBeUndefined()
    expect(res.executorModel).toBeUndefined()
  })

  it('Ollama responde ok pero sin modelos → no cuenta como local, sigue a claude', async () => {
    mockFetch(
      (async () =>
        new Response(JSON.stringify({ models: [] }), { status: 200 })) as unknown as typeof fetch,
    )
    mockWhich('/usr/local/bin/claude')

    const res = await resolveCascadeTier()

    expect(res.tier).toBe('cli')
  })

  it('Ollama responde con status no-ok → no cuenta como local', async () => {
    mockFetch((async () => new Response('', { status: 500 })) as unknown as typeof fetch)
    mockWhich('/usr/local/bin/claude')

    const res = await resolveCascadeTier()

    expect(res.tier).toBe('cli')
  })

  it('Ollama no responde (fetch rechaza) → no cuenta como local, no propaga el error', async () => {
    mockFetch((async () => {
      throw new Error('ECONNREFUSED')
    }) as unknown as typeof fetch)
    mockWhich('/usr/local/bin/claude')

    const res = await resolveCascadeTier()

    expect(res.tier).toBe('cli')
  })

  it('sin Ollama y con binario claude en PATH → tier cli con engine external y modelo sonnet por defecto', async () => {
    mockFetch((async () => new Response('', { status: 500 })) as unknown as typeof fetch)
    mockWhich('/usr/local/bin/claude')

    const res = await resolveCascadeTier()

    expect(res.tier).toBe('cli')
    expect(res.engine).toBe('external')
    expect(res.executorModel).toBe('anthropic/claude-sonnet-5')
  })

  it('sin Ollama y sin binario claude → tier api, sin fijar engine ni modelo (gana orchestos.config.yaml)', async () => {
    mockFetch((async () => new Response('', { status: 500 })) as unknown as typeof fetch)
    mockWhich(null)

    const res = await resolveCascadeTier()

    expect(res.tier).toBe('api')
    expect(res.engine).toBeUndefined()
    expect(res.executorModel).toBeUndefined()
  })
})

// G.2 (Bloque G, PLAN.md) — cascadeTaskFields() es la función pura que
// handlers/chat.ts usa para mapear el tier resuelto a los campos que
// createTaskRecord() necesita. Sin I/O — no comparte la ventana racy de
// handleApiChat con globalThis.fetch (ver nota en chat-effort.test.ts).
describe('cascadeTaskFields()', () => {
  it("tier 'cli' → fija executor_model y engine desde la resolución", () => {
    const fields = cascadeTaskFields({
      tier: 'cli',
      engine: 'external',
      executorModel: 'anthropic/claude-sonnet-5',
    })
    expect(fields).toEqual({ executor_model: 'anthropic/claude-sonnet-5', engine: 'external' })
  })

  it("tier 'local' → no fija nada, no hay executor de tareas para Ollama todavía", () => {
    const fields = cascadeTaskFields({ tier: 'local' })
    expect(fields).toEqual({})
  })

  it("tier 'api' → no fija nada, gana orchestos.config.yaml", () => {
    const fields = cascadeTaskFields({ tier: 'api' })
    expect(fields).toEqual({})
  })
})

// CC.D1 (antes G.4.1) — resolveAgentSelection() es la capa nueva: preferredAgent
// (preferencia persistente del usuario) gana sobre la cascada; la cascada
// solo entra como fallback cuando preferredAgent es undefined (sin
// preferencia guardada todavía). [[feedback-deteccion-no-decision-automatica]]
describe('resolveAgentSelection()', () => {
  const apiCascade = { tier: 'api' as const }

  it("preferredAgent 'claude' → fija executor_model + engine external, sin importar la cascada", () => {
    const fields = resolveAgentSelection('claude', apiCascade)
    expect(fields).toEqual({ executor_model: 'anthropic/claude-sonnet-5', engine: 'external' })
  })

  it("preferredAgent 'opencode' → fija engine opencode, sin modelo fijo (traducción pendiente G.4.5)", () => {
    const fields = resolveAgentSelection('opencode', apiCascade)
    expect(fields).toEqual({ engine: 'opencode' })
  })

  it("preferredAgent 'local' → no fija nada (sin executor de tareas para Ollama)", () => {
    expect(resolveAgentSelection('local', apiCascade)).toEqual({})
  })

  it("preferredAgent 'codex' → fija executor_model + engine codex (G.4.2b: ExecutorEngine real)", () => {
    expect(resolveAgentSelection('codex', apiCascade)).toEqual({
      executor_model: 'openai/gpt-5.4',
      engine: 'codex',
    })
  })

  it("preferredAgent 'api' → no fija nada, gana orchestos.config.yaml", () => {
    expect(resolveAgentSelection('api', apiCascade)).toEqual({})
  })

  it('preferredAgent undefined → cae a la cascada de bootstrap (mismo comportamiento que cascadeTaskFields)', () => {
    const cliCascade = {
      tier: 'cli' as const,
      engine: 'external' as const,
      executorModel: 'anthropic/claude-sonnet-5',
    }
    expect(resolveAgentSelection(undefined, cliCascade)).toEqual({
      executor_model: 'anthropic/claude-sonnet-5',
      engine: 'external',
    })
    expect(resolveAgentSelection(undefined, apiCascade)).toEqual({})
  })
})
