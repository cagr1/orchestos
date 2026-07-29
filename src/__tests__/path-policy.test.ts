import { describe, expect, it, afterEach } from 'bun:test'
import { existsSync, mkdtempSync, mkdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { isSafeRelPath, resolveProjectCwd, resolveProjectPath, PathPolicyError } from '../run/path-policy.ts'
import { enforceContract } from '../run/contract.ts'
import { runChecks } from '../run/checks.ts'

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

function makeRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'orchestos-path-policy-'))
  roots.push(root)
  mkdirSync(join(root, 'src'))
  writeFileSync(join(root, 'src', 'safe.txt'), 'safe')
  return root
}

describe('path policy — traversal matrix', () => {
  it.each(['../outside', '/tmp/outside', 'src/../../outside', '%2e%2e/outside', '%252e%252e/outside'])(
    'rejects traversal or absolute path %s', (path) => {
      expect(isSafeRelPath(path)).toBe(false)
    },
  )

  it('rejects a symlink whose target leaves the project', () => {
    const root = makeRoot()
    const outside = mkdtempSync(join(tmpdir(), 'orchestos-path-outside-'))
    roots.push(outside)
    symlinkSync(outside, join(root, 'escape'))

    expect(() => resolveProjectPath(root, 'escape/payload', 'write')).toThrow(PathPolicyError)
    expect(() => enforceContract(root, { files: [{ path: 'escape/payload', content: 'blocked' }] }, ['escape/payload']))
      .toThrow(PathPolicyError)
  })

  it('rejects writing through an in-project symlink too', () => {
    const root = makeRoot()
    symlinkSync(join(root, 'src'), join(root, 'alias'))
    expect(() => resolveProjectPath(root, 'alias/new.txt', 'write')).toThrow(/symlink/)
  })

  it('accepts a normal nested path and cwd only inside the project', () => {
    const root = makeRoot()
    expect(resolveProjectPath(root, 'src/new.txt', 'write')).toBe(join(realpathSync(root), 'src', 'new.txt'))
    expect(resolveProjectCwd(root, 'src')).toBe(join(realpathSync(root), 'src'))
    expect(() => resolveProjectCwd(root, '../')).toThrow(PathPolicyError)
  })

  it('does not interpret command metacharacters as shell syntax', async () => {
    const root = makeRoot()
    const marker = join(root, 'injected.txt')
    const logger = { error() {} } as any
    const results = await runChecks([{ cmd: `printf 'safe; touch ${marker}'` }], root, logger)
    expect(results[0]?.exitCode).toBe(0)
    expect(existsSync(marker)).toBe(false)
    expect(results[0]?.stdout).toContain('safe; touch')
  })

  it('does not pass an arbitrary parent secret to a check process', async () => {
    const root = makeRoot()
    const logger = { error() {} } as any
    const previous = process.env.INTERNAL_TEST_SECRET
    process.env.INTERNAL_TEST_SECRET = 'not-secret'
    try {
      const results = await runChecks([{ cmd: 'env' }], root, logger)
      expect(results[0]?.exitCode).toBe(0)
      expect(results[0]?.stdout).not.toContain('INTERNAL_TEST_SECRET=')
    } finally {
      if (previous === undefined) delete process.env.INTERNAL_TEST_SECRET
      else process.env.INTERNAL_TEST_SECRET = previous
    }
  })
})
