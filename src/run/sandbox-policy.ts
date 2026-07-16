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
  const status = git(['status', '--porcelain'], projectRoot)
  // D.5 follow-up (Mes 22, 2026-07-16) — runs-summary.json lleva
  // `exported_at: new Date().toISOString()` (scripts/export-runs-summary.ts)
  // y se regenera en CADA `git commit` vía el hook pre-commit — incluso los
  // que no lo tocan a propósito. Eso lo deja "sucio" con solo el timestamp
  // distinto justo después de un commit, condición de carrera real: el
  // auto-commit de tasks.yaml (D.5) dispara el hook, que reescribe este
  // archivo con un timestamp nuevo, y la corrida siguiente lo ve sucio y
  // aborta — reproducido en vivo (retry_reason: "M runs-summary.json").
  // No es trabajo del usuario en riesgo (es 100% derivado de la DB), así
  // que no cuenta para la limpieza que el sandbox de worktree necesita.
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
