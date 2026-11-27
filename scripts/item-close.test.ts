import { afterEach, expect, test } from 'bun:test'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { hasLiveGateEvidence } from './agent-governance.ts'
import { type CommandRunner, closeItem, runCommand } from './item-close.ts'

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

function fixture(trackSpec = true) {
  const root = mkdtempSync(join(tmpdir(), 'item-close-'))
  roots.push(root)
  const git = (...args: string[]) => {
    const result = runCommand(['git', ...args], root)
    if (result.exitCode) throw new Error(result.stderr)
    return result.stdout
  }
  const write = (path: string, text: string) => {
    mkdirSync(join(root, path, '..'), { recursive: true })
    writeFileSync(join(root, path), text)
  }
  git('init', '-q')
  write(
    'PLAN.md',
    '## Fixture\n- [ ] **F.1 — Fixture.**\n  Hecho: resultado del cerebro.\n\n- [ ] **F.2 — Otro.**\n  No tocar.\n',
  )
  write('file.ts', 'export const value = 1\n')
  write('docs/specs/F.1.md', '# Spec\n')
  git('add', '--', 'PLAN.md', 'file.ts', ...(trackSpec ? ['docs/specs/F.1.md'] : []))
  git(
    '-c',
    'user.name=fixture',
    '-c',
    'user.email=fixture@example.invalid',
    'commit',
    '-qm',
    'base',
  )
  write('file.ts', 'export const value = 2\n')
  write('evidence.json', '{}\n')
  const commands: string[][] = []
  const output: string[] = []
  let reconciles = 0
  let failCommit = false
  const runner: CommandRunner = (command, cwd) => {
    commands.push(command)
    if (command[0] === 'node' || command[0] === 'bunx' || command[1] === 'push')
      return { exitCode: 0, stdout: '', stderr: '' }
    if (command[1] === 'commit') {
      if (failCommit) return { exitCode: 1, stdout: 'hook stdout\n', stderr: 'hook stderr\n' }
      return runCommand(
        [
          'git',
          '-c',
          'user.name=fixture',
          '-c',
          'user.email=fixture@example.invalid',
          ...command.slice(1),
        ],
        cwd,
      )
    }
    return runCommand(command, cwd)
  }
  const dependencies = {
    runner,
    writerLockPath: join(root, 'missing-lock.js'),
    reconcile: () => {
      reconciles += 1
    },
    output: (text: string) => output.push(text),
  }
  const args = [
    '--item',
    'F.1',
    '--message',
    'close fixture',
    '--path',
    'file.ts',
    '--executor',
    'fixture (criterio)',
    '--spec',
    'docs/specs/F.1.md',
    '--live',
    'Playwright flujo 9/9',
    '--evidence',
    'evidence.json',
  ]
  return {
    root,
    git,
    write,
    commands,
    output,
    dependencies,
    args,
    reconciles: () => reconciles,
    failCommit: (value: boolean) => {
      failCommit = value
    },
  }
}

test('reports three validation errors together without mutations', async () => {
  const f = fixture()
  const before = f.git('status', '--porcelain')
  expect(await closeItem(['--item', 'F.1'], f.root, f.dependencies)).toBe(1)
  expect(f.output.join('\n').split('\n')).toHaveLength(3)
  expect(f.git('status', '--porcelain')).toBe(before)
  expect(f.reconciles()).toBe(0)
})

