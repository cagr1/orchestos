/**
 * L.2 (Mes 23) — modelo de despliegue local-only + protección CSRF por origen.
 *
 * Decisión confirmada en docs/security-threat-model.md §6: el dashboard solo
 * sirve en 127.0.0.1, un usuario, sin autenticación multiusuario. Estos tests
 * verifican dos invariantes de ese modelo, no un sistema de auth nuevo:
 *   1. `startServer()` sigue haciendo bind exclusivamente a loopback — una
 *      regresión aquí sería exposición accidental a la red, no un feature.
 *   2. `isSameOrigin()` rechaza un origen local en OTRO puerto (hallazgo real
 *      de esta pasada: antes solo comparaba hostname, dejando pasar cualquier
 *      app en localhost:<otro-puerto> como si fuera el propio dashboard).
 */
import { describe, expect, it } from 'bun:test'
import { startServer } from '../server.ts'

const { route } = await import('../server.ts')
const PORT = 4260

function mutatingReq(origin?: string): Request {
  return new Request(`http://localhost:${PORT}/api/tasks/bulk-delete`, {
    method: 'POST',
    headers: origin ? { origin } : {},
    body: JSON.stringify({ ids: [] }),
  })
}

describe('L.2 — bind a loopback (no exposición accidental)', () => {
  it('startServer() nunca escucha fuera de 127.0.0.1, sin importar el puerto pedido', async () => {
    const { server } = startServer(0)
    try {
      expect(server.hostname).toBe('127.0.0.1')
    } finally {
      server.stop(true)
    }
  })
})

describe('L.2 — isSameOrigin rechaza CSRF entre apps locales de distinto puerto', () => {
  it('mismo host y mismo puerto → autorizado', async () => {
    const res = await route(mutatingReq(`http://localhost:${PORT}`), PORT)
    expect(res.status).not.toBe(403)
  })

  it('mismo host, 127.0.0.1 en vez de localhost, mismo puerto → autorizado', async () => {
    const res = await route(mutatingReq(`http://127.0.0.1:${PORT}`), PORT)
    expect(res.status).not.toBe(403)
  })

  it('mismo host, PUERTO DISTINTO (otra app local) → 403, no 200', async () => {
    const res = await route(mutatingReq(`http://localhost:9999`), PORT)
    expect(res.status).toBe(403)
  })

  it('origen remoto arbitrario → 403', async () => {
    const res = await route(mutatingReq('https://attacker.example'), PORT)
    expect(res.status).toBe(403)
  })

  it('PATCH también queda protegido por same-origin', async () => {
    const response = await route(
      new Request('http://localhost:50852/api/chat/sessions/example', {
        method: 'PATCH',
        headers: { Origin: 'http://localhost:3000' },
        body: JSON.stringify({ title: 'blocked' }),
      }),
      50852,
    )
    expect(response.status).toBe(403)
  })

  it('header Origin ausente (cliente no-navegador, ej. curl/CLI) → no bloqueado por origen', async () => {
    const res = await route(mutatingReq(undefined), PORT)
    expect(res.status).not.toBe(403)
  })

  it('GET no se filtra por origen (solo POST/PUT/PATCH/DELETE mutan)', async () => {
    const res = await route(
      new Request(`http://localhost:${PORT}/api/tasks`, {
        method: 'GET',
        headers: { origin: 'https://attacker.example' },
      }),
      PORT,
    )
    expect(res.status).not.toBe(403)
  })
})
