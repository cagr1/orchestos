import { afterEach, describe, expect, test } from 'bun:test'
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

const repoRoot = process.cwd()
const hookSource = join(repoRoot, '.claude', 'hooks', 'session-resume.js')
const workspaces: string[] = []

function createHookWorkspace(nextScript: string): string {
  const root = mkdtempSync(join(tmpdir(), 'orchestos-session-resume-hook-'))
  workspaces.push(root)
  const hook = join(root, '.claude', 'hooks', 'session-resume.js')
  mkdirSync(dirname(hook), { recursive: true })
  mkdirSync(join(root, 'scripts'), { recursive: true })
  copyFileSync(hookSource, hook)
  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify({ type: 'module', scripts: { next: 'node scripts/next.js' } }),
  )
  writeFileSync(join(root, 'scripts', 'next.js'), nextScript)
  return root
}

function runHook(root: string) {
  const result = Bun.spawnSync(['node', '.claude/hooks/session-resume.js'], {
    cwd: root,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  return {
    exitCode: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  }
}

afterEach(() => {
  for (const workspace of workspaces.splice(0)) rmSync(workspace, { recursive: true, force: true })
})

describe('session-resume hook', () => {
  test('inyecta la salida compacta de bun run next como JSON válido', () => {
    const root = createHookWorkspace(
      "process.stdout.write('Ítems listos para tomar: 1\\nS.5 ⚡ — Arranque barato\\n')",
    )

    const result = runHook(root)

    expect(result).toMatchObject({ exitCode: 0, stderr: '' })
    const output = JSON.parse(result.stdout)
    expect(output.hookSpecificOutput.hookEventName).toBe('SessionStart')
    expect(output.hookSpecificOutput.additionalContext).toContain('S.5 ⚡ — Arranque barato')
    expect(output.hookSpecificOutput.additionalContext).not.toContain('handoff.md')
  })

  test('si bun run next falla, el hook falla abierto y no imprime nada', () => {
    const root = createHookWorkspace('process.exit(1)')

    expect(runHook(root)).toEqual({ exitCode: 0, stdout: '', stderr: '' })
  })

  test('si bun run next no produce contexto, el hook no inyecta nada', () => {
    const root = createHookWorkspace('')

    expect(runHook(root)).toEqual({ exitCode: 0, stdout: '', stderr: '' })
  })

  test('serializa saltos de línea de la consulta como JSON estricto', () => {
    const root = createHookWorkspace("process.stdout.write('Primera línea\\nSegunda línea')")
    const result = runHook(root)

    expect(result.stdout).toContain('Primera línea\\nSegunda línea')
    expect(result.stdout).not.toContain('Primera línea\nSegunda línea')
    expect(JSON.parse(result.stdout).hookSpecificOutput.additionalContext).toContain(
      'Primera línea\nSegunda línea',
    )
  })
})
