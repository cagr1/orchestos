/**
 * G.4.2 — detección genérica de CLIs. Mismo patrón que engine-cascade.test.ts:
 * override directo de Bun.which, sin mock.module (ver
 * [[reference-bun-mock-module-gotcha]]).
 */
import { afterEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdtempSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  detectInstalledClis,
  KNOWN_CLIS,
  provisionCliConfigHome,
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
    expect(JSON.parse(readFileSync(home.settingsPath!, 'utf8'))).toEqual({
      permissions: { deny: ['Read(//*)'] },
    })
  })

  it('declara frontera de lectura solo para Claude; los demás CLIs quedan en none', () => {
    expect(KNOWN_CLIS.find((cli) => cli.id === 'claude')?.readBoundary).toEqual({ kind: 'project-root' })
    expect(KNOWN_CLIS.filter((cli) => cli.id !== 'claude').every((cli) => cli.readBoundary.kind === 'none')).toBe(true)
  })
})
