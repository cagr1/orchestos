/**
 * v0.12 D.1.b — paridad CLI↔Dashboard para `orchestos constitution init`.
 *
 * Antes de D.1.b: GET devolvía `{ content: '' }` cuando CONSTITUTION.md no existía,
 * y el editor del dashboard arrancaba con un textarea vacío — un no-dev sin
 * familiaridad con el formato terminaba escribiendo cualquier cosa (o nada) y
 * el archivo nunca se creaba hasta la primera edición.
 *
 * Después de D.1.b: GET devuelve el contenido de `scaffoldConstitutionMd()` (mismo
 * string que `constitution init` en CLI) con `exists:false`; el primer PUT
 * materializa el archivo en disco.
 *
 * Patrón: tmp dir real con chdir, sin mock.module() (mismo que
 * tasks-api-engine.test.ts / run-graph-api.test.ts). El handler hace `resolve('.')`,
 * así que el cwd del test es el cwd del handler — crítico que el CONSTITUTION.md
 * del repo REAL nunca aparezca en este test (de ahí el tmp dir).
 */
import { describe, it, expect, afterAll, beforeEach } from 'bun:test'
import { mkdtempSync, writeFileSync, rmSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

const { route } = await import('../server.ts')
const { scaffoldConstitutionMd } = await import('../../spec/constitution.ts')

const PORT = 4242
const originalCwd = process.cwd()
const tmpDir = mkdtempSync(join(tmpdir(), 'constitution-api-'))
process.chdir(tmpDir)

function req(method: string, path: string, body?: unknown): Request {
  return new Request(`http://localhost:${PORT}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

afterAll(() => {
  process.chdir(originalCwd)
  rmSync(tmpDir, { recursive: true, force: true })
})

beforeEach(() => {
  // Garantiza un cwd sin CONSTITUTION.md entre tests (el afterAll lo borra al final,
  // pero `mkdtempSync` ya es un dir vacío — este beforeEach es defensa en profundidad
  // por si un test previo deja un archivo persistido por error).
  const p = join(tmpDir, 'CONSTITUTION.md')
  if (existsSync(p)) rmSync(p)
})

describe('GET /api/project/constitution (v0.12 D.1.b)', () => {
  it('returns scaffold content with exists:false when CONSTITUTION.md is missing', async () => {
    const res = await route(req('GET', '/api/project/constitution'), PORT)
    expect(res.status).toBe(200)
    const data = await res.json() as { content: string; exists: boolean }
    expect(data.exists).toBe(false)
    expect(data.content).toBe(scaffoldConstitutionMd())
    // Cierra el riesgo: el scaffold pre-cargado coincide 1:1 con el del CLI
    // (paridad real, no una variante paralela que se desincronice en silencio).
    expect(data.content).toMatch(/^##\s+ALLOWED$/m)
    expect(data.content).toMatch(/^##\s+FORBIDDEN$/m)
    expect(data.content).toMatch(/^##\s+REQUIRE_CONFIRMATION$/m)
  })

  it('returns real content with exists:true when CONSTITUTION.md exists', async () => {
    const custom = '# Custom\n## ALLOWED\n- do thing X\n'
    writeFileSync(join(tmpDir, 'CONSTITUTION.md'), custom, 'utf-8')
    const res = await route(req('GET', '/api/project/constitution'), PORT)
    expect(res.status).toBe(200)
    const data = await res.json() as { content: string; exists: boolean }
    expect(data.exists).toBe(true)
    expect(data.content).toBe(custom)
  })
})

describe('PUT /api/project/constitution (v0.12 D.1.b)', () => {
  it('creates the file from the scaffold (parity with `constitution init`)', async () => {
    const scaffold = scaffoldConstitutionMd()
    const res = await route(req('PUT', '/api/project/constitution', { content: scaffold }), PORT)
    expect(res.status).toBe(200)
    const data = await res.json() as { ok: boolean }
    expect(data.ok).toBe(true)
    // Verificación de disco — el autosave del dashboard debe materializar el
    // archivo, no solo pretender que lo guardó.
    const onDisk = readFileSync(join(tmpDir, 'CONSTITUTION.md'), 'utf-8')
    expect(onDisk).toBe(scaffold)
  })

  it('rejects non-string content with 400', async () => {
    const res = await route(req('PUT', '/api/project/constitution', { content: 42 }), PORT)
    expect(res.status).toBe(400)
  })

  it('rejects invalid JSON with 400', async () => {
    const r = new Request(`http://localhost:${PORT}/api/project/constitution`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json{',
    })
    const res = await route(r, PORT)
    expect(res.status).toBe(400)
  })
})
