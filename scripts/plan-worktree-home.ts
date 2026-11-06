import { realpathSync } from 'node:fs'
import { join } from 'node:path'

/** Only ledger CLI processes opt in; the dashboard keeps the user's shared DB. */
export function configureWorktreePlanHome(): void {
  const result = Bun.spawnSync(
    ['git', 'rev-parse', '--path-format=absolute', '--git-dir', '--git-common-dir'],
    { stdout: 'pipe', stderr: 'pipe' },
  )
  if (result.exitCode !== 0) throw new Error(result.stderr.toString().trim())
  const [gitDir, commonDir] = result.stdout.toString().trim().split('\n')
  if (!gitDir || !commonDir) throw new Error('Cannot resolve worktree git directories')
  if (realpathSync(gitDir) !== realpathSync(commonDir)) {
    process.env.ORCHESTOS_HOME = join(gitDir, 'orchestos-plan')
  }
}
