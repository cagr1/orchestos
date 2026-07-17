import { describe, it, expect } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync, appendFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { git } from '../run/sandbox.ts'
import { resolveSandboxMode } from '../run/sandbox-policy.ts'

// Mes 22/E.9 — sandbox-policy.ts nunca tuvo test file (gap pre-existente,
// notado en PLAN.md E.6). Segundo bug real encontrado ahí en el mismo día
// (E.1: excluir runs-summary.json del REPORTE de "sucio"; E.9: eso no
// bastaba, dejaba el archivo genuinamente sucio en disco, lo que rompía un
// `git merge` más tarde). Test con un repo git REAL, no mocks — la garantía
// que importa es sobre el estado real del working dir después de la llamada.
function initRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'orchestos-sandboxpolicy-'))
  git(['init', '-b', 'master'], dir)
  git(['config', 'user.email', 'test@test.com'], dir)
  git(['config', 'user.name', 'test'], dir)
  writeFileSync(join(dir, 'runs-summary.json'), JSON.stringify({ exported_at: '2026-01-01T00:00:00Z', total_runs: 0 }))
  writeFileSync(join(dir, 'tasks.yaml'), 'version: 1\n')
  git(['add', '-A'], dir)
  git(['commit', '-m', 'initial'], dir)
  return dir
}

describe('resolveSandboxMode — runs-summary.json (E.1/E.9)', () => {
  it('no lanza con solo runs-summary.json sucio, y lo deja genuinamente limpio (no solo ignorado en el reporte)', () => {
    const dir = initRepo()
    try {
      // Simula el drift real: el hook pre-commit regenera este archivo con
      // un timestamp nuevo en CADA commit, incluso los que no lo tocan.
      writeFileSync(join(dir, 'runs-summary.json'), JSON.stringify({ exported_at: '2026-07-16T20:00:00Z', total_runs: 3 }))
      expect(git(['status', '--porcelain'], dir).stdout).toContain('runs-summary.json')

      const result = resolveSandboxMode(dir)
      expect(result.mode).toBe('worktree')

      // La garantía real de E.9: no solo "no lanzó" — el archivo debe haber
      // quedado sin diff, porque un `git merge` posterior (que no sabe nada
      // de nuestra regla de "ignóralo") lo rechazaría si sigue sucio.
      const statusAfter = git(['status', '--porcelain'], dir)
      expect(statusAfter.stdout).toBe('')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('SÍ lanza si hay OTRO archivo sucio además de runs-summary.json', () => {
    const dir = initRepo()
    try {
      appendFileSync(join(dir, 'tasks.yaml'), '  - id: rogue\n')
      writeFileSync(join(dir, 'runs-summary.json'), JSON.stringify({ exported_at: '2026-07-16T20:00:00Z' }))

      expect(() => resolveSandboxMode(dir)).toThrow(/Uncommitted changes/)
      // El archivo real sucio (tasks.yaml) debe seguir reportado.
      try {
        resolveSandboxMode(dir)
      } catch (e: any) {
        expect(e.message).toContain('tasks.yaml')
        expect(e.message).not.toContain('runs-summary.json')
      }
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('working tree genuinamente limpio: no lanza y no toca nada', () => {
    const dir = initRepo()
    try {
      const result = resolveSandboxMode(dir)
      expect(result.mode).toBe('worktree')
      expect(git(['status', '--porcelain'], dir).stdout).toBe('')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
