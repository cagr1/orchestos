import { afterEach, describe, expect, test } from 'bun:test'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

const repoRoot = process.cwd()
const hookSource = join(repoRoot, '.claude', 'hooks', 'context-budget.js')
const fixtures = join(repoRoot, 'scripts', 'fixtures', 'context-adapters')
const workspaces: string[] = []

function createHookWorkspace(): string {
  const root = mkdtempSync(join(tmpdir(), 'orchestos-context-hook-'))
  workspaces.push(root)
  const hook = join(root, '.claude', 'hooks', 'context-budget.js')
  mkdirSync(dirname(hook), { recursive: true })
  copyFileSync(hookSource, hook)
  symlinkSync(join(repoRoot, 'package.json'), join(root, 'package.json'))
  symlinkSync(join(repoRoot, 'scripts'), join(root, 'scripts'))
  return root
}

function runHook(root: string, sessionId: string, transcriptPath: string) {
  const input = join(root, 'hook-input.json')
  writeFileSync(input, JSON.stringify({ session_id: sessionId, transcript_path: transcriptPath }))
  const result = Bun.spawnSync(['node', '.claude/hooks/context-budget.js'], {
    cwd: root,
    stdin: Bun.file(input),
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

describe('context-budget hook', () => {
  test('nivel ok no imprime nada y sale con éxito', () => {
    const root = createHookWorkspace()
    const result = runHook(root, 'ok-session', join(fixtures, 'codex-59-9.jsonl'))

    expect(result).toMatchObject({ exitCode: 0, stdout: '', stderr: '' })
    expect(existsSync(join(root, '.orchestos', 'handoff.md'))).toBe(false)
  })

  test('warn por primera vez avisa en tres líneas y genera el handoff aislado', () => {
    const root = createHookWorkspace()
    const result = runHook(root, 'warn-session', join(fixtures, 'codex-60.jsonl'))

    expect(result.exitCode, result.stderr).toBe(0)
    expect(result.stdout.trim().split('\n')).toHaveLength(3)
    const handoff = join(root, '.orchestos', 'handoff.md')
    expect(existsSync(handoff)).toBe(true)
    expect(readFileSync(handoff, 'utf8')).toContain('# Handoff de sesión')
  })

  test('warn repetido para la misma sesión no avisa ni regenera el handoff', () => {
    const root = createHookWorkspace()
    const transcript = join(fixtures, 'codex-60.jsonl')
    runHook(root, 'warn-session', transcript)
    const handoff = join(root, '.orchestos', 'handoff.md')
    const first = readFileSync(handoff, 'utf8')

    const repeated = runHook(root, 'warn-session', transcript)

    expect(repeated).toMatchObject({ exitCode: 0, stdout: '', stderr: '' })
    expect(readFileSync(handoff, 'utf8')).toBe(first)
  })

  test('critical repite el aviso para una misma sesión', () => {
    const root = createHookWorkspace()
    const transcript = join(fixtures, 'codex-65.jsonl')
    const first = runHook(root, 'critical-session', transcript)
    const repeated = runHook(root, 'critical-session', transcript)

    expect(first.stdout.trim().split('\n')).toHaveLength(3)
    expect(repeated.stdout.trim().split('\n')).toHaveLength(3)
  })

  test('un transcript inexistente falla abierto y en silencio', () => {
    const root = createHookWorkspace()
    const result = runHook(root, 'missing-session', join(root, 'missing.jsonl'))

    expect(result).toMatchObject({ exitCode: 0, stdout: '', stderr: '' })
  })

  test('stdin inválido falla abierto y en silencio', () => {
    const root = createHookWorkspace()
    const input = join(root, 'invalid-hook-input.txt')
    writeFileSync(input, 'not json')
    const result = Bun.spawnSync(['node', '.claude/hooks/context-budget.js'], {
      cwd: root,
      stdin: Bun.file(input),
      stdout: 'pipe',
      stderr: 'pipe',
    })

    expect({ exitCode: result.exitCode, stdout: result.stdout.toString(), stderr: result.stderr.toString() }).toEqual({
      exitCode: 0,
      stdout: '',
      stderr: '',
    })
  })
})