test('closes by explicit paths, produces gate-compatible declarations and keeps caller trailer last', async () => {
  const f = fixture()
  f.args.push('--body', 'Details\n\nCo-Authored-By: Fixture <fixture@example.invalid>')
  f.write('unrelated.txt', 'do not commit\n')
  expect(await closeItem(f.args, f.root, f.dependencies)).toBe(0)
  const plan = readFileSync(join(f.root, 'PLAN.md'), 'utf8')
  expect(plan).toMatch(/^\s+Ejecutado por: .+?· Spec: (docs\/specs\/[^\s`)]+\.md)$/m)
  expect(plan).toContain('  Hecho: resultado del cerebro.')
  expect(plan).toContain('- [ ] **F.2 — Otro.**\n  No tocar.')
  const diff = f.git('show', '--format=', '--', 'PLAN.md')
  expect(hasLiveGateEvidence(diff, ['evidence.json'])).toBe(true)
  expect(existsSync(join(f.root, 'docs/specs/F.1.md'))).toBe(false)
  expect(f.reconciles()).toBe(2)
  expect(f.git('log', '-1', '--format=%B').trim()).toEndWith(
    'Co-Authored-By: Fixture <fixture@example.invalid>',
  )
  expect(f.git('show', '--format=', '--name-only')).not.toContain('unrelated.txt')
  expect(f.commands.find((command) => command[1] === 'push')).toEqual([
    'git',
    'push',
    '--no-verify',
    'origin',
    f.git('branch', '--show-current').trim(),
  ])
  expect(f.commands.find((command) => command[1] === 'commit')).not.toContain('--no-verify')
  expect(f.output).toEqual([
    f.git('rev-parse', 'HEAD').trim(),
    f.git('status', '--short').trimEnd(),
  ])
})

test('hook failure keeps edits and retry does not duplicate declarations', async () => {
  const f = fixture()
  f.failCommit(true)
  expect(await closeItem(f.args, f.root, f.dependencies)).toBe(1)
  const first = readFileSync(join(f.root, 'PLAN.md'), 'utf8')
  expect(f.output).toEqual(['hook stdout\nhook stderr\n'])
  f.failCommit(false)
  expect(await closeItem([...f.args, '--no-push'], f.root, f.dependencies)).toBe(0)
  expect(readFileSync(join(f.root, 'PLAN.md'), 'utf8')).toBe(first)
  expect(first.match(/Ejecutado por:/g)).toHaveLength(1)
  expect(first.match(/Gate en vivo:/g)).toHaveLength(1)
  expect(f.git('show', '--format=', '--name-status')).toContain('D\tdocs/specs/F.1.md')
  expect(f.commands.some((command) => command[1] === 'push')).toBe(false)
})

test('dry-run previews diff and commit without touching working tree, index, spec or DB', async () => {
  const f = fixture()
  const before = readFileSync(join(f.root, 'PLAN.md'), 'utf8')
  const status = f.git('status', '--porcelain')
  const index = f.git('ls-files', '--stage')
  expect(await closeItem([...f.args, '--dry-run'], f.root, f.dependencies)).toBe(0)
  expect(f.output[0]).toContain('+- [x] **F.1')
  expect(f.output[1]).toContain("'git' 'commit'")
  expect(readFileSync(join(f.root, 'PLAN.md'), 'utf8')).toBe(before)
  expect(existsSync(join(f.root, 'docs/specs/F.1.md'))).toBe(true)
  expect(f.git('status', '--porcelain')).toBe(status)
  expect(f.git('ls-files', '--stage')).toBe(index)
  expect(f.reconciles()).toBe(0)
  expect(
    f.commands.every((command) => !['commit', 'rm', 'add', 'push'].includes(command[1] ?? '')),
  ).toBe(true)
})

test('rejects an already committed closure', async () => {
  const f = fixture()
  expect(await closeItem(f.args, f.root, f.dependencies)).toBe(0)
  expect(await closeItem(f.args, f.root, f.dependencies)).toBe(1)
  expect(f.output.at(-1)).toContain('ya tiene commit de cierre')
})

test('wraps free text at 120 columns and keeps executor and citations intact', async () => {
  const f = fixture()
  f.failCommit(true)
  const args = [...f.args]
  args[args.indexOf('--live') + 1] = `Playwright ${'flujo verificado '.repeat(20)}`
  args[args.indexOf('--executor') + 1] = `fixture ${'modelo '.repeat(20)}`
  expect(await closeItem(args, f.root, f.dependencies)).toBe(1)
  const plan = readFileSync(join(f.root, 'PLAN.md'), 'utf8')
  for (const line of plan.split('\n').filter((line) => !line.includes('Ejecutado por:')))
    expect(line.length).toBeLessThanOrEqual(120)
  expect(plan).toContain(
    `  Ejecutado por: ${args[args.indexOf('--executor') + 1]} · Spec: docs/specs/F.1.md\n`,
  )
  expect(plan).toContain('`evidence.json`')
  expect(await closeItem(args, f.root, f.dependencies)).toBe(1)
  expect(readFileSync(join(f.root, 'PLAN.md'), 'utf8')).toBe(plan)
})

test('accepts deleted paths, untracked own spec and no-delegation', async () => {
  const f = fixture(false)
  unlinkSync(join(f.root, 'file.ts'))
  expect(
    await closeItem(
      [
        '--item',
        'F.1',
        '--message',
        'close',
        '--path',
        'file.ts',
        '--no-delegation',
        'fix chico',
        '--spec',
        'docs/specs/F.1.md',
        '--no-push',
      ],
      f.root,
      f.dependencies,
    ),
  ).toBe(0)
  expect(readFileSync(join(f.root, 'PLAN.md'), 'utf8')).toContain('  Sin delegación: fix chico')
  expect(existsSync(join(f.root, 'docs/specs/F.1.md'))).toBe(false)
  expect(f.commands.find((command) => command[1] === 'commit')).not.toContain('docs/specs/F.1.md')
})

test('aggregates invalid paths, spec, evidence, live pairing and denied writer lock', async () => {
  const f = fixture()
  f.write('lock.js', '')
  f.dependencies.writerLockPath = join(f.root, 'lock.js')
  const runner: CommandRunner = (command, root) =>
    command[0] === 'node'
      ? { exitCode: 1, stdout: '', stderr: 'lock denied' }
      : f.dependencies.runner(command, root)
  expect(
    await closeItem(
      [
        '--item',
        'F.1',
        '--message',
        'close',
        '--path',
        'missing.ts',
        '--executor',
        'fixture',
        '--spec',
        '../bad.md',
        '--evidence',
        'missing.txt',
      ],
      f.root,
      { ...f.dependencies, runner },
    ),
  ).toBe(1)
  expect(f.output[0]?.split('\n')).toHaveLength(5)
  expect(f.reconciles()).toBe(0)
})
