/**
 * CC.D1b — `context update` nunca debe destruir AGENTS.md sin autorización.
 *
 * Se prueba el CLI real en un proceso separado para cubrir Commander, el
 * código de salida y el flujo de escritura; ORCHESTOS_HOME temporal evita
 * contaminar la DB del usuario durante el caso explícito de --force.
 */
import { describe, expect, it } from 'bun:test'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

const repoRoot = process.cwd()
const cliPath = join(repoRoot, 'src', 'cli.ts')

async function runContextUpdate(projectRoot: string, force = false) {
  const home = mkdtempSync(join(tmpdir(), 'orchestos-ccd1b-home-'))
  const args = ['bun', 'run', cliPath, 'context', 'update', projectRoot]
  if (force) args.push('--force')
  const proc = Bun.spawn(args, {
    cwd: repoRoot,
    env: { ...process.env, ORCHESTOS_HOME: home },
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const [exitCode, stdout, stderr] = await Promise.all([
    proc.exited,
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ])
  rmSync(home, { recursive: true, force: true })
  return { exitCode, stdout, stderr }
}

describe('context update — AGENTS.md safety (CC.D1b)', () => {
  it('refuses to overwrite an existing AGENTS.md without --force', async () => {
    const project = mkdtempSync(join(tmpdir(), 'orchestos-ccd1b-project-'))
    try {
      const manual = '# Manual project rules\n\nNever erase this content.\n'
      writeFileSync(join(project, 'AGENTS.md'), manual, 'utf8')

      const result = await runContextUpdate(project)

      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain('Refusing to overwrite')
      expect(readFileSync(join(project, 'AGENTS.md'), 'utf8')).toBe(manual)
      expect(existsSync(join(project, 'context.json'))).toBe(false)
    } finally {
      rmSync(project, { recursive: true, force: true })
    }
  })

  it('--force is the explicit opt-in for replacing AGENTS.md', async () => {
    const project = mkdtempSync(join(tmpdir(), 'orchestos-ccd1b-project-force-'))
    try {
      writeFileSync(join(project, 'AGENTS.md'), '# Manual project rules\n', 'utf8')

      const result = await runContextUpdate(project, true)

      expect(result.exitCode).toBe(0)
      expect(result.stdout).toContain('[context] Updated')
      expect(readFileSync(join(project, 'AGENTS.md'), 'utf8')).toContain('## Notes for AI agents')
      expect(existsSync(join(project, 'context.json'))).toBe(true)
    } finally {
      rmSync(project, { recursive: true, force: true })
    }
  })
})
