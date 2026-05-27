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

  // check for uncommitted changes
  const status = git(['status', '--porcelain'], projectRoot)
  if (status.exitCode === 0 && status.stdout.length > 0) {
    const fileList = status.stdout.split('\n').slice(0, 10).map(l => {
      const [flag, ...rest] = l.trim().split(/\s+/)
      return `  ${flag} ${rest.join(' ')}`
    }).join('\n')
    const suffix = status.stdout.split('\n').length > 10 ? '\n  ... and more' : ''
    throw new Error(
      `Uncommitted changes in ${projectRoot}. Worktree sandbox requires a clean working tree.\n` +
      `Either commit or stash before running with sandbox:\n${fileList}${suffix}`
    )
  }

  if (preferred === 'cwd') {
    warnings.push('Sandbox disabled by --sandbox=cwd — changes will be written directly to the repo')
    return { mode: 'cwd', warnings, branch: null }
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
