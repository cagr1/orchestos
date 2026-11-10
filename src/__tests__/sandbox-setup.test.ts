import { describe, expect, it, spyOn } from 'bun:test'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createWorktree, git, mergeWorktreeBack } from '../run/sandbox.ts'

function fixture() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'orchestos-setup-')))
  git(['init', '-b', 'main'], root)
  writeFileSync(join(root, 'README.md'), 'main\n')
  git(['add', '.'], root)
  const commit = git(
    [
      '-c',
      'user.name=fixture',
      '-c',
      'user.email=fixture@example.invalid',
      'commit',
      '-m',
      'fixture',
    ],
    root,
  )
  expect(commit.exitCode, commit.stderr).toBe(0)
  return root
}

describe('worktree setup script', () => {
  it('runs in the worktree after node_modules is linked, with both root variables', () => {
    const root = fixture()
    mkdirSync(join(root, 'node_modules'))
    let worktree
    try {
      worktree = createWorktree(
        'setup',
        'main',
        root,
        'test -L node_modules && test "$PWD" = "$ORCHESTOS_WORKTREE" && printf "%s" "$ORCHESTOS_PROJECT_ROOT" > .setup-ran',
      )
      expect(readFileSync(join(worktree.path, '.setup-ran'), 'utf8')).toBe(root)
      expect(existsSync(join(root, '.setup-ran'))).toBe(false)
    } finally {
      worktree?.cleanup()
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('reports the last 20 output lines in order and removes the worktree and branch', () => {
    const root = fixture()
    try {
      expect(() =>
        createWorktree(
          'setup-fail',
          'main',
          root,
          'echo FIRST; i=1; while [ "$i" -le 25 ]; do echo "line-$i"; i=$((i+1)); done; echo STDERR >&2; exit 3',
        ),
      ).toThrow(/exit 3/)
      expect(readdirSync(join(root, '.orchestos', 'worktrees'))).toEqual([])
      expect(git(['branch', '--list', 'orchestos/*'], root).stdout).toBe('')
      try {
        createWorktree(
          'setup-output',
          'main',
          root,
          'echo FIRST; i=1; while [ "$i" -le 25 ]; do echo "line-$i"; i=$((i+1)); done; echo STDERR >&2; exit 3',
        )
        throw new Error('setup should have failed')
      } catch (error) {
        expect(String(error)).toContain('line-25\nSTDERR')
        expect(String(error)).not.toContain('FIRST')
        expect(String(error)).not.toContain('\nline-6\n')
      }
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('enforces the ten-minute timeout and cleans up after termination', () => {
    const root = fixture()
    const spawn = Bun.spawnSync.bind(Bun)
    // Shorten only the script timeout; still exercise a real shell termination.
    const probe = spyOn(Bun, 'spawnSync').mockImplementation(((
      args: string[],
      options: Record<string, unknown>,
    ) => {
      if (args[0] === 'sh') {
        expect(options.timeout).toBe(600_000)
        expect(options.killSignal).toBe('SIGKILL')
        return spawn(args, { ...options, timeout: 30 })
      }
      return spawn(args, options)
    }) as typeof Bun.spawnSync)
    try {
      expect(() =>
        createWorktree('setup-timeout', 'main', root, 'echo TIMEOUT-MARKER; while :; do :; done'),
      ).toThrow(/timeout after 10 minutes[\s\S]*TIMEOUT-MARKER/)
      expect(readdirSync(join(root, '.orchestos', 'worktrees'))).toEqual([])
      expect(git(['branch', '--list', 'orchestos/*'], root).stdout).toBe('')
    } finally {
      probe.mockRestore()
      rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('merge back preserves the user checkout', () => {
  for (const strategy of ['commit', 'squash'] as const) {
    for (const checkedOut of [true, false]) {
      it(`${strategy}, base ${checkedOut ? 'checked out' : 'not checked out'}`, () => {
        const root = fixture()
        // Production makes commits: identity belongs only to this disposable repository.
        git(['config', 'user.name', 'fixture'], root)
        git(['config', 'user.email', 'fixture@example.invalid'], root)
        git(['branch', 'develop'], root)
        if (checkedOut) git(['checkout', 'develop'], root)
        const mainBefore = git(['rev-parse', 'main'], root).stdout
        const headBefore = git(['rev-parse', 'HEAD'], root).stdout
        const baseBefore = git(['rev-parse', 'develop'], root).stdout
        const worktree = createWorktree('merge-settings', 'develop', root)
        try {
          writeFileSync(join(worktree.path, 'first.txt'), 'first')
          git(['add', 'first.txt'], worktree.path)
          expect(git(['commit', '-m', 'first'], worktree.path).exitCode).toBe(0)
          writeFileSync(join(worktree.path, 'second.txt'), 'second')
          const merged = mergeWorktreeBack(worktree, strategy, 'settings fixture', [
            'first.txt',
            'second.txt',
          ])
          expect(merged).toBe(git(['rev-parse', 'develop'], root).stdout)
          expect(worktree.mergedBaseSha).toBe(baseBefore)
          expect(git(['show', 'develop:first.txt'], root).stdout).toBe('first')
          expect(git(['show', 'develop:second.txt'], root).stdout).toBe('second')
          expect(git(['rev-parse', 'main'], root).stdout).toBe(mainBefore)
          expect(git(['branch', '--show-current'], root).stdout).toBe(
            checkedOut ? 'develop' : 'main',
          )
          if (!checkedOut) expect(git(['rev-parse', 'HEAD'], root).stdout).toBe(headBefore)
          expect(git(['rev-list', '--count', `${baseBefore}..develop`], root).stdout).toBe(
            strategy === 'squash' ? '1' : '2',
          )
          expect(existsSync(worktree.path)).toBe(false)
          if (!checkedOut) {
            expect(existsSync(join(root, 'first.txt'))).toBe(false)
            expect(readFileSync(join(root, 'README.md'), 'utf8')).toBe('main\n')
          }
        } finally {
          if (existsSync(worktree.path)) worktree.cleanup()
          rmSync(root, { recursive: true, force: true })
        }
      })
    }
  }

  it('rebases onto a diverged base without changing main', () => {
    const root = fixture()
    git(['config', 'user.name', 'fixture'], root)
    git(['config', 'user.email', 'fixture@example.invalid'], root)
    git(['branch', 'develop'], root)
    const worktree = createWorktree('diverged-settings', 'develop', root)
    try {
      writeFileSync(join(root, 'base.txt'), 'base')
      git(['add', 'base.txt'], root)
      git(['commit', '-m', 'base advanced'], root)
      git(['branch', '-f', 'develop', 'main'], root)
      const main = git(['rev-parse', 'HEAD'], root).stdout
      const baseBefore = git(['rev-parse', 'develop'], root).stdout
      writeFileSync(join(worktree.path, 'task.txt'), 'task')
      expect(mergeWorktreeBack(worktree, 'commit', undefined, ['task.txt'])).toBeTruthy()
      expect(worktree.mergedBaseSha).toBe(baseBefore)
      expect(git(['show', 'develop:task.txt'], root).stdout).toBe('task')
      expect(git(['show', 'develop:base.txt'], root).stdout).toBe('base')
      expect(git(['rev-parse', 'HEAD'], root).stdout).toBe(main)
      expect(git(['branch', '--show-current'], root).stdout).toBe('main')
    } finally {
      if (existsSync(worktree.path)) worktree.cleanup()
      rmSync(root, { recursive: true, force: true })
    }
  })
})
