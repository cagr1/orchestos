import { afterEach, describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { handleApiProjectGit } from '../handlers/project.ts'

const roots: string[] = []

function makeRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'orchestos-project-git-'))
  roots.push(root)
  return root
}

function runGit(root: string, args: string[]): void {
  const result = Bun.spawnSync(['git', ...args], {
    cwd: root,
    env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' },
    stdout: 'pipe',
    stderr: 'pipe',
  })
  if (result.exitCode !== 0) throw new Error(result.stderr.toString())
}

async function status(root: string): Promise<boolean | null> {
  return ((await handleApiProjectGit(root).json()) as { isCleanWorktree: boolean | null })
    .isCleanWorktree
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('handleApiProjectGit', () => {
  it('reports a clean worktree as true and uncommitted files as false', async () => {
    const root = makeRoot()
    runGit(root, ['init'])
    writeFileSync(join(root, 'tracked.txt'), 'clean\n')
    runGit(root, ['add', 'tracked.txt'])
    runGit(root, ['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-m', 'fixture'])

    expect(await status(root)).toBe(true)
    writeFileSync(join(root, 'uncommitted.txt'), 'dirty\n')
    expect(await status(root)).toBe(false)
  })

  it('reports null when the directory is not a git repository', async () => {
    expect(await status(makeRoot())).toBeNull()
  })
})
