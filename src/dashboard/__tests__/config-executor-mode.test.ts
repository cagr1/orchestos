/**
 * CC.1b bugfix (2026-08-17) — GET /api/config nunca devolvía `executor_mode`.
 * Bug real encontrado por Carlos: reinició el dashboard varias veces y el
 * selector de esfuerzo del chat seguía mostrando 3 niveles en vez de 5 —
 * `buildChatModelFx` (frontend) depende de este endpoint para saber el modo
 * activo, y ese campo faltaba en la respuesta desde siempre. El PUT (mismo
 * archivo) sí lo escribía al YAML; el GET no lo leía de vuelta. El label de la
 * respuesta del chat SÍ reflejaba el CLI porque ese código lee
 * `loadOrcheConfig()` directo en el servidor, sin pasar por este endpoint —
 * por eso el síntoma era confuso (una parte funcionaba, otra no).
 *
 * CC.D1 (2026-08-17) — el campo se renombró a `agent` (consolidación
 * executor_mode/executorEngine → agent/apiMode, ver PLAN.md § CC.D). Los
 * nombres de los tests conservan "executor_mode" porque documentan el bug
 * original; las aserciones usan el nombre de campo real, `agent`.
 *
 * Mismo patrón que constitution-api.test.ts / specs-design-gate.test.ts: tmp
 * dir + chdir + route() real, sin mock.module().
 */
import { afterAll, describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

const { route } = await import('../server.ts')

const PORT = 4242
const originalCwd = process.cwd()
const tmpDir = mkdtempSync(join(tmpdir(), 'config-executor-mode-'))
process.chdir(tmpDir)

afterAll(() => {
  process.chdir(originalCwd)
  rmSync(tmpDir, { recursive: true, force: true })
})

function req(method: string, path: string): Request {
  return new Request(`http://localhost:${PORT}${path}`, { method })
}

describe('GET /api/config — agent (CC.1b bugfix)', () => {
  it('devuelve agent cuando está fijado en orchestos.config.yaml (vía legacy executor_mode)', async () => {
    writeFileSync(
      join(tmpDir, 'orchestos.config.yaml'),
      [
        'config_version: 1',
        'executor_mode: cli-claude',
        'models:',
        '  default: { provider: openrouter, model: deepseek/deepseek-v4-flash }',
      ].join('\n'),
    )

    const res = await route(req('GET', '/api/config'), PORT)
    expect(res.status).toBe(200)
    const data = (await res.json()) as { agent: string | null }
    expect(data.agent).toBe('claude')
  })

  it('devuelve null (no undefined ni ausente) cuando no está fijado — spec simple, cero regresión', async () => {
    writeFileSync(
      join(tmpDir, 'orchestos.config.yaml'),
      [
        'config_version: 1',
        'models:',
        '  default: { provider: openrouter, model: deepseek/deepseek-v4-flash }',
      ].join('\n'),
    )

    const res = await route(req('GET', '/api/config'), PORT)
    const data = (await res.json()) as { agent: string | null }
    expect(data.agent).toBeNull()
    expect('agent' in data).toBe(true)
  })
})
