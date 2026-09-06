/**
 * G.4.2 — detección genérica de CLIs. Mismo patrón que engine-cascade.test.ts:
 * override directo de Bun.which, sin mock.module (ver
 * [[reference-bun-mock-module-gotcha]]).
 */
import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdtempSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  _resetCliCapabilityCache,
  detectInstalledClis,
  KNOWN_CLIS,
  provisionCliConfigHome,
  readBoundaryFor,
} from '../run/executors/cli-registry.ts'

const originalWhich = Bun.which

afterEach(() => {
  Bun.which = originalWhich
})

describe('detectInstalledClis()', () => {
  it('devuelve una entrada por cada CLI del registro, en el mismo orden', () => {
    ;(Bun as any).which = (_bin: string) => null
    const results = detectInstalledClis()
    expect(results).toHaveLength(KNOWN_CLIS.length)
    expect(results.map((r) => r.id)).toEqual(KNOWN_CLIS.map((d) => d.id))
  })

  it('binario presente → installed:true con el path real de Bun.which', () => {
    ;(Bun as any).which = (bin: string) => (bin === 'claude' ? '/usr/local/bin/claude' : null)
    const results = detectInstalledClis()
    const claude = results.find((r) => r.id === 'claude')!
    expect(claude.installed).toBe(true)
    expect(claude.path).toBe('/usr/local/bin/claude')
  })

  it('binario ausente → installed:false, path:null (nunca inventa una ruta)', () => {
    ;(Bun as any).which = (_bin: string) => null
    const results = detectInstalledClis()
    for (const r of results) {
      expect(r.installed).toBe(false)
      expect(r.path).toBeNull()
    }
  })

  it('detecta múltiples CLIs presentes a la vez, independientes entre sí', () => {
    ;(Bun as any).which = (bin: string) =>
      bin === 'claude' || bin === 'opencode' ? `/fake/${bin}` : null
    const results = detectInstalledClis()
    expect(results.find((r) => r.id === 'claude')!.installed).toBe(true)
    expect(results.find((r) => r.id === 'opencode')!.installed).toBe(true)
    expect(results.find((r) => r.id === 'codex')!.installed).toBe(false)
    expect(results.find((r) => r.id === 'kimi')!.installed).toBe(false)
  })

  it('kimi está en el registro aunque no tenga binario real hoy (sigue detectable cuando exista)', () => {
    expect(KNOWN_CLIS.some((d) => d.id === 'kimi')).toBe(true)
  })

  it('provisiona un home runtime dentro del proyecto, con instrucciones mínimas y settings propios', () => {
    const project = mkdtempSync(join(tmpdir(), 'orchestos-cli-home-'))
    const home = provisionCliConfigHome(project, 'claude')

    expect(home.path).toBe(join(project, '.orchestos', 'agent-home', 'claude'))
    expect(home.settingsPath).toBe(join(home.path, 'settings.json'))
    expect(existsSync(join(home.path, 'CLAUDE.md'))).toBe(true)
    expect(readFileSync(join(home.path, 'CLAUDE.md'), 'utf8')).not.toContain('MemoriesMD')
    // H.9.2 (reabierto 2026-09-06) — este assert exigía
    // `permissions.deny: ['Read(//*)']`. Ese patrón NO acotaba la lectura al
    // proyecto: bloqueaba todo, incluido el propio root (sonda 1, PLAN.md §
    // R.2-bis). El test pasaba porque comprobaba que el archivo se ESCRIBIERA,
    // no que la frontera FUNCIONARA — por eso el ítem se cerró roto. La frontera
    // real vive en los flags del spawn (external.ts); este settings queda vacío.
    expect(JSON.parse(readFileSync(home.settingsPath!, 'utf8'))).toEqual({})
  })

  it('declara frontera de lectura solo para Claude; los demás CLIs quedan en none', () => {
    expect(KNOWN_CLIS.find((cli) => cli.id === 'claude')?.readBoundary).toEqual({
      kind: 'project-root',
      mechanism: 'restricted-flag',
    })
    expect(KNOWN_CLIS.filter((cli) => cli.id !== 'claude').every((cli) => cli.readBoundary.kind === 'none')).toBe(true)
  })
})

// H.9.2 (reabierto 2026-09-06) — la frontera declarada es una intención; lo que
// importa es si el binario instalado la sostiene. Sonda inyectable, nunca spawn
// real dentro del test (misma regla que ToolchainProbe tras el incidente de CI
// del 2026-08-01: un test no debe afirmar sobre el PATH del host).
describe('H.9.2 — capability de frontera verificada contra el binario', () => {
  const claude = KNOWN_CLIS.find((c) => c.id === 'claude')!
  // Fragmento textual del `--help` real de Claude Code 2.1.263.
  const helpNuevo = `  --replay-user-messages   Re-emit user messages
  --restricted                          Restricted mode: removes the built-in
                                        tools that run commands or code
  --settings <file-or-json>             Path to a settings JSON file`
  const helpViejo = `  --replay-user-messages   Re-emit user messages
  --settings <file-or-json>             Path to a settings JSON file`

  beforeEach(() => _resetCliCapabilityCache())

  it('binario con --restricted → conserva la frontera project-root', () => {
    expect(readBoundaryFor(claude, () => helpNuevo)).toEqual({
      kind: 'project-root',
      mechanism: 'restricted-flag',
    })
  })

  it('binario SIN --restricted → degrada a none con motivo accionable (fail-closed)', () => {
    const boundary = readBoundaryFor(claude, () => helpViejo)
    expect(boundary.kind).toBe('none')
    expect((boundary as { reason: string }).reason).toContain('2.1.248')
  })

  it('binario ausente o que falla → degrada a none, nunca asume la capability', () => {
    expect(readBoundaryFor(claude, () => null).kind).toBe('none')
  })

  it('no confunde otro flag que contenga el texto con el flag real', () => {
    // Un `--help` que menciona "--restricted" solo dentro de una descripción no
    // acredita el flag: sin esto, cualquier texto suelto abriría la frontera.
    const mencionSuelta = '  --foo   Use this instead of --restricted mode\n'
    expect(readBoundaryFor(claude, () => mencionSuelta).kind).toBe('none')
  })

  it('cachea la sonda REAL, pero nunca una inyectada (un cache que ignora su entrada miente)', () => {
    // Bug encontrado en el gate en vivo del 2026-09-06: con cache indiscriminado,
    // simular un binario viejo devolvía `project-root` porque la llamada anterior
    // (sonda real) ya había cacheado `true` — la degradación fail-closed quedaba
    // silenciosamente desactivada.
    expect(readBoundaryFor(claude, () => helpNuevo).kind).toBe('project-root')
    expect(readBoundaryFor(claude, () => helpViejo).kind).toBe('none')
    expect(readBoundaryFor(claude, () => helpNuevo).kind).toBe('project-root')
  })

  it('un CLI sin frontera declarada no la gana por tener el binario nuevo', () => {
    const codex = KNOWN_CLIS.find((c) => c.id === 'codex')!
    expect(readBoundaryFor(codex, () => helpNuevo).kind).toBe('none')
  })
})
