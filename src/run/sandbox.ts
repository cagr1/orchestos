import { existsSync, mkdirSync, symlinkSync } from 'node:fs'
import { join } from 'node:path'
import {
  listCommittedWorktreePaths,
  listWorktreeChanges,
  worktreeForkPoint,
} from './executors/worktree-diff.ts'
import { withGitLock } from './git-lock.ts'
import { normalizeRelPath } from './path-policy.ts'
import { derivedFilesFor, discardDerivedFiles } from './sandbox-policy.ts'

export interface Worktree {
  path: string
  branch: string
  baseBranch: string
  projectRoot: string
  /** Paths produced by the successful setup, before the executor runs. */
  setupArtifacts: string[]
  /** HEAD of the base branch immediately before the successful merge. */
  mergedBaseSha?: string
  cleanup: () => void
}

type MergeStrategy = 'commit' | 'squash' | 'discard'

export function git(
  args: string[],
  cwd: string,
): { exitCode: number; stdout: string; stderr: string } {
  // Each add/commit waits at most 2 s for another process's index lock (4 s per
  // add + commit pair). Never remove a lock or retry unrelated failures/hooks.
  const command = args[0] === '--literal-pathspecs' ? args[1] : args[0]
  const retryIndexLock = command === 'add' || command === 'commit'
  const deadline = performance.now() + 2_000
  const env =
    args[0] === 'status' || args[0] === 'diff'
      ? { ...process.env, GIT_OPTIONAL_LOCKS: '0' }
      : process.env
  for (;;) {
    const proc = Bun.spawnSync(['git', ...args], { cwd, env })
    const result = {
      exitCode: proc.exitCode,
      stdout: proc.stdout.toString().trim(),
      stderr: proc.stderr.toString().trim(),
    }
    const remaining = deadline - performance.now()
    if (
      !retryIndexLock ||
      result.exitCode === 0 ||
      !/fatal: Unable to create [^\n]*index\.lock['"]?: File exists/.test(result.stderr) ||
      remaining <= 0
    )
      return result
    Bun.sleepSync(Math.min(100, remaining))
  }
}

export function createWorktree(
  taskId: string,
  baseBranch: string,
  projectRoot: string,
  setupScript?: string | null,
): Worktree {
  const timestamp = Date.now()
  const sanitizedTaskId = taskId.replace(/[^a-z0-9-]/gi, '_').toLowerCase()
  const branch = `orchestos/${sanitizedTaskId}/${timestamp}`
  const worktreeDir = join(
    projectRoot,
    '.orchestos',
    'worktrees',
    `${sanitizedTaskId}-${timestamp}`,
  )

  if (!existsSync(join(projectRoot, '.git'))) {
    throw new Error(`Not a git repository: ${projectRoot}`)
  }

  // ensure baseBranch exists locally
  const branchCheck = git(['rev-parse', '--verify', baseBranch], projectRoot)
  if (branchCheck.exitCode !== 0) {
    throw new Error(
      `Base branch "${baseBranch}" does not exist locally. Available branches:\n${git(['branch'], projectRoot).stdout}`,
    )
  }

  // create branch from baseBranch
  mkdirSync(join(projectRoot, '.orchestos', 'worktrees'), { recursive: true })

  const branchResult = git(['branch', '--', branch, baseBranch], projectRoot)
  if (branchResult.exitCode !== 0) {
    throw new Error(`Failed to create branch "${branch}": ${branchResult.stderr}`)
  }

  const forkSha = git(['rev-parse', baseBranch], projectRoot)
  const forkConfig =
    forkSha.exitCode === 0
      ? git(['config', `branch.${branch}.orchestosForkPoint`, forkSha.stdout], projectRoot)
      : forkSha
  if (forkConfig.exitCode !== 0) {
    git(['branch', '-D', '--', branch], projectRoot)
    throw new Error(`Failed to persist worktree fork point: ${forkConfig.stderr}`)
  }

  // create worktree
  const wtResult = git(['worktree', 'add', '--', worktreeDir, branch], projectRoot)
  if (wtResult.exitCode !== 0) {
    // rollback: delete branch if worktree creation fails
    git(['branch', '-D', '--', branch], projectRoot)
    throw new Error(`Failed to create worktree at ${worktreeDir}: ${wtResult.stderr}`)
  }

  // T (Mes 26, IDEAS #19, 2026-08-06) — `git worktree add` solo trae contenido
  // versionado; `node_modules` (siempre gitignored) nunca llega al worktree
  // nuevo. `defaultChecksFor()` (checks.ts) gatea `tsc --noEmit` y `bun test`
  // en `existsSync(node_modules)` — sin él, una tarea SIN `checks:` explícitos
  // pierde su única red determinista y queda solo el juez de QA-LLM (el mismo
  // que el gate D.1, Mes 17, mostró que puede dar falso negativo). Symlink en
  // vez de copia: comparte el mismo árbol de dependencias, no lo aísla ni
  // debería — ningún engine escribe ahí (el contrato solo autoriza
  // `task.output`), y `node_modules` gitignored no aparece en el diff que lee
  // el engine externo (`git status --porcelain` respeta `.gitignore`).
  // Best-effort: un symlink fallido (permisos, Windows sin modo dev) no debe
  // tumbar la creación del worktree — el gap vuelve a ser el de antes, no uno
  // nuevo.
  const nodeModulesSrc = join(projectRoot, 'node_modules')
  const nodeModulesDest = join(worktreeDir, 'node_modules')
  if (existsSync(nodeModulesSrc) && !existsSync(nodeModulesDest)) {
    try {
      symlinkSync(nodeModulesSrc, nodeModulesDest, 'dir')
    } catch (e: any) {
      console.warn(`[sandbox] could not symlink node_modules into worktree: ${e.message}`)
    }
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

  let setupArtifacts: string[] = []
  if (setupScript?.trim()) {
    try {
      // Merge stderr into stdout so the diagnostic preserves execution order.
      const result = Bun.spawnSync(
        [
          'sh',
          '-c',
          `exec 2>&1
${setupScript}`,
        ],
        {
          cwd: worktreeDir,
          env: {
            ...process.env,
            ORCHESTOS_WORKTREE: worktreeDir,
            ORCHESTOS_PROJECT_ROOT: projectRoot,
          },
          stdout: 'pipe',
          stderr: 'pipe',
          timeout: 10 * 60 * 1000,
          killSignal: 'SIGKILL',
        },
      )
      if (result.exitCode !== 0) {
        const output = result.stdout.toString().trim().split('\n').slice(-20).join('\n')
        throw new Error(
          `Worktree setup script failed (${result.exitedDueToTimeout ? 'timeout after 10 minutes' : `exit ${result.exitCode}`}):\n${output}`,
        )
      }
      setupArtifacts = listWorktreeChanges(worktreeDir, forkSha.stdout).map(({ path }) =>
        normalizeRelPath(path),
      )
      for (const path of setupArtifacts) {
        const config = git(
          ['config', '--add', `branch.${branch}.orchestosSetupArtifact`, path],
          projectRoot,
        )
        if (config.exitCode !== 0) {
          throw new Error(`Failed to persist worktree setup artifact: ${config.stderr}`)
        }
      }
    } catch (error) {
      cleanup()
      throw error
    }
  }

  return { path: worktreeDir, branch, baseBranch, projectRoot, setupArtifacts, cleanup }
}

// Mes 22/E.5 — toda esta función toca `worktree.projectRoot` (checkout, merge,
// worktree remove, branch -D) — el mismo repo/working-dir que los auto-commits
// de tasks.yaml (D.5/D.7) y que OTRO merge-back concurrente. `withGitLock`
// serializa contra ambos (ver git-lock.ts para la causa raíz que esto cierra).
export function mergeWorktreeBack(worktree: Worktree, strategy: 'discard', message?: string): null
export function mergeWorktreeBack(
  worktree: Worktree,
  strategy: Exclude<MergeStrategy, 'discard'>,
  message: string | undefined,
  paths: string[],
): string | null
export function mergeWorktreeBack(
  worktree: Worktree,
  strategy: MergeStrategy,
  message?: string,
  paths?: string[],
): string | null {
  return withGitLock(worktree.projectRoot, () =>
    mergeWorktreeBackLocked(worktree, strategy, message, paths),
  )
}

function mergeWorktreeBackLocked(
  worktree: Worktree,
  strategy: MergeStrategy,
  message?: string,
  paths?: string[],
): string | null {
  if (strategy === 'discard') {
    worktree.cleanup()
    return null
  }

  if (!paths) throw new Error('Declared paths are required to merge a worktree')
  const forkPoint = worktreeForkPoint(worktree.path)
  if (!forkPoint) throw new Error('fork-point: missing')
  const allowed = new Set(paths.map(normalizeRelPath))
  const committed = listCommittedWorktreePaths(worktree.path, forkPoint)
  const undeclared = committed.filter((path) => !allowed.has(normalizeRelPath(path)))
  if (undeclared.length) throw new Error(`committed undeclared: ${undeclared.join(', ')}`)

  // Clear pre-existing staging without rewriting commits or working files.
  const reset = git(['reset', '-q'], worktree.path)
  if (reset.exitCode !== 0) throw new Error(`git reset failed in worktree: ${reset.stderr}`)
  const intersection = listWorktreeChanges(worktree.path, 'HEAD')
    .map(({ path }) => path)
    .filter((path) => allowed.has(normalizeRelPath(path)))
  if (intersection.length) {
    const add = git(['--literal-pathspecs', 'add', '-A', '--', ...intersection], worktree.path)
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

  // Excluded tracked changes must not block rebase; preserve the dependency symlink.
  const cleanReset = git(['reset', '--hard', '-q', 'HEAD'], worktree.path)
  if (cleanReset.exitCode !== 0)
    throw new Error(`git reset excluded changes failed in worktree: ${cleanReset.stderr}`)
  const clean = git(['clean', '-fdq', '--', '.', ':!node_modules'], worktree.path)
  if (clean.exitCode !== 0)
    throw new Error(`git clean excluded changes failed in worktree: ${clean.stderr}`)

  // Mes 22/E.9 — descarte defensivo de los archivos derivados declarados, como resolveSandboxMode()
  // ya descarta al empezar la corrida (sandbox-policy.ts). Entre ese momento y
  // este merge pasa la ventana LARGA sin lock (LLM + QA + checks) — si algo
  // dejó un archivo derivado declarado sucio en projectRoot durante esa ventana (ej. un
  // hook de OTRO commit que falló a mitad de camino, típicamente por
  // `bun run typecheck` fallando de forma transitoria), `git merge` lo
  // rechazaría con "your local changes would be overwritten" — el error real
  // reproducido en vivo que E.5/E.6 no cubrían. Best-effort, nunca bloquea.
  const currentBranch = git(['symbolic-ref', '--quiet', '--short', 'HEAD'], worktree.projectRoot)
  const baseCheckedOut =
    currentBranch.exitCode === 0 && currentBranch.stdout === worktree.baseBranch
  if (baseCheckedOut) {
    const derivedFiles = derivedFilesFor(worktree.projectRoot)
    discardDerivedFiles(worktree.projectRoot, derivedFiles)
  }
  const headBefore = git(['rev-parse', worktree.baseBranch], worktree.projectRoot).stdout
  const advanceBase = () =>
    git(
      baseCheckedOut
        ? ['merge', '--ff-only', worktree.branch]
        : ['fetch', '.', `${worktree.branch}:${worktree.baseBranch}`],
      worktree.projectRoot,
    )

  if (strategy === 'squash' && !baseCheckedOut) {
    // Rebase before squashing so concurrent base changes stay in the result tree.
    const rebase = git(['rebase', worktree.baseBranch], worktree.path)
    if (rebase.exitCode !== 0) throw new Error(`git rebase before squash failed: ${rebase.stderr}`)
    const reset = git(['reset', '--soft', worktree.baseBranch], worktree.path)
    if (reset.exitCode !== 0) throw new Error(`git reset (squash) failed: ${reset.stderr}`)
    if (git(['diff', '--cached', '--quiet'], worktree.path).exitCode !== 0) {
      const commit = git(
        ['commit', '-m', message ?? `orchestos: squashed changes from ${worktree.branch}`],
        worktree.path,
      )
      if (commit.exitCode !== 0) throw new Error(`git commit (squash) failed: ${commit.stderr}`)
    }
  }

  if (strategy === 'commit' || !baseCheckedOut) {
    const merge = advanceBase()
    if (merge.exitCode !== 0) {
      const rebase = git(['rebase', worktree.baseBranch], worktree.path)
      if (rebase.exitCode !== 0)
        throw new Error(
          `git merge --ff-only and rebase both failed for branch ${worktree.branch}. ` +
            `Resolve in ${worktree.path}; rebase error: ${rebase.stderr}`,
        )
      const retry = advanceBase()
      if (retry.exitCode !== 0)
        throw new Error(
          `git merge ${worktree.branch} failed after rebase — retry ff-only said: ${retry.stderr}\n` +
            `(primer intento ff-only: ${merge.stderr})`,
        )
    }
  } else {
    const merge = git(['merge', '--squash', worktree.branch], worktree.projectRoot)
    if (merge.exitCode !== 0)
      throw new Error(`git merge --squash ${worktree.branch} failed: ${merge.stderr}`)
    if (git(['diff', '--cached', '--quiet'], worktree.projectRoot).exitCode !== 0) {
      const commit = git(
        ['commit', '-m', message ?? `orchestos: squashed changes from ${worktree.branch}`],
        worktree.projectRoot,
      )
      if (commit.exitCode !== 0) throw new Error(`git commit (squash) failed: ${commit.stderr}`)
    }
  }

  // ERP.7.2a — el SHA se toma después del ff/rebase/squash: el rebase cambia el commit original.
  const headAfter = git(['rev-parse', worktree.baseBranch], worktree.projectRoot).stdout
  worktree.mergedBaseSha = headBefore
  worktree.cleanup()
  return headAfter && headAfter !== headBefore ? headAfter : null
}
