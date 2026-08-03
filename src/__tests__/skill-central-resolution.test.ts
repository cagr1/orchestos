import { describe, expect, test, beforeEach, afterEach } from 'bun:test'
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, realpathSync } from 'fs'
import { join, basename } from 'path'
import { tmpdir } from 'os'
import { listSkillFiles, listProSkillFiles, resolveSkillPath, getSkillPath } from '../skills/registry.ts'

// O.1 (Bloque O, 2026-08-03) — las skills se resuelven desde la INSTALACIÓN de
// OrchestOS, no solo desde `cwd`. Antes `getSkillsDir()` era
// `join(process.cwd(), 'skills')` sin fallback: gestionando otro proyecto,
// `listSkillFiles()` devolvía [] y no se activaba ninguna skill jamás.
//
// El caso que importa es justamente el que no se podía probar antes: un
// proyecto ajeno, sin carpeta `skills/` propia. Se simula con `chdir` a un
// directorio temporal — el fallback apunta a la instalación real (este repo).

const originalCwd = process.cwd()
let fakeProject: string

beforeEach(() => {
  // realpathSync: en macOS tmpdir() da /var/... pero chdir() resuelve a
  // /private/var/... — sin esto los startsWith() comparan rutas distintas.
  fakeProject = realpathSync(mkdtempSync(join(tmpdir(), 'orchestos-o1-')))
})

afterEach(() => {
  process.chdir(originalCwd)
  rmSync(fakeProject, { recursive: true, force: true })
})

const ids = (paths: string[]) => paths.map(p => basename(p, '.yaml')).sort()

describe('O.1 — proyecto ajeno SIN skills/ propia', () => {
  test('listSkillFiles() ya no devuelve [] — cae a la instalación', () => {
    process.chdir(fakeProject)
    const files = listSkillFiles()
    expect(files.length).toBeGreaterThan(0)
    expect(ids(files)).toContain('tdd-enforcer')
    expect(ids(files)).toContain('security-review')
  })

  test('listProSkillFiles() también cae a la instalación', () => {
    process.chdir(fakeProject)
    expect(listProSkillFiles().length).toBeGreaterThan(0)
  })

  test('resolveSkillPath() encuentra una skill central', () => {
    process.chdir(fakeProject)
    const p = resolveSkillPath('security-review')
    expect(p).toContain('security-review.yaml')
    expect(p.startsWith(fakeProject)).toBe(false)
  })

  test('getSkillPath() (ESCRITURA) sigue apuntando al proyecto, nunca a la instalación', () => {
    process.chdir(fakeProject)
    expect(getSkillPath('nueva').startsWith(fakeProject)).toBe(true)
  })
})

describe('O.1 — proyecto CON skills/ propia', () => {
  function seedOwnSkill(id: string, name: string) {
    mkdirSync(join(fakeProject, 'skills'), { recursive: true })
    writeFileSync(join(fakeProject, 'skills', `${id}.yaml`), `
id: ${id}
version: 1.0.0
name: ${name}
description: Local override for O.1 test
instructions: Local instructions.
targets: [claude]
`.trimStart(), 'utf-8')
  }

  test('la skill del proyecto GANA sobre la central con el mismo id', () => {
    seedOwnSkill('security-review', 'Local Security Review')
    process.chdir(fakeProject)

    const resolved = resolveSkillPath('security-review')
    expect(resolved.startsWith(fakeProject)).toBe(true)

    const own = listSkillFiles().filter(f => basename(f) === 'security-review.yaml')
    expect(own).toHaveLength(1)
    expect(own[0]!.startsWith(fakeProject)).toBe(true)
  })

  test('una skill propia con id nuevo se suma a las centrales, no las reemplaza', () => {
    seedOwnSkill('solo-de-este-proyecto', 'Project Only')
    process.chdir(fakeProject)

    const all = ids(listSkillFiles())
    expect(all).toContain('solo-de-este-proyecto')
    expect(all).toContain('tdd-enforcer')
  })

  test('sin duplicados cuando cwd ES la instalación (OrchestOS sobre sí mismo)', () => {
    process.chdir(originalCwd)
    const all = ids(listSkillFiles())
    expect(all.length).toBe(new Set(all).size)
  })
})
