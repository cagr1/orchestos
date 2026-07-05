/**
 * C.2 — GET /api/system/engines/external/availability
 *
 * Endpoint que el composer del dashboard consulta cuando el usuario selecciona
 * `engine: external`. Devuelve:
 *   - available: boolean — si `claude` está en PATH
 *   - path: string | null — la ruta absoluta si está, null si no
 *   - installUrl: string — link a la página de instalación oficial
 *
 * Cubre los dos escenarios de disponibilidad honesta:
 *   1. binario presente → available=true, path=absoluto
 *   2. binario ausente → available=false, path=null, installUrl intacto
 *
 * Patrón heredado de tasks-api-engine.test.ts (G.4 / B.2): route() directo,
 * sin levantar el server. Bun.which se override por test para forzar los
 * dos casos sin depender de si la maquina CI tiene `claude` instalado.
 */
import { describe, it, expect, afterEach } from 'bun:test'

const { route } = await import('../server.ts')
const PORT = 4250

function req(method: string, path: string): Request {
  return new Request(`http://localhost:${PORT}${path}`, { method })
}

const originalWhich = Bun.which
afterEach(() => {
  ;(Bun as any).which = originalWhich
})

interface AvailabilityResponse {
  engine: string
  available: boolean
  path: string | null
  installUrl: string
}

describe('C.2 — GET /api/system/engines/external/availability', () => {
  it('binario presente: available=true, path es absoluto, installUrl presente', async () => {
    ;(Bun as any).which = (_bin: string) => '/usr/local/bin/claude'
    const res = await route(req('GET', '/api/system/engines/external/availability'), PORT)
    expect(res.status).toBe(200)
    const body = await res.json() as AvailabilityResponse
    expect(body.engine).toBe('external')
    expect(body.available).toBe(true)
    expect(body.path).toBe('/usr/local/bin/claude')
    expect(body.path!.startsWith('/')).toBe(true) // absoluto, no relativo
    expect(body.installUrl).toContain('claude.com/download')
  })

  it('binario ausente: available=false, path=null, installUrl sigue presente', async () => {
    ;(Bun as any).which = (_bin: string) => null
    const res = await route(req('GET', '/api/system/engines/external/availability'), PORT)
    expect(res.status).toBe(200)
    const body = await res.json() as AvailabilityResponse
    expect(body.engine).toBe('external')
    expect(body.available).toBe(false)
    expect(body.path).toBeNull()
    // El installUrl es independiente de la disponibilidad — el frontend lo
    // usa para mostrar el link de instalación.
    expect(body.installUrl).toContain('claude.com/download')
  })

  it('el endpoint solo responde a GET — POST devuelve 405 (consistente con el resto del routing)', async () => {
    const res = await route(req('POST', '/api/system/engines/external/availability'), PORT)
    expect(res.status).toBe(405)
  })

  it('el endpoint NO muta estado — dos llamadas seguidas devuelven el mismo resultado (cache-friendly en el cliente)', async () => {
    ;(Bun as any).which = (_bin: string) => '/opt/homebrew/bin/claude'
    const r1 = await route(req('GET', '/api/system/engines/external/availability'), PORT)
    const r2 = await route(req('GET', '/api/system/engines/external/availability'), PORT)
    const b1 = await r1.json() as AvailabilityResponse
    const b2 = await r2.json() as AvailabilityResponse
    expect(b1).toEqual(b2)
  })
})
