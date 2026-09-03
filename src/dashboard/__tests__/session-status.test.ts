import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { route } from '../server.ts'

const PORT = 4257
const originalTranscript = process.env.ORCHESTOS_SESSION_TRANSCRIPT
const roots: string[] = []

afterEach(() => {
  if (originalTranscript === undefined) delete process.env.ORCHESTOS_SESSION_TRANSCRIPT
  else process.env.ORCHESTOS_SESSION_TRANSCRIPT = originalTranscript
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('H.7.5 — GET /api/session/status', () => {
  test('expone contexto y cupo normalizados sin filtrar la ruta del transcript', async () => {
    const root = mkdtempSync(join(tmpdir(), 'orchestos-h75-api-'))
    roots.push(root)
    const transcript = join(root, 'codex.jsonl')
    writeFileSync(
      transcript,
      `${JSON.stringify({ payload: { type: 'token_count', model: 'gpt-test', info: { last_token_usage: { total_tokens: 60 }, model_context_window: 100 }, rate_limits: { primary: { used_percent: 44, window_minutes: 300, resets_at: 1_788_460_888 } } } })}\n`,
    )
    process.env.ORCHESTOS_SESSION_TRANSCRIPT = transcript

    const response = await route(new Request(`http://localhost:${PORT}/api/session/status`), PORT)
    expect(response.status).toBe(200)
    const body = (await response.json()) as Record<string, unknown>
    expect(body.available).toBe(true)
    const codex = (body.clis as Array<Record<string, unknown>>).find((cli) => cli.id === 'codex')
    expect(codex).toMatchObject({ id: 'codex', available: true, context: { source: 'codex', pct: 60, level: 'warn' }, rateLimits: { source: 'codex', windows: [{ id: 'primary', usedPct: 44, windowMinutes: 300 }] } })
    expect(JSON.stringify(body)).not.toContain(transcript)
  })

  test('sin transcript devuelve un estado vacío explícito, no error ni 0%', async () => {
    const root = mkdtempSync(join(tmpdir(), 'orchestos-h75-api-'))
    roots.push(root)
    process.env.ORCHESTOS_SESSION_TRANSCRIPT = join(root, 'missing.jsonl')

    const response = await route(new Request(`http://localhost:${PORT}/api/session/status`), PORT)
    expect(response.status).toBe(200)
    const body = await response.json() as { available: boolean; clis: Array<{ available: boolean; context: unknown; rateLimits: unknown }> }
    expect(body.available).toBe(false)
    expect(body.clis.length).toBeGreaterThan(0)
    expect(body.clis.every((cli) => !cli.available && cli.context === null && cli.rateLimits === null)).toBe(true)
  })
})
