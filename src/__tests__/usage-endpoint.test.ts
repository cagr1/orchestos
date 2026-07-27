/**
 * H.1 — GET /api/usage. Handler delegado a Codex (backend, mecánico,
 * cuidando cupo de Claude), tests escritos aparte tras revisar el diff.
 * Corre contra la DB real del proceso de test (misma que usa el resto de la
 * suite vía src/db/sqlite.ts) — no se sembraron filas nuevas, solo se
 * verifica el shape/tipo de la respuesta y la aritmética de los totales
 * contra las filas que la propia respuesta reporta (no un número fijo,
 * porque la DB de test comparte estado con otros archivos de la suite).
 */
import { describe, it, expect } from 'bun:test'
import { handleApiUsage } from '../dashboard/handlers/usage.ts'

describe('GET /api/usage', () => {
  it('devuelve el shape esperado, nunca lanza', async () => {
    const res = await handleApiUsage()
    expect(res.status).toBe(200)
    const data = await res.json() as { byDayModel: unknown[]; totalUsd: number; totalRuns: number }
    expect(Array.isArray(data.byDayModel)).toBe(true)
    expect(typeof data.totalUsd).toBe('number')
    expect(typeof data.totalRuns).toBe('number')
  })

  it('cada fila de byDayModel tiene los 6 campos con los tipos correctos, nunca null', async () => {
    const res = await handleApiUsage()
    const data = await res.json() as { byDayModel: Array<Record<string, unknown>> }
    for (const row of data.byDayModel) {
      expect(typeof row.date).toBe('string')
      expect(typeof row.model).toBe('string')
      expect(typeof row.usd).toBe('number')
      expect(typeof row.runs).toBe('number')
      expect(typeof row.inputTokens).toBe('number')
      expect(typeof row.outputTokens).toBe('number')
      expect(row.usd).not.toBeNull()
    }
  })

  it('totalUsd y totalRuns son la suma exacta de las filas de byDayModel', async () => {
    const res = await handleApiUsage()
    const data = await res.json() as { byDayModel: Array<{ usd: number; runs: number }>; totalUsd: number; totalRuns: number }
    const sumUsd = data.byDayModel.reduce((t, r) => t + r.usd, 0)
    const sumRuns = data.byDayModel.reduce((t, r) => t + r.runs, 0)
    expect(data.totalUsd).toBeCloseTo(sumUsd, 9)
    expect(data.totalRuns).toBe(sumRuns)
  })

  it('runs de cada fila es siempre > 0 (GROUP BY nunca produce grupos vacíos)', async () => {
    const res = await handleApiUsage()
    const data = await res.json() as { byDayModel: Array<{ runs: number }> }
    for (const row of data.byDayModel) {
      expect(row.runs).toBeGreaterThan(0)
    }
  })
})
