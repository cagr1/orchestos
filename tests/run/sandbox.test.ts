import { describe, it, expect, afterEach } from 'bun:test'
import { mkdtempSync, writeFileSync, existsSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { createWorktree, mergeWorktreeBack, git } from '../../src/run/sandbox.ts'

function makeGitRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'orchestos-sandbox-test-'))
  git(['init', '-b', 'main'], dir)
  git(['config', 'user.email', 'test@test.com'], dir)
  git(['config', 'user.name', 'Test'], dir)
  // initial commit required so HEAD exists
  writeFileSync(join(dir, 'README.md'), 'init')
  git(['add', '-A'], dir)
  git(['commit', '-m', 'init'], dir)
  return dir
}

const repos: string[] = []
afterEach(() => {
  for (const r of repos.splice(0)) {
    try { rmSync(r, { recursive: true, force: true }) } catch {}
  }
})

describe('createWorktree', () => {
  it('creates a worktree with the expected structure', () => {
    const root = makeGitRepo()
    repos.push(root)

    const wt = createWorktree('my-task', 'main', root)
    expect(existsSync(wt.path)).toBe(true)
    expect(wt.branch).toMatch(/^orchestos\/my.task\/\d+$/)
    expect(wt.baseBranch).toBe('main')
    expect(wt.projectRoot).toBe(root)

    wt.cleanup()
    expect(existsSync(wt.path)).toBe(false)
  })

  it('sanitizes task id for branch name', () => {
    const root = makeGitRepo()
    repos.push(root)

    const wt = createWorktree('My Task 123!', 'main', root)
    expect(wt.branch).toMatch(/^orchestos\/my_task_123_\/\d+$/)
    wt.cleanup()
  })

  it('throws when not a git repo', () => {
    const dir = mkdtempSync(join(tmpdir(), 'orchestos-nogit-'))
    repos.push(dir)
    expect(() => createWorktree('t', 'main', dir)).toThrow('Not a git repository')
  })

  it('throws when baseBranch does not exist', () => {
    const root = makeGitRepo()
    repos.push(root)
    expect(() => createWorktree('t', 'nonexistent', root)).toThrow('does not exist locally')
  })
})

describe('mergeWorktreeBack — discard', () => {
  it('removes worktree and branch on discard', () => {
    const root = makeGitRepo()
    repos.push(root)

    const wt = createWorktree('discard-task', 'main', root)
    const wtPath = wt.path
    const branch = wt.branch

    mergeWorktreeBack(wt, 'discard')

    expect(existsSync(wtPath)).toBe(false)
    const branchList = git(['branch'], root).stdout
    expect(branchList).not.toContain(branch)
  })
})

describe('mergeWorktreeBack — commit', () => {
  it('commits changes in worktree and merges ff-only to base', () => {
    const root = makeGitRepo()
    repos.push(root)

    const wt = createWorktree('commit-task', 'main', root)
    writeFileSync(join(wt.path, 'output.txt'), 'hello from worktree')

    mergeWorktreeBack(wt, 'commit', 'test: add output.txt')

    // worktree removed
    expect(existsSync(wt.path)).toBe(false)

    // file merged back to main
    expect(existsSync(join(root, 'output.txt'))).toBe(true)

    // commit message in log
    const log = git(['log', '--oneline', '-1'], root).stdout
    expect(log).toContain('test: add output.txt')
  })

  it('handles no-change worktree gracefully', () => {
    const root = makeGitRepo()
    repos.push(root)

    const wt = createWorktree('no-change-task', 'main', root)
    // no files written
    mergeWorktreeBack(wt, 'commit', 'test: no changes')

    expect(existsSync(wt.path)).toBe(false)
    // base branch still on main, no error
    const branch = git(['rev-parse', '--abbrev-ref', 'HEAD'], root).stdout
    expect(branch).toBe('main')
  })
})

describe('mergeWorktreeBack — squash', () => {
  it('squash-merges uncommitted changes as a single commit on base', () => {
    const root = makeGitRepo()
    repos.push(root)

    const wt = createWorktree('squash-task', 'main', root)
    // write uncommitted files — mergeWorktreeBack will add+commit them in the worktree, then squash into base
    writeFileSync(join(wt.path, 'a.txt'), 'A')
    writeFileSync(join(wt.path, 'b.txt'), 'B')

    mergeWorktreeBack(wt, 'squash', 'test: squashed')

    expect(existsSync(wt.path)).toBe(false)
    expect(existsSync(join(root, 'a.txt'))).toBe(true)
    expect(existsSync(join(root, 'b.txt'))).toBe(true)
    const log = git(['log', '--oneline', '-1'], root).stdout
    expect(log).toContain('test: squashed')
  })
})
