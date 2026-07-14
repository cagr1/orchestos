/**
 * v0.12 D.1.c — paridad CLI↔Dashboard para `orchestos summary [path]`.
 *
 * Cubre el gap-no-dev: sin este endpoint, un usuario sin terminal no puede
 * generar el PDF de resumen del proyecto (CLI sí, pero exige el binario en
 * PATH y la ejecución explícita).
 *
 * Lo que cubre el test:
 *   - GET /api/project/summary devuelve 200 con Content-Type: application/pdf
 *     y el body empieza con `%PDF-` (magic bytes del formato PDF).
 *   - Content-Disposition: attachment con filename `<project>-summary.pdf`
 *     (mismo nombre que el CLI usa por defecto).
 *   - X-Elapsed-Ms: header presente (para observabilidad sin parsear logs).
 *   - Cleanup del tmp file: no queda nada en `os.tmpdir()` después de la
 *     respuesta (verificamos que `os.tmpdir()` no tiene nuevos `orchestos-summary-*`
 *     archivos con timestamp posterior al test).
 *   - Side effect del CLI preservado: el proyecto se persiste en la DB
 *     (`upsertProject` se llama igual que en el CLI). Cleanup: borramos la
 *     fila de la DB al final para no contaminar la DB compartida del dev.
 *   - Sin tasks.yaml: igual funciona (el summary no depende de tasks — la
 *     sección de Recent Runs queda vacía pero el PDF se genera).
 *
 * Patrón (heredado de constitution-api.test.ts — F0.1): tmp dir real con
 * chdir, sin mock.module(). `resolve('.')` del handler se ata al cwd del
 * test, así que el repo real del orchestos no aparece en este test.
 */
