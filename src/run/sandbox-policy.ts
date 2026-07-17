import { existsSync } from 'fs'
import { join } from 'path'
import { git } from './sandbox.ts'

export type SandboxMode = 'worktree' | 'cwd'

export interface SandboxPolicyResult {
  mode: SandboxMode
  warnings: string[]
  branch: string | null
}

export function resolveSandboxMode(projectRoot: string, preferred?: SandboxMode): SandboxPolicyResult {
  const warnings: string[] = []
  const gitDir = join(projectRoot, '.git')

  if (!existsSync(gitDir)) {
    warnings.push('Not a git repository — falling back to cwd (no sandbox isolation)')
    return { mode: 'cwd', warnings, branch: null }
  }

  if (preferred === 'cwd') {
    warnings.push('Sandbox disabled by --sandbox=cwd — changes will be written directly to the repo')
    return { mode: 'cwd', warnings, branch: null }
  }

  // check for uncommitted changes (only relevant for worktree mode)
  // D.5 follow-up (Mes 22, 2026-07-16) — runs-summary.json lleva
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
  git(['checkout', '--', 'runs-summary.json'], projectRoot)
  const status = git(['status', '--porcelain'], projectRoot)
  const relevantLines = status.stdout
    .split('\n')
    .filter(l => l.trim().length > 0 && !/\bruns-summary\.json$/.test(l))
  if (status.exitCode === 0 && relevantLines.length > 0) {
    const fileList = relevantLines.slice(0, 10).map(l => {
      const [flag, ...rest] = l.trim().split(/\s+/)
      return `  ${flag} ${rest.join(' ')}`
    }).join('\n')
    const suffix = relevantLines.length > 10 ? '\n  ... and more' : ''
    throw new Error(
      `Uncommitted changes in ${projectRoot}. Worktree sandbox requires a clean working tree.\n` +
      `Either commit or stash before running with sandbox:\n${fileList}${suffix}`
    )
  }

  // determine current branch
  const branchResult = git(['rev-parse', '--abbrev-ref', 'HEAD'], projectRoot)
  const branch = branchResult.exitCode === 0 && branchResult.stdout !== 'HEAD'
    ? branchResult.stdout
    : null

  if (!branch) {
    warnings.push('Detached HEAD state — falling back to cwd')
    return { mode: 'cwd', warnings, branch: null }
  }

  return { mode: 'worktree', warnings, branch }
}
