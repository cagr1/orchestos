/**
 * I.3 (Mes 30, 2026-09-04) — parseo defensivo de `taskAgentRules` en
 * orchestos.config.yaml (config/load.ts). Mismo criterio que el resto del
 * archivo: una entrada mal formada se descarta con aviso, nunca rompe la
 * carga del config entero ni infiere un `agent` inválido desde basura YAML.
 */
import { afterEach, describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { loadOrcheConfig } from '../config/load.ts'

const dirs: string[] = []
function tmpProject(yaml: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'orchestos-i3-rules-'))
  writeFileSync(join(dir, 'orchestos.config.yaml'), yaml)
  dirs.push(dir)
  return dir
}

afterEach(() => {
  while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true })
})

describe('loadOrcheConfig — taskAgentRules', () => {
  it('sin el campo → undefined, no rompe la carga del resto del config', () => {
    const dir = tmpProject('config_version: 1\nagent: claude\n')
    const cfg = loadOrcheConfig(dir)
    expect(cfg.taskAgentRules).toBeUndefined()
    expect(cfg.agent).toBe('claude')
  })

  it('reglas válidas (output y skill) se parsean tal cual', () => {
    const dir = tmpProject(`
config_version: 1
taskAgentRules:
  - match:
      output: ["apps/api/**"]
    agent: codex
  - match:
      skill: frontend-design
    agent: claude
    cli_effort: high
`)
    const cfg = loadOrcheConfig(dir)
    expect(cfg.taskAgentRules).toEqual([
      { match: { output: ['apps/api/**'], skill: undefined }, agent: 'codex', cli_effort: undefined },
      { match: { output: undefined, skill: 'frontend-design' }, agent: 'claude', cli_effort: 'high' },
    ])
  })

  it('agent inválido en una regla → esa regla se descarta, las demás sobreviven', () => {
    const dir = tmpProject(`
config_version: 1
taskAgentRules:
  - match: { output: ["apps/api/**"] }
    agent: not-a-real-agent
  - match: { skill: frontend-design }
    agent: claude
`)
    const cfg = loadOrcheConfig(dir)
    expect(cfg.taskAgentRules).toEqual([{ match: { output: undefined, skill: 'frontend-design' }, agent: 'claude', cli_effort: undefined }])
  })

  it('match vacío (ni output ni skill) → la regla se descarta', () => {
    const dir = tmpProject(`
config_version: 1
taskAgentRules:
  - match: {}
    agent: claude
`)
    const cfg = loadOrcheConfig(dir)
    expect(cfg.taskAgentRules).toBeUndefined()
  })

  it('array vacío → undefined, no un array vacío que otros consumidores tengan que chequear dos veces', () => {
    const dir = tmpProject('config_version: 1\ntaskAgentRules: []\n')
    const cfg = loadOrcheConfig(dir)
    expect(cfg.taskAgentRules).toBeUndefined()
  })
})
