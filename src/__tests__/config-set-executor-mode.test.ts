/**
 * G.4.4 — handleApiConfigSet(): validación y persistencia de `executorMode`.
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

describe('handleApiConfigSet — executorMode', () => {
  it('valor inválido → 400, no escribe nada (cwd real intacto)', async () => {
    const res = await handleApiConfigSet(req({ executorMode: 'not-a-real-mode' }))
    expect(res.status).toBe(400)
  })

  it('solo executorMode undefined y nada más → 400 "nothing to save"', async () => {
    const res = await handleApiConfigSet(req({}))
    expect(res.status).toBe(400)
  })

  it('executorMode válido → persiste en orchestos.config.yaml (dir temporal)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'orchestos-g44-cfgset-'))
    try {
      process.chdir(dir)
      const res = await handleApiConfigSet(req({ executorMode: 'cli-opencode' }))
      expect(res.status).toBe(200)
      const cfg = loadOrcheConfig(dir)
      expect(cfg.executor_mode).toBe('cli-opencode')
    } finally {
      process.chdir(originalCwd)
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('executorMode: null → limpia la preferencia guardada (vuelve a undefined)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'orchestos-g44-cfgset-clear-'))
    try {
      process.chdir(dir)
      await handleApiConfigSet(req({ executorMode: 'cli-claude' }))
      expect(loadOrcheConfig(dir).executor_mode).toBe('cli-claude')

      const res = await handleApiConfigSet(req({ executorMode: null }))
      expect(res.status).toBe(200)
      expect(loadOrcheConfig(dir).executor_mode).toBeUndefined()
    } finally {
      process.chdir(originalCwd)
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('no toca otros campos existentes del config al setear solo executorMode', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'orchestos-g44-cfgset-preserve-'))
    try {
      process.chdir(dir)
      await handleApiConfigSet(req({ executorEngine: 'agentic' }))
      const res = await handleApiConfigSet(req({ executorMode: 'api' }))
      expect(res.status).toBe(200)
      const cfg = loadOrcheConfig(dir)
      expect(cfg.executorEngine).toBe('agentic')
      expect(cfg.executor_mode).toBe('api')
    } finally {
      process.chdir(originalCwd)
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
