/**
 * T (Mes 26, IDEAS #19, 2026-08-06) — `git worktree add` solo trae contenido
 * versionado; `node_modules` (siempre gitignored) nunca llegaba al worktree
 * nuevo. `defaultChecksFor()` (checks.ts) gatea `tsc --noEmit`/`bun test` en
 * `existsSync(node_modules)` — sin él, una tarea `engine: external` (que
 * EXIGE worktree, docs/external-executor-design.md §5) sin `checks:`
 * explícitos perdía su única red determinista, dejando solo el juez de
 * QA-LLM (el mismo que el gate D.1, Mes 17, mostró que puede dar falso
 * negativo).
 *
 * Fix: symlinkear `node_modules` al crear el worktree. Efecto secundario real
 * encontrado al verificar en vivo (no hipotético): un `.gitignore` con
 * `node_modules/` (con slash) NO matchea un symlink — solo directorios
 * reales — así que sin el pathspec `:!node_modules` en los `git status`/
 * `git add` que leen el worktree, el symlink aparecía como `??` y
 * `mergeWorktreeBack()` lo habría COMMITEADO al branch real.
 *
 * Repo git real, no mocks — la garantía que importa es sobre el estado real
 * del working dir y del historial de git después de la llamada.
 */

import { describe, expect, it } from 'bun:test'
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { defaultChecksFor } from '../run/checks.ts'
import { readWorktreeDiff } from '../run/executors/worktree-diff.ts'
import { createWorktree, git, mergeWorktreeBack } from '../run/sandbox.ts'

function initRepoWithNodeModules(): string {
  const dir = mkdtempSync(join(tmpdir(), 'orchestos-sandbox-nm-'))
  git(['init', '-b', 'main'], dir)
  git(['config', 'user.email', 'test@test.com'], dir)
  git(['config', 'user.name', 'test'], dir)
  writeFileSync(join(dir, '.gitignore'), 'node_modules/\n')
  mkdirSync(join(dir, 'node_modules', '.bin'), { recursive: true })
  writeFileSync(join(dir, 'node_modules', 'pkg.json'), '{}')
  writeFileSync(join(dir, 'README.md'), '# test\n')
  git(['add', '-A'], dir)
  git(['commit', '-m', 'initial'], dir)
  return dir
}