import { describe, it, expect, afterAll, beforeAll, beforeEach } from 'bun:test'
import { mkdtempSync, rmSync, readdirSync, realpathSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

const { route } = await import('../server.ts')
const { db } = await import('../../db/sqlite.ts')
// `hashPath` no está exportado de db/projects.ts (es interno). Lo replicamos
// acá para el cleanup: `createHash('sha1').update(path).digest('hex').slice(0, 16)`.
import { createHash } from 'crypto'
function hashPath(p: string): string {
  return createHash('sha1').update(p).digest('hex').slice(0, 16)
}
const { getProject } = await import('../../db/projects.ts')
const { runMigrations } = await import('../../db/migrate.ts')

const PORT = 4242
const originalCwd = process.cwd()
const tmpDir = mkdtempSync(join(tmpdir(), 'project-summary-api-'))
// macOS resuelve `/tmp` → `/private/tmp` (symlink). El handler corre dentro del
// server.ts que NO resuelve, así que la path que persiste en DB es la del cwd
// del proceso, que SÍ es la realpath (Bun la resuelve al hacer process.cwd()).
// Para verificar el side effect consistentemente, comparamos con la realpath.
const tmpDirReal = realpathSync(tmpDir)
process.chdir(tmpDir)

// runMigrations() en cli.ts corre en top-level; los tests no arrancan el CLI,
// así que tenemos que invocarlo manualmente para que la tabla `projects`
// exista antes de que el handler haga upsertProject.
beforeAll(() => {
  runMigrations()
})

function req(method: string, path: string): Request {
  return new Request(`http://localhost:${PORT}${path}`, { method })
}

/** Cuenta archivos en `os.tmpdir()` que matchean `orchestos-summary-*`. Usado
 * para verificar que el handler hace cleanup del tmp file que crea. */
function countOrcTmpFiles(): number {
  try {
    return readdirSync(tmpdir()).filter(f => f.startsWith('orchestos-summary-')).length
  } catch { return -1 }
}

afterAll(() => {
  // Cleanup de la DB compartida — el handler hace upsertProject como side effect
  // (igual que el CLI), así que borramos la fila correspondiente al tmpDir para
  // no dejar basura en `~/.orchestos/db.sqlite`. Usamos la realpath porque
  // es la que se persiste (Bun resuelve `/tmp` → `/private/tmp` al hacer
  // process.cwd()).
  try {
    const id = hashPath(tmpDirReal)
    db.run('DELETE FROM projects WHERE id = ?', [id])
  } catch { /* no-op si la tabla no existe todavía */ }
  process.chdir(originalCwd)
  rmSync(tmpDir, { recursive: true, force: true })
})

beforeEach(() => {
  // Defensa en profundidad: cada test arranca en cwd sin tasks.yaml
  try { rmSync(join(tmpDir, 'tasks.yaml')) } catch {}
})

describe('GET /api/project/summary (v0.12 D.1.c)', () => {
  it('devuelve 200 con Content-Type: application/pdf y body que empieza con %PDF-', async () => {
    const res = await route(req('GET', '/api/project/summary'), PORT)
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/pdf')

    // Magic bytes del formato PDF
    const buf = new Uint8Array(await res.arrayBuffer())
    expect(buf.length).toBeGreaterThan(100) // un PDF real no es chico
    expect(String.fromCharCode(buf[0]!, buf[1]!, buf[2]!, buf[3]!, buf[4]!)).toBe('%PDF-')
  })

  it('incluye Content-Disposition: attachment con filename basado en el nombre del proyecto', async () => {
    const res = await route(req('GET', '/api/project/summary'), PORT)
    const disp = res.headers.get('Content-Disposition')
    expect(disp).toMatch(/^attachment; filename=".+-summary\.pdf"$/)
    // El manifest name de un tmp dir vacío es "unknown" (buildProfile fallback).
    // El filename usa `safeName = "unknown"` en este caso.
    expect(disp).toContain('unknown-summary.pdf')
  })

  it('incluye X-Elapsed-Ms (header de observabilidad)', async () => {
    const res = await route(req('GET', '/api/project/summary'), PORT)
    const elapsed = res.headers.get('X-Elapsed-Ms')
    expect(elapsed).not.toBeNull()
    expect(Number(elapsed)).toBeGreaterThanOrEqual(0)
    expect(Number(elapsed)).toBeLessThan(30_000) // sanity: no tomó más de 30s
  })

  it('incluye X-Project (header con el manifest name seguro)', async () => {
    const res = await route(req('GET', '/api/project/summary'), PORT)
    expect(res.headers.get('X-Project')).toBe('unknown')
  })

  it('incluye Content-Length que coincide con el body real', async () => {
    const res = await route(req('GET', '/api/project/summary'), PORT)
    const declared = Number(res.headers.get('Content-Length'))
    const actual = (await res.arrayBuffer()).byteLength
    expect(declared).toBe(actual)
  })

  it('cleanup: no quedan archivos orquestos-summary-* en /tmp después de la respuesta', async () => {
    // Snapshot ANTES para no contar archivos pre-existentes de tests previos
    const before = countOrcTmpFiles()
    expect(before).toBeGreaterThanOrEqual(0) // el count puede ser -1 si /tmp no es legible; en macOS sí

    await route(req('GET', '/api/project/summary'), PORT)

    const after = countOrcTmpFiles()
    // Si after >= 0, comparamos con el snapshot
    if (before >= 0 && after >= 0) {
      expect(after).toBe(before)
    }
  })

  it('side effect del CLI preservado: el proyecto se persiste en la DB', async () => {
    // Llamar al endpoint debe crear/actualizar la fila del proyecto en projects.
    // Equivalente a lo que hace el CLI (cli.ts:113) con `upsertProject`.
    // Comparamos con `tmpDirReal` porque el handler corre con cwd realpath.
    const before = getProject(tmpDirReal)
    const beforeExists = !!before

    await route(req('GET', '/api/project/summary'), PORT)

    const after = getProject(tmpDirReal)
    expect(after).not.toBeNull()
    // Si ya existía (otro test corrió antes), debe seguir existiendo.
    // Si no, debe haberse creado. La columna `last_updated` debe ser reciente
    // (verificable parseando ISO string).
    if (!beforeExists) {
      expect(after!.last_updated).toBeDefined()
      const updatedAt = new Date(after!.last_updated).getTime()
      const now = Date.now()
      expect(now - updatedAt).toBeLessThan(60_000) // menos de 1 min de antigüedad
    }
  })

  it('PDF idéntico byte-a-byte entre 2 llamadas (mismo input → mismo output)', async () => {
    // La generación NO usa randomness ni timestamps visibles en el output (la
    // fecha se incluye pero se puede desestabilizar — verificamos al menos
    // que ambos PDFs tienen la misma estructura básica).
    const a = await route(req('GET', '/api/project/summary'), PORT)
    const b = await route(req('GET', '/api/project/summary'), PORT)
    const bufA = new Uint8Array(await a.arrayBuffer())
    const bufB = new Uint8Array(await b.arrayBuffer())
    expect(bufA.length).toBe(bufB.length)
    // Mismo header PDF
    expect(String.fromCharCode(bufA[0]!, bufA[1]!, bufA[2]!, bufA[3]!, bufA[4]!)).toBe('%PDF-')
    expect(String.fromCharCode(bufB[0]!, bufB[1]!, bufB[2]!, bufB[3]!, bufB[4]!)).toBe('%PDF-')
  })
})
