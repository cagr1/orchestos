import { Database } from 'bun:sqlite'
import { expect, test } from 'bun:test'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('ledger CLIs isolate secondary worktrees and rebuild closed SHAs from git', () => {
  const root = mkdtempSync(join(tmpdir(), 'orchestos-worktree-plan-'))
  const primary = join(root, 'primary')
  const secondary = join(root, 'secondary')
  const sharedHome = join(root, 'shared-home')
  const env = { ...process.env, ORCHESTOS_HOME: sharedHome }
  const git = (cwd: string, args: string[]) => {
    const result = Bun.spawnSync(
      [
        'git',
        '-c',
        'user.name=Plan fixture',
        '-c',
        'user.email=plan@orchestos.test',
        '-c',
        'commit.gpgsign=false',
        '-c',
        'core.hooksPath=/dev/null',
        ...args,
      ],
      { cwd, env, stdout: 'pipe', stderr: 'pipe' },
    )
    expect(result.exitCode, result.stderr.toString()).toBe(0)
    return result.stdout.toString().trim()
  }
  const cli = (cwd: string, script: string, args: string[] = [], home = sharedHome) => {
    const result = Bun.spawnSync(['bun', join(import.meta.dir, script), ...args], {
      cwd,
      env: { ...env, ORCHESTOS_HOME: home },
      stdout: 'pipe',
      stderr: 'pipe',
    })
    expect(result.exitCode, result.stderr.toString()).toBe(0)
    return result.stdout.toString()
  }
  const plan = (id: string) =>
    `## Sprint fixture\n\n- [x] **F.1 — ⚡ Historical close.**\n  Literal evidence.\n\n- [ ] **${id} — ⚡ Tree-specific item.**\n  Worktree body.\n`
  const rows = (path: string) => {
    const database = new Database(path, { readonly: true })
    try {
      return database.query('SELECT id, status, commit_sha FROM plan_items ORDER BY id').all()
    } finally {
      database.close()
    }
  }
  try {
    git(root, ['init', primary])
    writeFileSync(join(primary, 'PLAN.md'), plan('M.1'))
    git(primary, ['add', 'PLAN.md'])
    git(primary, ['commit', '-m', 'historical close'])
    const historicalSha = git(primary, ['rev-parse', 'HEAD'])
    git(primary, ['worktree', 'add', '-b', 'fixture-secondary', secondary])
    writeFileSync(join(secondary, 'PLAN.md'), plan('W.1'))
    git(secondary, ['add', 'PLAN.md'])
    git(secondary, ['commit', '-m', 'secondary plan'])
    expect(git(secondary, ['rev-parse', 'HEAD'])).not.toBe(historicalSha)
    const worktreeGitDir = git(secondary, ['rev-parse', '--absolute-git-dir'])
    const localHome = join(worktreeGitDir, 'orchestos-plan')
    const localDb = join(localHome, '.orchestos', 'db.sqlite')
    const sharedDb = join(sharedHome, '.orchestos', 'db.sqlite')

    // An unusable shared home proves that no shared connection opens, even transiently.
    cli(secondary, 'plan-import.ts', ['--reconcile'], '/dev/null')
    expect(existsSync(sharedDb)).toBe(false)
    expect(rows(localDb)).toEqual([
      { id: 'F.1', status: 'done', commit_sha: historicalSha },
      { id: 'W.1', status: 'open', commit_sha: null },
    ])
    cli(secondary, 'plan-render.ts', ['--check'], '/dev/null')
    cli(secondary, 'plan-gate.ts', [], '/dev/null')
    expect(cli(secondary, 'next.ts', [], '/dev/null')).toContain('W.1')
    cli(secondary, 'check-ledger-gate.ts', [], '/dev/null')
    cli(secondary, 'check-live-gate.ts', [], '/dev/null')

    cli(primary, 'plan-import.ts', ['--reconcile'])
    const primaryRows = rows(sharedDb)
    expect(primaryRows).toEqual([
      { id: 'F.1', status: 'done', commit_sha: historicalSha },
      { id: 'M.1', status: 'open', commit_sha: null },
    ])
    cli(primary, 'plan-render.ts', ['--check'])
    cli(primary, 'plan-gate.ts')
    expect(cli(primary, 'next.ts')).toContain('M.1')
    expect(rows(localDb)).toEqual([
      { id: 'F.1', status: 'done', commit_sha: historicalSha },
      { id: 'W.1', status: 'open', commit_sha: null },
    ])
    cli(secondary, 'plan-import.ts', ['--reconcile'])
    expect(rows(sharedDb)).toEqual(primaryRows)
    cli(primary, 'plan-render.ts', ['--check'])
    cli(secondary, 'plan-render.ts', ['--check'])
    expect(cli(primary, 'plan-render.ts')).toBe(readFileSync(join(primary, 'PLAN.md'), 'utf8'))
    expect(cli(secondary, 'plan-render.ts')).toBe(readFileSync(join(secondary, 'PLAN.md'), 'utf8'))

    // Delete only the fixture's private ledger, then reconstruct without any shared seed.
    rmSync(localHome, { recursive: true, force: true })
    cli(secondary, 'plan-import.ts', ['--reconcile'])
    expect(rows(localDb)[0]).toEqual({
      id: 'F.1',
      status: 'done',
      commit_sha: historicalSha,
    })
    cli(secondary, 'plan-render.ts', ['--check'])
    expect(rows(sharedDb)).toEqual(primaryRows)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}, 30_000)
