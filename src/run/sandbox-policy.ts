import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { loadOrcheConfig } from '../config/load.ts'
import { getProject } from '../db/projects.ts'
import { git } from './sandbox.ts'

export type SandboxMode = 'worktree' | 'cwd'

interface SandboxPolicyResult {
  mode: SandboxMode
  warnings: string[]
  branch: string | null
}

export const DIRTY_TREE_REASON_PREFIX = 'uncommitted changes: '

/** El árbol tiene cambios sin commitear: `files` es la lista completa (sin truncar). */
export class DirtyTreeError extends Error {
  constructor(
    message: string,
    readonly files: string[],
  ) {
    super(message)
    this.name = 'DirtyTreeError'
  }
}

/**
 * Rutas relativas con cambios sin commitear (incluye no seguidos), salvo archivos derivados declarados.
 * Parseo con `-z`: un rename aporta origen y destino.
 */
export function derivedFilesFor(projectRoot: string): string[] {
  return loadOrcheConfig(projectRoot).sandbox?.derivedFiles ?? []
}

/** Discard only an exact tracked file; git checkout on a directory is recursive. */
export function discardDerivedFiles(projectRoot: string, files: string[]): void {
  for (const path of files) {
    if (!path || path === '.') continue
    const tracked = Bun.spawnSync(
      ['git', '--literal-pathspecs', 'ls-files', '-z', '--full-name', '--', path],
      { cwd: projectRoot, stdout: 'pipe', stderr: 'pipe' },
    )
    if (tracked.exitCode !== 0 || tracked.stdout.toString() !== `${path}\0`) continue
    git(['--literal-pathspecs', 'checkout', '--', path], projectRoot)
  }
}

export function listDirtyFiles(projectRoot: string, strict = false): string[] {
  return listDirtyFilesWithDerived(projectRoot, strict, derivedFilesFor(projectRoot))
}

function listDirtyFilesWithDerived(
  projectRoot: string,
  strict: boolean,
  derivedFiles: string[],
): string[] {
  // spawn directo: `git()` recorta el stdout y comería el espacio inicial de ` M ruta`
  const proc = Bun.spawnSync(['git', 'status', '--porcelain', '-z'], { cwd: projectRoot })
  if (proc.exitCode !== 0) {
    if (strict) throw new Error(proc.stderr.toString().trim() || 'git status failed')
    return []
  }
  const entries = parsePorcelainStatus(proc.stdout.toString())
  const derived = new Set(derivedFiles)
  return entries.flatMap(({ path, originalPath }) =>
    [path, ...(originalPath ? [originalPath] : [])].filter((file) => !derived.has(file)),
  )
}

function parsePorcelainStatus(
  output: string,
): Array<{ flag: string; path: string; originalPath?: string }> {
  const fields = output.split('\0')
  const entries: Array<{ flag: string; path: string; originalPath?: string }> = []
  for (let i = 0; i < fields.length; i++) {
    const raw = fields[i]
    if (!raw || raw.length < 4) continue
    const flag = raw.slice(0, 2)
    const path = raw.slice(3)
    const renamed = flag.includes('R') || flag.includes('C')
    const originalPath = renamed ? fields[++i] : undefined
    entries.push({ flag, path, ...(originalPath ? { originalPath } : {}) })
  }
  return entries
}

export function resolveSandboxMode(
  projectRoot: string,
  preferred?: SandboxMode,
): SandboxPolicyResult {
  const warnings: string[] = []
  const gitDir = join(projectRoot, '.git')

  if (!existsSync(gitDir)) {
    warnings.push('Not a git repository — falling back to cwd (no sandbox isolation)')
    return { mode: 'cwd', warnings, branch: null }
  }

  if (preferred === 'cwd') {
    warnings.push(
      'Sandbox disabled by --sandbox=cwd — changes will be written directly to the repo',
    )
    return { mode: 'cwd', warnings, branch: null }
  }

  // check for uncommitted changes (only relevant for worktree mode)
  // D.5 follow-up (Mes 22, 2026-07-16) — los archivos derivados declarados llevan
  // `exported_at: new Date().toISOString()` (scripts/export-runs-summary.ts)
  // y se regenera en CADA `git commit` vía el hook pre-commit — incluso los
  // que no lo tocan a propósito. Eso lo deja "sucio" con solo el timestamp
  // distinto justo después de un commit. No es trabajo del usuario en riesgo
  // (es 100% derivado de la DB, y el repo lo necesita commiteado para que el
  // scheduled task de dreaming en la nube lo lea vía `git pull` — no se puede
  // simplemente dejar de trackearlo, ver [[project-dreaming-setup]]).
  //
  // Mes 22/E.9 — el fix anterior solo IGNORABA este archivo en el reporte de
  // "sucio", pero lo dejaba sucio de verdad en el working dir. Eso no rompía
  // el chequeo de arranque, pero SÍ rompía el merge-back más tarde: `git
  // merge` no sabe nada de nuestra regla de "ignora este archivo" y rechaza
  // sobreescribir un cambio local sin commitear — reproducido en vivo
  // (stderr real: "Your local changes to... runs-summary.json would be
  // overwritten by merge"). Fix real: no solo ignorar el diff, DESCARTARLO
  // (`git checkout --`) para que el working dir quede genuinamente limpio
  // antes de que cualquier otra operación de git (incluido un merge futuro)
  // lo encuentre. Best-effort — si el archivo no existe o el checkout falla
  // por cualquier motivo, seguimos con la lógica de abajo igual.
  const derivedFiles = derivedFilesFor(projectRoot)
  discardDerivedFiles(projectRoot, derivedFiles)
  const status = Bun.spawnSync(['git', 'status', '--porcelain', '-z'], { cwd: projectRoot })
  const parsedStatus = parsePorcelainStatus(status.stdout.toString())
  const dirtyFiles = listDirtyFilesWithDerived(projectRoot, false, derivedFiles)
  const derivedSet = new Set(derivedFiles)
  const relevantEntries = parsedStatus.filter(
    ({ path, originalPath }) =>
      !derivedSet.has(path) || (originalPath && !derivedSet.has(originalPath)),
  )
  if (status.exitCode === 0 && relevantEntries.length > 0) {
    const fileList = relevantEntries
      .slice(0, 10)
      .map(({ flag, path }) => `  ${flag} ${path}`)
      .join('\n')
    const suffix = relevantEntries.length > 10 ? '\n  ... and more' : ''
    throw new DirtyTreeError(
      `Uncommitted changes in ${projectRoot}. Worktree sandbox requires a clean working tree.\n` +
        `Either commit or stash before running with sandbox:\n${fileList}${suffix}`,
      dirtyFiles,
    )
  }

  const configured = getProject(projectRoot)?.base_branch
  if (configured) {
    const check = git(
      ['rev-parse', '--verify', '--end-of-options', `refs/heads/${configured}`],
      projectRoot,
    )
    if (check.exitCode === 0) return { mode: 'worktree', warnings, branch: configured }
    warnings.push(
      `Configured base branch "${configured}" no longer exists — falling back to current branch`,
    )
  }

  // determine current branch
  const branchResult = git(['rev-parse', '--abbrev-ref', 'HEAD'], projectRoot)
  const branch =
    branchResult.exitCode === 0 && branchResult.stdout !== 'HEAD' ? branchResult.stdout : null

  if (!branch) {
    warnings.push('Detached HEAD state — falling back to cwd')
    return { mode: 'cwd', warnings, branch: null }
  }

  return { mode: 'worktree', warnings, branch }
}
