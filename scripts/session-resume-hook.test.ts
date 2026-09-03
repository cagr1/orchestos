import { afterEach, describe, expect, test } from 'bun:test'
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

const repoRoot = process.cwd()
const hookSource = join(repoRoot, '.claude', 'hooks', 'session-resume.js')
const workspaces: string[] = []

function createHookWorkspace(): string {
  const root = mkdtempSync(join(tmpdir(), 'orchestos-session-resume-hook-'))
  workspaces.push(root)
  const hook = join(root, '.claude', 'hooks', 'session-resume.js')
  mkdirSync(dirname(hook), { recursive: true })
  copyFileSync(hookSource, hook)
  return root
}

function writeHandoff(root: string, body: string): string {
  const handoff = join(root, '.orchestos', 'handoff.md')
  mkdirSync(dirname(handoff), { recursive: true })
  writeFileSync(handoff, body)
  return handoff
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
  test('inyecta un handoff fresco como JSON válido', () => {
    const root = createHookWorkspace()
    const handoff = 'Retomar H.7.4.\nEl test debe aislar el hook.'
    writeHandoff(root, handoff)

    const result = runHook(root)

    expect(result).toMatchObject({ exitCode: 0, stderr: '' })
    expect(result.stdout.trim().split('\n')).toHaveLength(1)
    const output = JSON.parse(result.stdout)
    expect(output.hookSpecificOutput.hookEventName).toBe('SessionStart')
    expect(output.hookSpecificOutput.additionalContext).toContain(handoff)
  })

  test('un handoff de hace 30 horas avisa en texto plano sin inyectarlo', () => {
    const root = createHookWorkspace()
    const handoff = writeHandoff(root, 'Este estado ya es rancio.')
    const thirtyHoursAgo = new Date(Date.now() - 30 * 60 * 60 * 1000)
    utimesSync(handoff, thirtyHoursAgo, thirtyHoursAgo)

    const result = runHook(root)

    expect(result).toMatchObject({ exitCode: 0, stderr: '' })
    expect(result.stdout.trim().split('\n')).toHaveLength(1)
    expect(result.stdout).toContain('.orchestos/handoff.md')
    expect(() => JSON.parse(result.stdout)).toThrow()
  })

  test('sin handoff falla abierto y no imprime nada', () => {
    const root = createHookWorkspace()

    expect(runHook(root)).toEqual({ exitCode: 0, stdout: '', stderr: '' })
  })

  test.each(['', '   \n\t  '])('un handoff vacío falla abierto y no imprime nada', (body) => {
    const root = createHookWorkspace()
    writeHandoff(root, body)

    expect(runHook(root)).toEqual({ exitCode: 0, stdout: '', stderr: '' })
  })

  test('trunca un handoff de 20.000 caracteres antes de inyectarlo', () => {
    const root = createHookWorkspace()
    writeHandoff(root, 'x'.repeat(20_000))

    const result = runHook(root)
    const output = JSON.parse(result.stdout)
    const context = output.hookSpecificOutput.additionalContext

    expect(context.length).toBeLessThan(8_300)
    expect(context.endsWith('[…truncado: el handoff supera 8000 caracteres]')).toBe(true)
  })

  test('serializa saltos de línea del handoff como JSON estricto', () => {
    const root = createHookWorkspace()
    writeHandoff(root, 'Primera línea\nSegunda línea')

    const result = runHook(root)

    expect(result.stdout).toContain('Primera línea\\nSegunda línea')
    expect(result.stdout).not.toContain('Primera línea\nSegunda línea')
    expect(JSON.parse(result.stdout).hookSpecificOutput.additionalContext).toContain(
      'Primera línea\nSegunda línea',
    )
  })
})
