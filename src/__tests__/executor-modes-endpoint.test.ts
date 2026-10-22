/**
 * G.4.3 — GET /api/system/executor-modes. Handler delegado a Codex (G.4.2b
 * cerró la ventana de suscripción cuidando cupo de Claude), tests escritos
 * a mano después de revisar el diff y verificar en vivo contra el dashboard
 * real (3 CLIs detectados de verdad: claude/opencode/codex).
 *
 * Mismo patrón de mock que el resto de la suite: override directo de
 * Bun.which/globalThis.fetch, sin mock.module (ver
 * [[reference-bun-mock-module-gotcha]]).
 */
import { afterEach, describe, expect, it } from 'bun:test'
import { loadOrcheConfig } from '../config/load.ts'
import { handleApiSystemExecutorModes } from '../dashboard/handlers/tasks.ts'
import { KNOWN_CLIS } from '../run/executors/cli-registry.ts'

const originalWhich = Bun.which
const originalFetch = globalThis.fetch

afterEach(() => {
  Bun.which = originalWhich
  globalThis.fetch = originalFetch
})

describe('GET /api/system/executor-modes', () => {
  it('devuelve local → KNOWN_CLIS → api, con taskEngine según el registro de ejecutores', async () => {
    ;(Bun as any).which = (_bin: string) => null
    globalThis.fetch = (async () => {
      throw new Error('connection refused')
    }) as unknown as typeof fetch

    const res = await handleApiSystemExecutorModes()
    const data = (await res.json()) as { modes: { id: string }[]; selected: string | null }

    expect(data.modes.map((m) => m.id)).toEqual([
      'local',
      ...KNOWN_CLIS.map((cli) => cli.id),
      'api',
    ])
    const withEngine = (data.modes as { id: string; taskEngine: boolean }[])
      .filter((m) => m.taskEngine)
      .map((m) => m.id)
    expect(withEngine).toEqual(['local', 'claude', 'codex', 'opencode', 'api'])
    expect(
      (data.modes as { id: string; taskEngine: boolean }[]).find((m) => m.id === 'gemini'),
    ).toMatchObject({ taskEngine: false })
  })

  it("session: claude/codex 'chat', opencode 'terminal', CLI sin adaptador null", async () => {
    ;(Bun as any).which = (_bin: string) => '/fake/bin'
    globalThis.fetch = (async () => {
      throw new Error('connection refused')
    }) as unknown as typeof fetch

    const res = await handleApiSystemExecutorModes()
    const data = (await res.json()) as { modes: { id: string; session: string | null }[] }
    const session = (id: string) => data.modes.find((m) => m.id === id)?.session
    expect(session('claude')).toBe('chat')
    expect(session('codex')).toBe('chat')
    expect(session('opencode')).toBe('terminal')
    expect(session('gemini')).toBeNull()
    expect(session('local')).toBe('chat')
    expect(session('api')).toBe('chat')
  })

  it("'api' siempre detected:true, path:null — no depende de ningún binario", async () => {
    ;(Bun as any).which = (_bin: string) => null
    globalThis.fetch = (async () => {
      throw new Error('connection refused')
    }) as unknown as typeof fetch

    const res = await handleApiSystemExecutorModes()
    const data = (await res.json()) as {
      modes: { id: string; detected: boolean; path: string | null }[]
    }
    const api = data.modes.find((m) => m.id === 'api')!
    expect(api.detected).toBe(true)
    expect(api.path).toBeNull()
  })

  it("'local' refleja el probe real de Ollama (fetch ok con status 200 → detected:true)", async () => {
    ;(Bun as any).which = (_bin: string) => null
    globalThis.fetch = (async () => new Response('{}', { status: 200 })) as unknown as typeof fetch

    const res = await handleApiSystemExecutorModes()
    const data = (await res.json()) as { modes: { id: string; detected: boolean }[] }
    expect(data.modes.find((m) => m.id === 'local')!.detected).toBe(true)
  })

  it("'local' → detected:false cuando Ollama no responde (fetch rechaza)", async () => {
    ;(Bun as any).which = (_bin: string) => null
    globalThis.fetch = (async () => {
      throw new Error('ECONNREFUSED')
    }) as unknown as typeof fetch

    const res = await handleApiSystemExecutorModes()
    const data = (await res.json()) as { modes: { id: string; detected: boolean }[] }
    expect(data.modes.find((m) => m.id === 'local')!.detected).toBe(false)
  })

  it('claude/opencode/codex reflejan Bun.which por binario, con su path real', async () => {
    ;(Bun as any).which = (bin: string) =>
      bin === 'claude' ? '/fake/claude' : bin === 'opencode' ? '/fake/opencode' : null
    globalThis.fetch = (async () => {
      throw new Error('connection refused')
    }) as unknown as typeof fetch

    const res = await handleApiSystemExecutorModes()
    const data = (await res.json()) as {
      modes: { id: string; detected: boolean; path: string | null }[]
    }
    expect(data.modes.find((m) => m.id === 'claude')).toMatchObject({
      detected: true,
      path: '/fake/claude',
    })
    expect(data.modes.find((m) => m.id === 'opencode')).toMatchObject({
      detected: true,
      path: '/fake/opencode',
    })
    expect(data.modes.find((m) => m.id === 'codex')).toMatchObject({ detected: false, path: null })
  })

  it('selected refleja loadOrcheConfig(root).agent real (null si no hay preferencia guardada)', async () => {
    ;(Bun as any).which = (_bin: string) => null
    globalThis.fetch = (async () => {
      throw new Error('connection refused')
    }) as unknown as typeof fetch

    const res = await handleApiSystemExecutorModes()
    const data = (await res.json()) as { selected: string | null }
    const expected = loadOrcheConfig(process.cwd()).agent ?? null
    expect(data.selected).toBe(expected)
  })
})
