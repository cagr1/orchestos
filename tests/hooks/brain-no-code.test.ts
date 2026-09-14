import { describe, expect, it } from 'bun:test'
import { spawnSync } from 'child_process'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join, resolve } from 'path'

const HOOK_PATH = resolve(import.meta.dir, '../../.claude/hooks/brain-no-code.js')

function runHook(
  input: unknown,
  root = mkdtempSync(join(tmpdir(), 'brain-guard-root-')),
  role?: string,
) {
  const result = spawnSync('node', [HOOK_PATH], {
    encoding: 'utf8',
    input: JSON.stringify(input),
    env: { ...process.env, BRAIN_GUARD_ROOT: root, ...(role ? { ORCHESTOS_ROLE: role } : {}) },
  })
  rmSync(root, { recursive: true, force: true })
  return result
}

function tool(tool_name: string, tool_input: Record<string, string>) {
  return { tool_name, tool_input }
}

function expectDenied(input: unknown, root?: string) {
  const result = runHook(input, root)
  expect(result.status).toBe(0)
  expect(result.stdout).toContain('permissionDecision":"deny')
}

describe('brain-no-code hook', () => {
  it('deny Edit a src/', () => {
    const root = mkdtempSync(join(tmpdir(), 'brain-guard-root-'))
    expectDenied(tool('Edit', { file_path: join(root, 'src/a.ts') }), root)
  })

  it('deny Write a tests/', () => {
    const root = mkdtempSync(join(tmpdir(), 'brain-guard-root-'))
    expectDenied(tool('Write', { file_path: join(root, 'tests/x.test.ts') }), root)
  })

  it('deny Edit a .claude/hooks/', () => {
    const root = mkdtempSync(join(tmpdir(), 'brain-guard-root-'))
    expectDenied(tool('Edit', { file_path: join(root, '.claude/hooks/h.js') }), root)
  })

  it('deny Edit a worktree code path', () => {
    const root = mkdtempSync(join(tmpdir(), 'brain-guard-root-'))
    expectDenied(tool('Edit', { file_path: join(root, '.orchestos/worktrees/t1/src/a.ts') }), root)
  })

  it('allow non-code and outside-root paths', () => {
    const root = mkdtempSync(join(tmpdir(), 'brain-guard-root-'))
    for (const input of [
      tool('Edit', { file_path: join(root, 'PLAN.md') }),
      tool('Write', { file_path: join(root, 'docs/specs/AT.9.md') }),
      tool('Edit', { file_path: '/tmp/outside.ts' }),
    ]) {
      expect(runHook(input, root).stdout.trim()).toBe('')
    }
  })

  it('deny Bash redirects, tee, sed and perl', () => {
    for (const command of [
      'cat > src/a.ts <<EOF',
      'echo x >> scripts/b.ts',
      "sed -i '' 's/a/b/' src/a.ts",
      "perl -pi -e 's/a/b/' tests/c.ts",
      'echo x | tee src/a.ts',
    ]) {
      const result = runHook(tool('Bash', { command }))
      expect(result.stdout).toContain('permissionDecision":"deny')
    }
  })

  it('allow Bash commands that only read or redirect elsewhere', () => {
    for (const command of [
      'bun test src/db/plan-items.test.ts 2>&1 | tee /tmp/log',
      'git diff -- src/',
      'grep -rn foo src/',
      'sed -n 1,20p src/a.ts',
      'git checkout HEAD -- src/a.ts',
    ]) {
      expect(runHook(tool('Bash', { command })).stdout.trim()).toBe('')
    }
  })

  it('allow executor edits to code', () => {
    const root = mkdtempSync(join(tmpdir(), 'brain-guard-root-'))
    expect(
      runHook(tool('Edit', { file_path: join(root, 'src/a.ts') }), root, 'executor').stdout.trim(),
    ).toBe('')
  })

  it('allow invalid stdin', () => {
    const result = spawnSync('node', [HOOK_PATH], { encoding: 'utf8', input: '{ invalid' })
    expect(result.status).toBe(0)
    expect(result.stdout.trim()).toBe('')
  })
})
