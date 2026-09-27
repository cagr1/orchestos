import { afterEach, describe, expect, test } from 'bun:test'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { provisionCliConfigHome } from './executors/cli-registry.ts'
import { excludeRuntimeArtifacts } from './git-exclude.ts'
import { RunLogger } from './logger.ts'

const roots: string[] = []

function tempDir(): string {
  const root = mkdtempSync(join(tmpdir(), 'orchestos-git-exclude-'))
  roots.push(root)
  return root
}

function git(args: string[], cwd: string): string {
  const proc = Bun.spawnSync(['git', ...args], { cwd, env: { ...process.env } })
  if (proc.exitCode !== 0) throw new Error(proc.stderr.toString())
  return proc.stdout.toString().trim()
}

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('excludeRuntimeArtifacts', () => {
  test('keeps logger and CLI config artifacts out of project status idempotently', () => {
    const root = tempDir()
    git(['init'], root)
    git(['config', 'user.email', 'test@example.com'], root)
    git(['config', 'user.name', 'Test'], root)
    writeFileSync(join(root, 'tracked.txt'), 'tracked\n')
    writeFileSync(join(root, '.gitignore'), '# user rules\n')
    git(['add', 'tracked.txt'], root)
    git(['add', '.gitignore'], root)
    git(['commit', '-m', 'initial'], root)

    new RunLogger(root, 't1')
    provisionCliConfigHome(root, 'claude', tempDir())

    expect(git(['status', '--porcelain'], root)).toBe('')
    const excludePath = join(root, git(['rev-parse', '--git-path', 'info/exclude'], root))
    const before = readFileSync(excludePath, 'utf8')
    excludeRuntimeArtifacts(root)
    expect(readFileSync(excludePath, 'utf8')).toBe(before)
    expect(before.match(/^\/runs\/\*\.log$/gm)).toHaveLength(1)
    expect(before.match(/^\/.orchestos\/agent-home\/$/gm)).toHaveLength(1)
    expect(existsSync(join(root, '.gitignore'))).toBe(true)
    expect(readFileSync(join(root, '.gitignore'), 'utf8')).toBe('# user rules\n')
  })

  test('does not throw outside a Git repository', () => {
    const root = tempDir()
    expect(() => excludeRuntimeArtifacts(root)).not.toThrow()
  })
})
