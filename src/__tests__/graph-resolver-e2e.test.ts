/**
 * S (Mes 26, 2026-08-06) — regresión del bug real encontrado al investigar
 * IDEAS.md #5 (Ruby resolver): `indexProject()` resolvía edges en el mismo
 * pase en que insertaba archivos, así que cualquier import a un archivo que
 * ordenara alfabéticamente DESPUÉS en el glob quedaba con `to_file_id: null`
 * para siempre (un archivo sin cambios nunca vuelve a pasar por el cálculo
 * de edges). Verificado en vivo antes del fix con los fixtures reales de
 * tests/fixtures/graph/: 0/2 Rust, 0/3 C#, 0/1 Go, 1/3 Java, 0/1 JS/TS
 * resueltos — no era específico de un lenguaje.
 *
 * Dos bugs más, independientes, encontrados en el camino:
 * - rust.ts / csharp.ts se registraban como `language: 'rust'`/`'csharp'`,
 *   pero `languageFor()` (extensión de archivo) produce `'rs'`/`'cs'` — el
 *   registry nunca los encontraba.
 * - rust.ts comparaba `importStr` (= `edge.specifier`, YA sin el prefijo
 *   `use `) contra el string CON el prefijo (`'use crate::'`) — nunca podía
 *   matchear, para ningún input.
 *
 * Estos tests usan los fixtures REALES del repo contra `indexProject()`
 * completo, no mocks del resolver — es el pipeline end-to-end que faltaba.
 */

import { afterEach, describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { runMigrations } from '../db/migrate.ts'
import { db } from '../db/sqlite.ts'
import { indexProject } from '../graph/index.ts'

runMigrations()

let pid: string
const usedPids: string[] = []

afterEach(() => {
  for (const p of usedPids) {
    db.exec(`DELETE FROM code_edges WHERE project_id = '${p}'`)
    db.exec(`DELETE FROM files      WHERE project_id = '${p}'`)
  }
  usedPids.length = 0
})

function newPid(): string {
  pid = 'graph-e2e-' + Math.random().toString(36).slice(2, 10)
  usedPids.push(pid)
  return pid
}

async function resolvedEdges(root: string, id: string) {
  await indexProject(root, id, { noEmbed: true })
  return db
    .query<{ raw: string; to_path: string; to_file_id: number | null }, string>(
      `SELECT e.raw, e.to_path, e.to_file_id
     FROM code_edges e JOIN files f ON f.id = e.from_file_id
     WHERE f.project_id = ?`,
    )
    .all(id)
}

const FIXTURES = join(import.meta.dir, '..', '..', 'tests', 'fixtures', 'graph')

describe('resoluciones cross-file end-to-end contra los fixtures reales', () => {
  it('Rust: use crate::X::Y resuelve al archivo real', async () => {
    const id = newPid()
    const edges = await resolvedEdges(join(FIXTURES, 'rust'), id)
    expect(edges.length).toBeGreaterThan(0)
    expect(edges.every((e) => e.to_file_id !== null)).toBe(true)
  })

  it('C#: using Namespace resuelve al archivo real', async () => {
    const id = newPid()
    const edges = await resolvedEdges(join(FIXTURES, 'csharp'), id)
    expect(edges.length).toBeGreaterThan(0)
    expect(edges.every((e) => e.to_file_id !== null)).toBe(true)
  })

  it('Go: import "module/pkg" resuelve al archivo real', async () => {
    const id = newPid()
    const edges = await resolvedEdges(join(FIXTURES, 'go'), id)
    expect(edges.length).toBeGreaterThan(0)
    expect(edges.every((e) => e.to_file_id !== null)).toBe(true)
  })

  it('Java: import paquete.Clase resuelve al archivo real', async () => {
    const id = newPid()
    const edges = await resolvedEdges(join(FIXTURES, 'java'), id)
    expect(edges.length).toBeGreaterThan(0)
    expect(edges.every((e) => e.to_file_id !== null)).toBe(true)
  })

  // S.2 (Mes 26, 2026-08-06) — rubyResolver nuevo, sobre la base que S.1 arregló.
  it('Ruby: require_relative (con y sin ./) resuelve, require de gema externa no inventa un match', async () => {
    const id = newPid()
    const edges = await resolvedEdges(join(FIXTURES, 'ruby'), id)
    const byRaw = Object.fromEntries(edges.map((e) => [e.raw, e.to_file_id]))

    expect(byRaw["require_relative './helper'"]).not.toBeNull()
    // require_relative sin `./` explícito sigue siendo relativo por semántica
    // del lenguaje — extractRubyImports() lo normaliza en la extracción.
    expect(byRaw["require_relative 'other_helper'"]).not.toBeNull()
    // Convención de $LOAD_PATH vía lib/ — best-effort, no garantizado por el
    // lenguaje, pero es el layout real más común.
    expect(byRaw["require 'lib/service'"]).not.toBeNull()
    // 'json' es la librería estándar — no hay archivo local, y el resolver no
    // debe inventar un candidato falso. null es el resultado CORRECTO acá.
    expect(byRaw["require 'json'"]).toBeNull()
  })
})

describe('regresión del bug de orden — independiente de qué archivo llegue primero al glob', () => {
  function tmpProject(): string {
    return mkdtempSync(join(tmpdir(), 'orchestos-graph-order-'))
  }

  it('un archivo que ordena PRIMERO alfabéticamente puede importar uno que ordena DESPUÉS', async () => {
    const dir = tmpProject()
    try {
      // a-first.ts se procesa antes que z-second.ts en el glob ordenado —
      // exactamente el caso que rompía antes del fix de dos pasadas.
      writeFileSync(join(dir, 'a-first.ts'), `import { helper } from './z-second.ts'\nhelper()\n`)
      writeFileSync(join(dir, 'z-second.ts'), `export function helper() {}\n`)

      const id = newPid()
      const edges = await resolvedEdges(dir, id)
      const edge = edges.find((e) => e.to_path === 'z-second.ts')
      expect(edge).toBeDefined()
      expect(edge!.to_file_id).not.toBeNull()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('reindexar sin cambios no rompe edges ya resueltos (no reprocesa archivos con el mismo sha1)', async () => {
    const dir = tmpProject()
    try {
      writeFileSync(join(dir, 'a-first.ts'), `import { helper } from './z-second.ts'\nhelper()\n`)
      writeFileSync(join(dir, 'z-second.ts'), `export function helper() {}\n`)

      const id = newPid()
      await resolvedEdges(dir, id)
      const second = await resolvedEdges(dir, id)
      const edge = second.find((e) => e.to_path === 'z-second.ts')
      expect(edge!.to_file_id).not.toBeNull()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
