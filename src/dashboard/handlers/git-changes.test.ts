import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, renameSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { handleApiGitChanges, handleApiGitDiff } from './git-changes.ts'

let root: string
function git(...args: string[]) {
  const result = Bun.spawnSync(['git', ...args], { cwd: root, stdout: 'pipe', stderr: 'pipe' })
  if (result.exitCode !== 0) throw new Error(result.stderr.toString())
}
function diff(path: string) {
  return handleApiGitDiff(
    new URL(`http://localhost/api/git/diff?path=${encodeURIComponent(path)}`),
    root,
  )
}
function write(path: string, text: string) {
  writeFileSync(join(root, path), text)
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'git-changes-'))
  git('init')
})
afterEach(() => rmSync(root, { recursive: true, force: true }))
function commit() {
  git('add', '.')
  git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-m', 'fixture')
}

describe('git changes', () => {
  test('working tree, staged, untracked, deleted and combined counts', async () => {
    write('modified.txt', 'before\n')
    write('deleted.txt', 'gone\n')
    commit()
    write('modified.txt', 'staged\n')
    git('add', 'modified.txt')
    write('modified.txt', 'after\nextra\n')
    write('added.txt', 'added\n')
    git('add', 'added.txt')
    write('new file.txt', 'one\ntwo')
    unlinkSync(join(root, 'deleted.txt'))
    const response = handleApiGitChanges(root)
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.branch).toBeTruthy()
    expect(data.files).toEqual([
      { path: 'added.txt', status: 'A', additions: 1, deletions: 0 },
      { path: 'deleted.txt', status: 'D', additions: 0, deletions: 1 },
      { path: 'modified.txt', status: 'M', additions: 2, deletions: 1 },
      { path: 'new file.txt', status: 'U', additions: 2, deletions: 0 },
    ])
    expect((await diff('modified.txt').json()).patch).toContain('+after')
    expect((await diff('new file.txt').json()).patch).toContain('+two')
    expect((await diff('deleted.txt').json()).patch).toContain('-gone')
    expect((await diff('added.txt').json()).patch).toContain('+added')
  })

  test('no HEAD lists staged and untracked files', async () => {
    write('staged.txt', 'staged\n')
    git('add', 'staged.txt')
    write('untracked.txt', 'new\n')
    expect((await handleApiGitChanges(root).json()).files).toEqual([
      { path: 'staged.txt', status: 'A', additions: 1, deletions: 0 },
      { path: 'untracked.txt', status: 'U', additions: 1, deletions: 0 },
    ])
    expect((await diff('staged.txt').json()).patch).toContain('+staged')
  })

  test('rename uses destination and parses NUL numstat', async () => {
    write('old.txt', 'same\n'.repeat(20))
    commit()
    renameSync(join(root, 'old.txt'), join(root, 'new.txt'))
    write('new.txt', `${'same\n'.repeat(20)}extra\n`)
    git('add', '.')
    expect((await handleApiGitChanges(root).json()).files).toEqual([
      { path: 'new.txt', status: 'R', additions: 1, deletions: 0 },
    ])
  })

  test('binary, empty and large untracked files have zero counts', async () => {
    write('binary', 'before\0')
    commit()
    write('binary', 'after\0')
    write('new-binary', '\0abc')
    write('large', 'x'.repeat(1_000_001))
    write('empty', '')
    const data = await handleApiGitChanges(root).json()
    expect(data.files).toHaveLength(4)
    for (const file of data.files) {
      expect(file.additions).toBe(0)
      expect(file.deletions).toBe(0)
    }
  })

  test('rejects missing and outside paths', () => {
    expect(diff('../outside').status).toBe(400)
    expect(diff(`${root}-outside/file`).status).toBe(400)
    expect(diff('/etc/passwd').status).toBe(400)
    expect(diff('').status).toBe(400)
  })

  test('non git directory returns an empty list', async () => {
    rmSync(join(root, '.git'), { recursive: true, force: true })
    expect(await handleApiGitChanges(root).json()).toEqual({ branch: null, files: [] })
  })

  test('truncates patches over 200 KB', async () => {
    write('large.txt', 'line\n'.repeat(50_000))
    const data = await diff('large.txt').json()
    expect(data.patch).toEndWith('\n… diff truncated')
    expect(Buffer.byteLength(data.patch)).toBeLessThan(200_100)
  })
})
