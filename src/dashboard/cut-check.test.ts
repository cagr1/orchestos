import { expect, test } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { type CutGit, cutBaseHead, cutCheck } from './cut-check'

function fixture(
  run: (root: string, git: CutGit) => void,
  options: { status?: string; counts?: string; upstream?: boolean; next?: string } = {},
) {
  const root = mkdtempSync(join(tmpdir(), 'cut-check-'))
  mkdirSync(join(root, '.git'))
  const git: CutGit = (_root, args) => {
    expect(_root).toBe(root)
    switch (args.join(' ')) {
      case 'status --porcelain':
        return options.status ?? ''
      case 'rev-parse --abbrev-ref HEAD':
        return 'main'
      case 'rev-parse --abbrev-ref @{u}':
        if (options.upstream === false) throw new Error('no upstream')
        return 'origin/main'
      case 'rev-list --left-right --count HEAD...@{u}':
        return options.counts ?? '0\t0'
      case 'rev-parse --git-dir':
        return '.git'
      case 'diff --name-only base-head -- NEXT.md':
        return options.next ? 'NEXT.md' : ''
      case 'ls-tree --name-only HEAD -- NEXT.md':
        return options.next === 'commit' ? 'NEXT.md' : ''
      default:
        throw new Error(`Unexpected git command: ${args.join(' ')}`)
    }
  }
  try {
    run(root, git)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

test('clean and up to date', () =>
  fixture((root, git) => {
    expect(cutCheck(root, undefined, { git })).toEqual({
      baseHead: null,
      dirty: [],
      dirtyTotal: 0,
      branch: 'main',
      upstream: 'origin/main',
      ahead: 0,
      behind: 0,
      lock: 'none',
      handoff: null,
    })
  }))

test('dirty paths retain spaces and are capped at 20 with the full count', () =>
  fixture(
    (root, git) => {
      const report = cutCheck(root, undefined, { git })
      expect(report.dirtyTotal).toBe(25)
      expect(report.dirty).toHaveLength(20)
      expect(report.dirty[0]).toBe('some file 0.txt')
    },
    { status: Array.from({ length: 25 }, (_, i) => ` M some file ${i}.txt`).join('\n') },
  ))

test('ahead two and behind one', () =>
  fixture(
    (root, git) => {
      const report = cutCheck(root, undefined, { git })
      expect(report.ahead).toBe(2)
      expect(report.behind).toBe(1)
    },
    { counts: '2\t1' },
  ))

test('no upstream cannot look pushed', () =>
  fixture(
    (root, git) => {
      const report = cutCheck(root, undefined, { git })
      expect(report.upstream).toBeNull()
      expect(report.ahead).toBeNull()
      expect(report.behind).toBeNull()
    },
    { upstream: false },
  ))

for (const [owner, status, expected] of [
  ['own', '', 'released'],
  ['other', '', 'held-by-other'],
  ['own', ' M file', 'held'],
] as const)
  test(`lock ${owner}, status ${status}: ${expected}`, () =>
    fixture(
      (root, git) => {
        const path = join(root, '.git', 'agent-writer.lock')
        const content = JSON.stringify({ session: owner })
        writeFileSync(path, content)
        expect(cutCheck(root, 'own', { git }).lock).toBe(expected)
        expect(existsSync(path)).toBe(expected !== 'released')
        if (expected !== 'released') expect(readFileSync(path, 'utf8')).toBe(content)
      },
      { status },
    ))

test('without a CLI session ID the lock is only reported', () =>
  fixture((root, git) => {
    writeFileSync(join(root, '.git', 'agent-writer.lock'), JSON.stringify({ session: 'own' }))
    expect(cutCheck(root, undefined, { git }).lock).toBe('held-by-other')
  }))

for (const content of ['{', ''])
  test(`unreadable lock ${JSON.stringify(content)} is kept and marks the check incomplete`, () =>
    fixture((root, git) => {
      const path = join(root, '.git', 'agent-writer.lock')
      writeFileSync(path, content)
      const report = cutCheck(root, 'own', { git })
      expect(report.lock).toBe('held-by-other')
      expect(report.checkFailed).toBe(true)
      expect(readFileSync(path, 'utf8')).toBe(content)
    }))

test('a failed git check still returns an incomplete report with the reply handoff', () => {
  const report = cutCheck('/unused', undefined, {
    git: () => {
      throw new Error('git unavailable')
    },
    reply: '## Handoff\nContinue here',
  })
  expect(report.checkFailed).toBe(true)
  expect(report.ahead).toBeNull()
  expect(report.handoff).toBe('Continue here')
})

test('git init without commits produces a report including an untracked NEXT.md', () => {
  const root = mkdtempSync(join(tmpdir(), 'cut-unborn-'))
  try {
    const init = Bun.spawnSync(['git', 'init', '--initial-branch=main', root])
    expect(init.exitCode).toBe(0)
    writeFileSync(join(root, 'NEXT.md'), '# Next')
    expect(cutCheck(root)).toEqual({
      baseHead: null,
      dirty: ['NEXT.md'],
      dirtyTotal: 1,
      branch: 'main',
      upstream: null,
      ahead: 0,
      behind: 0,
      lock: 'none',
      handoff: 'next-md',
    })
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

for (const next of ['tree', 'commit'])
  test(`NEXT.md changed in ${next}`, () =>
    fixture(
      (root, git) => {
        writeFileSync(join(root, 'NEXT.md'), '# Next')
        expect(
          cutCheck(root, undefined, { git, baseHead: 'base-head', reply: '## Handoff\nFallback' })
            .handoff,
        ).toBe('next-md')
      },
      { next },
    ))

test('unchanged NEXT.md falls back to the final reply', () =>
  fixture((root, git) => {
    writeFileSync(join(root, 'NEXT.md'), '# Old')
    expect(
      cutCheck(root, undefined, {
        git,
        baseHead: 'base-head',
        reply: 'Done\n## Handoff\nNext steps\n### Detail\nMore\n## Other\nExcluded',
      }).handoff,
    ).toBe('Next steps\n### Detail\nMore')
    expect(
      cutCheck(root, undefined, {
        git,
        baseHead: 'base-head',
        reply: '## Handoff\n' + 'a'.repeat(4100),
      }).handoff,
    ).toHaveLength(4000)
  }))

test('NEXT.md from the initial commit before the turn is not a new handoff', () => {
  const root = mkdtempSync(join(tmpdir(), 'cut-base-'))
  const git: CutGit = (_root, args) => {
    const result = Bun.spawnSync([
      'git',
      '-C',
      _root,
      '-c',
      'user.name=fixture',
      '-c',
      'user.email=fixture@invalid',
      ...args,
    ])
    if (result.exitCode !== 0) throw new Error(new TextDecoder().decode(result.stderr))
    return new TextDecoder().decode(result.stdout).trimEnd()
  }
  try {
    git(root, ['init', '--initial-branch=main'])
    expect(cutBaseHead(root, git)).toBeNull()
    writeFileSync(join(root, 'NEXT.md'), '# Old handoff')
    git(root, ['add', 'NEXT.md'])
    git(root, ['commit', '-m', 'initial handoff'])
    const baseHead = cutBaseHead(root, git)
    expect(baseHead).not.toBeNull()
    const unchanged = cutCheck(root, undefined, { git, baseHead })
    expect(unchanged.checkFailed).toBeUndefined()
    expect(unchanged.baseHead).toBe(baseHead)
    expect(unchanged.handoff).toBeNull()
    expect(cutCheck(root, undefined, { git }).handoff).toBe('next-md')
    writeFileSync(join(root, 'NEXT.md'), '# New handoff')
    expect(cutCheck(root, undefined, { git, baseHead }).handoff).toBe('next-md')
    git(root, ['add', 'NEXT.md'])
    git(root, ['commit', '-m', 'wrap up'])
    writeFileSync(join(root, 'other.txt'), 'another commit after the handoff')
    git(root, ['add', 'other.txt'])
    git(root, ['commit', '-m', 'follow up'])
    expect(cutCheck(root, undefined, { git, baseHead }).handoff).toBe('next-md')
    expect(cutCheck(root, undefined, { git }).handoff).toBe('next-md')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
