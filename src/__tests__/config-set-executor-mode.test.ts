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
import { describe, it, expect, afterEach } from 'bun:test'
import { mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { handleApiConfigSet } from '../dashboard/handlers/config.ts'
import { loadOrcheConfig } from '../config/load.ts'

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
})
