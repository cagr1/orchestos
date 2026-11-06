/**
 * CC.D1 — handleApiConfigSet(): validación y persistencia de `agent`.
 *
 * `handleApiConfigSet` resuelve el path de escritura con `resolve('.')`
 * (cwd), sin parámetro de root inyectable — mismo patrón que el resto de
 * handlers de config. Para no escribir jamás sobre el `orchestos.config.yaml`
 * REAL de este repo (rompería el routing del propio proyecto), los tests que
 * sí escriben usan `process.chdir()` a un directorio temporal, con
 * try/finally que SIEMPRE restaura el cwd — incluso si el assert falla.
 */
import { afterEach, describe, expect, it } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { parse as parseYaml } from 'yaml'
import { loadOrcheConfig } from '../config/load.ts'
import { handleApiConfigSet } from '../dashboard/handlers/config.ts'

function req(body: unknown): Request {
  return new Request('http://localhost/api/config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const originalCwd = process.cwd()
afterEach(() => process.chdir(originalCwd))

describe('handleApiConfigSet — agent', () => {
  it('Settings no resucita models en un YAML con los cuatro roles asignados', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'orchestos-cfg1-'))
    const roles = {
      executor: { agent: 'codex', model: 'executor-model', effort: 'medium' },
      auxiliary: { agent: 'codex', model: 'auxiliary-model' },
      orchestrator: { agent: 'claude', model: 'orchestrator-model' },
      reviewer: { agent: 'claude', model: 'reviewer-model' },
    }
    try {
      const path = join(dir, 'orchestos.config.yaml')
      writeFileSync(path, JSON.stringify({ config_version: 1, roles }))
      for (const body of [
        { roleAssignments: roles },
        { roles: { planner: 'legacy-planner', qa: 'legacy-qa' }, externalTimeoutMinutes: 25 },
      ]) {
        const res = await handleApiConfigSet(req(body), dir)
        expect(res.status).toBe(200)
        const saved = parseYaml(readFileSync(path, 'utf8'))
        expect(saved).not.toHaveProperty('models')
        expect(saved.roles).toEqual(roles)
        expect(loadOrcheConfig(dir).roles).toEqual(roles)
      }
      expect(loadOrcheConfig(dir).external?.timeoutMs).toBe(25 * 60000)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('Settings sigue actualizando models cuando el YAML legacy ya lo contiene', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'orchestos-cfg1-legacy-'))
    try {
      const path = join(dir, 'orchestos.config.yaml')
      writeFileSync(path, 'models:\n  planner: { provider: openrouter, model: old }\n')
      const res = await handleApiConfigSet(req({ roles: { planner: 'new' } }), dir)
      expect(res.status).toBe(200)
      expect(loadOrcheConfig(dir).models.planner?.model).toBe('new')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('valor inválido → 400, no escribe nada (cwd real intacto)', async () => {
    const res = await handleApiConfigSet(req({ agent: 'not-a-real-agent' }))
    expect(res.status).toBe(400)
  })

  it('body vacío → 400 "nothing to save"', async () => {
    const res = await handleApiConfigSet(req({}))
    expect(res.status).toBe(400)
  })

  it('agent válido → persiste en orchestos.config.yaml (dir temporal)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'orchestos-ccd1-cfgset-'))
    try {
      process.chdir(dir)
      const res = await handleApiConfigSet(req({ agent: 'opencode' }))
      expect(res.status).toBe(200)
      const cfg = loadOrcheConfig(dir)
      expect(cfg.agent).toBe('opencode')
    } finally {
      process.chdir(originalCwd)
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('agent: null → limpia la preferencia guardada (vuelve a undefined)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'orchestos-ccd1-cfgset-clear-'))
    try {
      process.chdir(dir)
      await handleApiConfigSet(req({ agent: 'claude' }))
      expect(loadOrcheConfig(dir).agent).toBe('claude')

      const res = await handleApiConfigSet(req({ agent: null }))
      expect(res.status).toBe(200)
      expect(loadOrcheConfig(dir).agent).toBeUndefined()
    } finally {
      process.chdir(originalCwd)
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('no toca otros campos existentes del config al setear solo agent', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'orchestos-ccd1-cfgset-preserve-'))
    try {
      process.chdir(dir)
      await handleApiConfigSet(req({ apiMode: 'agentic' }))
      const res = await handleApiConfigSet(req({ agent: 'api' }))
      expect(res.status).toBe(200)
      const cfg = loadOrcheConfig(dir)
      expect(cfg.apiMode).toBe('agentic')
      expect(cfg.agent).toBe('api')
    } finally {
      process.chdir(originalCwd)
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('PUT no relacionado preserva campos legacy y desconocidos del YAML', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'orchestos-ccd1c-legacy-preserve-'))
    try {
      process.chdir(dir)
      writeFileSync(
        join(dir, 'orchestos.config.yaml'),
        [
          '# fixture legacy: no debe migrarse por un PUT ajeno',
          'config_version: 1',
          'executor_mode: cli-claude',
          'executorEngine: external',
          'customField: preserve-me',
          'models:',
          '  default: { provider: openrouter, model: old-model }',
        ].join('\n') + '\n',
        'utf8',
      )

      const res = await handleApiConfigSet(req({ apiMode: 'agentic' }))
      expect(res.status).toBe(200)

      const saved = readFileSync(join(dir, 'orchestos.config.yaml'), 'utf8')
      expect(saved).toContain('# fixture legacy: no debe migrarse por un PUT ajeno')
      expect(saved).toContain('executor_mode: cli-claude')
      expect(saved).toContain('executorEngine: external')
      expect(saved).toContain('customField: preserve-me')
      expect(loadOrcheConfig(dir).agent).toBe('claude')
      expect(loadOrcheConfig(dir).apiMode).toBe('agentic')
    } finally {
      process.chdir(originalCwd)
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('PUT explícito de agent sí retira sus aliases legacy', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'orchestos-ccd1c-legacy-migrate-'))
    try {
      process.chdir(dir)
      writeFileSync(
        join(dir, 'orchestos.config.yaml'),
        [
          'config_version: 1',
          'executor_mode: cli-claude',
          'executorEngine: external',
          'models:',
          '  default: { provider: openrouter, model: old-model }',
        ].join('\n') + '\n',
        'utf8',
      )

      const res = await handleApiConfigSet(req({ agent: 'api' }))
      expect(res.status).toBe(200)

      const saved = readFileSync(join(dir, 'orchestos.config.yaml'), 'utf8')
      expect(saved).toContain('agent: api')
      expect(saved).not.toContain('executor_mode:')
      expect(saved).not.toContain('executorEngine:')
    } finally {
      process.chdir(originalCwd)
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
