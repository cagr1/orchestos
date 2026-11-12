/**
 * CC.D1b — `context update` nunca debe destruir AGENTS.md sin autorización.
 *
 * Se prueba el CLI real en un proceso separado para cubrir Commander, el
 * código de salida y el flujo de escritura; ORCHESTOS_HOME temporal evita
 * contaminar la DB del usuario durante el caso explícito de --force.
 */
import { describe, expect, it } from 'bun:test'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { validateTaskId } from '../dashboard/http.ts'

const repoRoot = process.cwd()
const cliPath = join(repoRoot, 'src', 'cli.ts')

it('AUD.20-fix rejects task ids containing consecutive dots', () => {
  expect(validateTaskId('foo..bar')).toBeNull()
  expect(validateTaskId('foo.2')).toBe('foo.2')
})

async function runContextUpdate(
  projectRoot: string,
  force = false,
  command = ['context', 'update'],
) {
  const home = mkdtempSync(join(tmpdir(), 'orchestos-ccd1b-home-'))
  const args = ['bun', 'run', cliPath, ...command, projectRoot]
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

for (const command of ['detect', 'init']) {
  it(`AUD.20 ${command} preserves existing files and does not register the project without force`, async () => {
    const project = mkdtempSync(join(tmpdir(), 'aud20-cli-'))
    try {
      writeFileSync(join(project, 'AGENTS.md'), 'manual rules')
      writeFileSync(join(project, 'context.json'), 'manual context')
      const result = await runContextUpdate(project, false, [command])
      expect(result.exitCode).toBe(1)
      expect(result.stderr).toContain('Refusing to overwrite')
      expect(readFileSync(join(project, 'AGENTS.md'), 'utf8')).toBe('manual rules')
      expect(readFileSync(join(project, 'context.json'), 'utf8')).toBe('manual context')
    } finally {
      rmSync(project, { recursive: true, force: true })
    }
  })
  it(`AUD.20 ${command} allows explicit force`, async () => {
    const project = mkdtempSync(join(tmpdir(), 'aud20-force-'))
    try {
      writeFileSync(join(project, 'AGENTS.md'), 'manual rules')
      const result = await runContextUpdate(project, true, [command])
      expect(result.exitCode).toBe(0)
      expect(readFileSync(join(project, 'AGENTS.md'), 'utf8')).toContain('## Notes for AI agents')
      expect(existsSync(join(project, 'context.json'))).toBe(true)
    } finally {
      rmSync(project, { recursive: true, force: true })
    }
  })
}

it('AUD.20 dashboard detect preserves files unless force is explicit', async () => {
  const { handleApiProjectDetect } = await import('../dashboard/handlers/project.ts')
  const project = mkdtempSync(join(tmpdir(), 'aud20-detect-handler-'))
  try {
    writeFileSync(join(project, 'AGENTS.md'), 'manual rules')
    writeFileSync(join(project, 'context.json'), 'manual context')
    const result = await handleApiProjectDetect(project)
    expect(result.status).toBe(409)
    expect(await result.json()).toEqual({
      ok: false,
      error: 'AGENTS.md exists',
      path: join(project, 'AGENTS.md'),
    })
    expect(readFileSync(join(project, 'AGENTS.md'), 'utf8')).toBe('manual rules')
    expect(readFileSync(join(project, 'context.json'), 'utf8')).toBe('manual context')
    const emptyBody = await handleApiProjectDetect(
      project,
      new Request('http://localhost/api/project/detect', { method: 'POST', body: '' }),
    )
    expect(emptyBody.status).toBe(409)
    for (const body of ['{', JSON.stringify({ force: 'true' })]) {
      const response = await handleApiProjectDetect(
        project,
        new Request('http://localhost/api/project/detect', { method: 'POST', body }),
      )
      expect(response.status).toBe(409)
    }
    const forced = await handleApiProjectDetect(
      project,
      new Request('http://localhost/api/project/detect', {
        method: 'POST',
        body: JSON.stringify({ force: true }),
      }),
    )
    expect(forced.status).toBe(200)
    expect(readFileSync(join(project, 'AGENTS.md'), 'utf8')).toContain('## Notes for AI agents')
  } finally {
    rmSync(project, { recursive: true, force: true })
  }
})
