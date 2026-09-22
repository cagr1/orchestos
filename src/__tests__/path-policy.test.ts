import { afterEach, describe, expect, it } from 'bun:test'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { runChecks, runOneCheck } from '../run/checks.ts'
import { enforceContract } from '../run/contract.ts'
import {
  isSafeRelPath,
  PathPolicyError,
  resolveProjectCwd,
  resolveProjectPath,
} from '../run/path-policy.ts'

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
  it.each([
    '../outside',
    '/tmp/outside',
    'src/../../outside',
    '%2e%2e/outside',
    '%252e%252e/outside',
  ])('rejects traversal or absolute path %s', (path) => {
    expect(isSafeRelPath(path)).toBe(false)
  })

  it('rejects a symlink whose target leaves the project', () => {
    const root = makeRoot()
    const outside = mkdtempSync(join(tmpdir(), 'orchestos-path-outside-'))
    roots.push(outside)
    symlinkSync(outside, join(root, 'escape'))

    expect(() => resolveProjectPath(root, 'escape/payload', 'write')).toThrow(PathPolicyError)
    expect(() =>
      enforceContract(root, { files: [{ path: 'escape/payload', content: 'blocked' }] }, [
        'escape/payload',
      ]),
    ).toThrow(PathPolicyError)
  })

  it('rejects writing through an in-project symlink too', () => {
    const root = makeRoot()
    symlinkSync(join(root, 'src'), join(root, 'alias'))
    expect(() => resolveProjectPath(root, 'alias/new.txt', 'write')).toThrow(/symlink/)
  })

  it('accepts a normal nested path and cwd only inside the project', () => {
    const root = makeRoot()
    expect(resolveProjectPath(root, 'src/new.txt', 'write')).toBe(
      join(realpathSync(root), 'src', 'new.txt'),
    )
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

  it('confines command path arguments to the real project root', async () => {
    const root = makeRoot()
    const outside = mkdtempSync(join(tmpdir(), 'orchestos-command-outside-'))
    roots.push(outside)
    writeFileSync(join(outside, 'secret.txt'), 'secret')
    symlinkSync(join(outside, 'secret.txt'), join(root, 'src', 'escape.txt'))
    const logger = { error() {} } as any

    const rejected = await runChecks([{ cmd: 'cat ../secret.txt' }], root, logger)
    expect(rejected[0]).toMatchObject({ exitCode: 1, stderr: 'path outside project: ../secret.txt' })

    const symlinkRejected = await runChecks([{ cmd: 'cat src/escape.txt' }], root, logger)
    expect(symlinkRejected[0]).toMatchObject({ exitCode: 1, stderr: 'path outside project: src/escape.txt' })

    const accepted = await runChecks([{ cmd: 'ls src' }], root, logger)
    expect(accepted[0]?.exitCode).toBe(0)

    writeFileSync(join(root, 'package.json'), '{"name":"fixture"}')
    const cwdSrc = await runOneCheck({ cmd: 'cat ../package.json', cwd: 'src' }, root)
    expect(cwdSrc.exitCode).toBe(0)
    expect(cwdSrc.stdout).toContain('fixture')

    const optionPath = await runOneCheck({ cmd: 'cat --x=../secret.txt' }, root)
    expect(optionPath).toMatchObject({ exitCode: 1, stderr: 'path outside project: --x=../secret.txt' })
  })
})