describe('createWorktree — symlink de node_modules (#19)', () => {
  it('symlinkea node_modules real del repo al worktree nuevo', () => {
    const dir = initRepoWithNodeModules()
    let wt
    try {
      wt = createWorktree('t19-symlink', 'main', dir)
      const target = join(wt.path, 'node_modules')
      expect(existsSync(target)).toBe(true)
      expect(lstatSync(target).isSymbolicLink()).toBe(true)
      expect(readFileSync(join(target, 'pkg.json'), 'utf-8')).toBe('{}')
    } finally {
      wt?.cleanup()
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('no falla si el repo no tiene node_modules — mismo comportamiento de siempre', () => {
    const dir = mkdtempSync(join(tmpdir(), 'orchestos-sandbox-no-nm-'))
    git(['init', '-b', 'main'], dir)
    git(['config', 'user.email', 'test@test.com'], dir)
    git(['config', 'user.name', 'test'], dir)
    writeFileSync(join(dir, 'README.md'), '# test\n')
    git(['add', '-A'], dir)
    git(['commit', '-m', 'initial'], dir)

    let wt
    try {
      wt = createWorktree('t19-no-nm', 'main', dir)
      expect(existsSync(join(wt.path, 'node_modules'))).toBe(false)
    } finally {
      wt?.cleanup()
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('el gap real: defaultChecksFor() ahora genera tsc en un worktree fresco (antes devolvía [])', () => {
    const dir = initRepoWithNodeModules()
    let wt
    try {
      wt = createWorktree('t19-checks-gap', 'main', dir)
      writeFileSync(join(wt.path, 'out.ts'), 'const x: number = 1\n')
      const checks = defaultChecksFor(['out.ts'], wt.path)
      expect(checks.some((c) => c.cmd === 'bunx tsc --noEmit')).toBe(true)
    } finally {
      wt?.cleanup()
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('readWorktreeDiff — el symlink de node_modules no contamina el diff (#19)', () => {
  it('reporta solo el archivo real escrito por el engine, nunca node_modules', () => {
    const dir = initRepoWithNodeModules()
    let wt
    try {
      wt = createWorktree('t19-diff', 'main', dir)
      writeFileSync(join(wt.path, 'real-output.txt'), 'hola')
      const diff = readWorktreeDiff(wt.path)
      expect(diff.map((f) => f.path)).toEqual(['real-output.txt'])
    } finally {
      wt?.cleanup()
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('mergeWorktreeBack — el symlink de node_modules nunca se commitea al branch real (#19)', () => {
  it('commitea el output real sin arrastrar node_modules', () => {
    const dir = initRepoWithNodeModules()
    let wt
    try {
      wt = createWorktree('t19-merge', 'main', dir)
      writeFileSync(join(wt.path, 'real-output.txt'), 'hola')
      mergeWorktreeBack(wt, 'commit', 'test commit')
      wt = undefined // ya limpiado por el merge

      const show = git(['show', '--stat', 'HEAD'], dir)
      expect(show.stdout).toContain('real-output.txt')
      expect(show.stdout).not.toContain('node_modules')

      const lsTree = git(['ls-tree', '-r', '--name-only', 'HEAD'], dir)
      expect(lsTree.stdout.split('\n')).not.toContain('node_modules')
    } finally {
      wt?.cleanup()
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('sin cambios reales, node_modules solo no dispara un commit vacío', () => {
    const dir = initRepoWithNodeModules()
    let wt
    try {
      wt = createWorktree('t19-merge-empty', 'main', dir)
      const before = git(['rev-parse', 'HEAD'], dir).stdout
      mergeWorktreeBack(wt, 'commit', 'should not happen')
      wt = undefined
      const after = git(['rev-parse', 'HEAD'], dir).stdout
      expect(after).toBe(before)
    } finally {
      wt?.cleanup()
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

// ── BB.5 (2026-08-16) — artefactos del tooling del host ───────────────────────
//
// Hallazgo real de BB.4: `claude -p` hereda ~/.claude/settings.json del usuario
// (hooks/plugins) y esos hooks escriben en el worktree. git status los reporta
// igual que output del agente → el contrato los cuenta como escritura no
// autorizada y mata la tarea con el trabajo correcto al lado.
describe('readWorktreeDiff — el ruido del tooling del host no rompe la tarea (BB.5)', () => {
  it('descarta .impeccable/ y .DS_Store, pero conserva el output real de la tarea', () => {
    const dir = initRepoWithNodeModules()
    let wt
    try {
      wt = createWorktree('bb5-noise', 'main', dir)
      mkdirSync(join(wt.path, '.impeccable'), { recursive: true })
      writeFileSync(join(wt.path, '.impeccable', 'hook.cache.json'), '{"cache":1}')
      writeFileSync(join(wt.path, '.DS_Store'), 'junk')
      mkdirSync(join(wt.path, 'src'), { recursive: true })
      writeFileSync(join(wt.path, 'src', 'slugify.ts'), 'export const x = 1')

      const diff = readWorktreeDiff(wt.path, ['src/slugify.ts'])
      expect(diff.map((f) => f.path)).toEqual(['src/slugify.ts'])
    } finally {
      wt?.cleanup()
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('si la tarea DECLARA el path de tooling en output[], se respeta (no se filtra a ciegas)', () => {
    const dir = initRepoWithNodeModules()
    let wt
    try {
      wt = createWorktree('bb5-declared', 'main', dir)
      mkdirSync(join(wt.path, '.claude'), { recursive: true })
      writeFileSync(join(wt.path, '.claude', 'settings.json'), '{"a":1}')

      expect(readWorktreeDiff(wt.path, []).map((f) => f.path)).not.toContain(
        '.claude/settings.json',
      )
      expect(readWorktreeDiff(wt.path, ['.claude/settings.json']).map((f) => f.path)).toContain(
        '.claude/settings.json',
      )
    } finally {
      wt?.cleanup()
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
