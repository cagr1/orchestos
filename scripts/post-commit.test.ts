import { expect, test } from 'bun:test'
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

for (const withPostCommit of [false, true]) {
  test(`commit parcial ${withPostCommit ? 'sincroniza' : 'desfasa'} el índice de derivados`, () => {
    const root = mkdtempSync(join(tmpdir(), 'orchestos-post-commit-'))
    const git = (...args: string[]) => {
      const result = Bun.spawnSync(
        ['git', '-c', 'user.name=Hook Test', '-c', 'user.email=hook@example.test', ...args],
        { cwd: root, stdout: 'pipe', stderr: 'pipe' },
      )
      expect(result.exitCode, result.stderr.toString()).toBe(0)
      return result.stdout.toString()
    }

    try {
      git('init', '-q')
      writeFileSync(join(root, 'otro.txt'), 'original\n')
      writeFileSync(join(root, 'runs-summary.json'), '[]\n')
      git('add', '--', 'otro.txt', 'runs-summary.json')
      git('-c', 'core.hooksPath=.git/hooks', 'commit', '-qm', 'initial')

      const preCommit = join(root, '.git/hooks/pre-commit')
      mkdirSync(join(root, '.git/hooks'), { recursive: true })
      writeFileSync(
        preCommit,
        "#!/usr/bin/env bash\nset -eu\nprintf '[1]\\n' > runs-summary.json\ngit add -- runs-summary.json\n",
      )
      chmodSync(preCommit, 0o755)
      if (withPostCommit) {
        const postCommit = join(root, '.git/hooks/post-commit')
        copyFileSync(new URL('./post-commit.sh', import.meta.url), postCommit)
        chmodSync(postCommit, 0o755)
      }

      writeFileSync(join(root, 'otro.txt'), 'changed\n')
      git('-c', 'core.hooksPath=.git/hooks', 'commit', '-qm', 'x', '--', 'otro.txt')

      expect(git('show', 'HEAD:runs-summary.json')).toBe('[1]\n')
      expect(git('status', '--porcelain')).toBe(withPostCommit ? '' : 'MM runs-summary.json\n')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
}
