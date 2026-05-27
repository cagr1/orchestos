import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'

export interface Worktree {
  path: string
  branch: string
  cleanup: () => void
}

function git(args: string[], cwd: string): { exitCode: number; stdout: string; stderr: string } {
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

  return { path: worktreeDir, branch, cleanup }
}
