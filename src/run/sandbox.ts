import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'

export interface Worktree {
  path: string
  branch: string
  baseBranch: string
  projectRoot: string
  cleanup: () => void
}

export type MergeStrategy = 'commit' | 'squash' | 'discard'

export function git(args: string[], cwd: string): { exitCode: number; stdout: string; stderr: string } {
  const proc = Bun.spawnSync(['git', ...args], { cwd })
  return {
    exitCode: proc.exitCode,
    stdout: proc.stdout.toString().trim(),
    stderr: proc.stderr.toString().trim(),
  }
}

export function createWorktree(taskId: string, baseBranch: string, projectRoot: string): Worktree {
  const timestamp = Date.now()
  const sanitizedTaskId = taskId.replace(/[^a-z0-9-]/gi, '_').toLowerCase()
  const branch = `orchestos/${sanitizedTaskId}/${timestamp}`
  const worktreeDir = join(projectRoot, '.orchestos', 'worktrees', `${sanitizedTaskId}-${timestamp}`)

  if (!existsSync(join(projectRoot, '.git'))) {
    throw new Error(`Not a git repository: ${projectRoot}`)
  }

  // ensure baseBranch exists locally
  const branchCheck = git(['rev-parse', '--verify', baseBranch], projectRoot)
  if (branchCheck.exitCode !== 0) {
    throw new Error(`Base branch "${baseBranch}" does not exist locally. Available branches:\n${git(['branch'], projectRoot).stdout}`)
  }

  // create branch from baseBranch
  mkdirSync(join(projectRoot, '.orchestos', 'worktrees'), { recursive: true })

  const branchResult = git(['branch', '--', branch, baseBranch], projectRoot)
  if (branchResult.exitCode !== 0) {
    throw new Error(`Failed to create branch "${branch}": ${branchResult.stderr}`)
  }

  // create worktree
  const wtResult = git(['worktree', 'add', '--', worktreeDir, branch], projectRoot)
  if (wtResult.exitCode !== 0) {
    // rollback: delete branch if worktree creation fails
    git(['branch', '-D', '--', branch], projectRoot)
    throw new Error(`Failed to create worktree at ${worktreeDir}: ${wtResult.stderr}`)
  }

  const cleanup = () => {
    try {
      const r1 = git(['worktree', 'remove', '--force', worktreeDir], projectRoot)
      if (r1.exitCode !== 0) {
        console.warn(`[sandbox] cleanup: git worktree remove failed: ${r1.stderr}`)
      }
    } catch (e: any) {
      console.warn(`[sandbox] cleanup: error removing worktree: ${e.message}`)
    }
    try {
      const r2 = git(['branch', '-D', '--', branch], projectRoot)
      if (r2.exitCode !== 0 && !r2.stderr.includes('not found')) {
        console.warn(`[sandbox] cleanup: git branch -D failed: ${r2.stderr}`)
      }
    } catch (e: any) {
      console.warn(`[sandbox] cleanup: error deleting branch: ${e.message}`)
    }
  }

  return { path: worktreeDir, branch, baseBranch, projectRoot, cleanup }
}

export function mergeWorktreeBack(worktree: Worktree, strategy: MergeStrategy, message?: string): void {
  if (strategy === 'discard') {
    worktree.cleanup()
    return
  }

  const hasChanges = git(['status', '--porcelain'], worktree.path).stdout.length > 0

  if (hasChanges) {
    const add = git(['add', '-A'], worktree.path)
    if (add.exitCode !== 0) throw new Error(`git add failed in worktree: ${add.stderr}`)

    const commitMsg = message ?? `orchestos: changes from ${worktree.branch}`
    const commit = git(['commit', '-m', commitMsg], worktree.path)
    if (commit.exitCode !== 0 && !commit.stderr.includes('nothing to commit')) {
      // allow empty commits — if nothing changed, skip
      if (!commit.stderr.includes('nothing to commit')) {
        throw new Error(`git commit failed in worktree: ${commit.stderr}`)
      }
    }
  }

  // switch to baseBranch in the main repo and merge
  const checkout = git(['checkout', worktree.baseBranch], worktree.projectRoot)
  if (checkout.exitCode !== 0) throw new Error(`git checkout ${worktree.baseBranch} failed: ${checkout.stderr}`)

  if (strategy === 'commit') {
    const merge = git(['merge', '--ff-only', worktree.branch], worktree.projectRoot)
    if (merge.exitCode !== 0) throw new Error(`git merge ${worktree.branch} failed: ${merge.stderr}`)
  } else if (strategy === 'squash') {
    const merge = git(['merge', '--squash', worktree.branch], worktree.projectRoot)
    if (merge.exitCode !== 0) throw new Error(`git merge --squash ${worktree.branch} failed: ${merge.stderr}`)

    if (hasChanges) {
      const commitMsg = message ?? `orchestos: squashed changes from ${worktree.branch}`
      const commitSquash = git(['commit', '-m', commitMsg], worktree.projectRoot)
      if (commitSquash.exitCode !== 0) throw new Error(`git commit (squash) failed: ${commitSquash.stderr}`)
    }
  }

  worktree.cleanup()
}
