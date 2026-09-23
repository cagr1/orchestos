import { describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

async function runIsolated(body: string): Promise<Record<string, unknown>> {
  const home = mkdtempSync(join(tmpdir(), 'orchestos-project-index-'))
  try {
    const proc = Bun.spawn(['bun', '-e', body], {
      cwd: process.cwd(),
      env: { ...process.env, ORCHESTOS_HOME: home },
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const [exitCode, stdout, stderr] = await Promise.all([
      proc.exited,
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ])
    expect(exitCode, stderr).toBe(0)
    return JSON.parse(stdout) as Record<string, unknown>
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
}

describe('project indexing through symlink paths', () => {
  it('keeps one project when registration and indexing use different path forms', async () => {
    const result = await runIsolated(`
      const { mkdirSync, symlinkSync, writeFileSync, realpathSync } = await import('node:fs')
      const { join } = await import('node:path')
      const { runMigrations } = await import('./src/db/migrate.ts')
      const { db } = await import('./src/db/sqlite.ts')
      const { ensureProject } = await import('./src/projects/ensure.ts')
      const { route } = await import('./src/dashboard/server.ts')
      runMigrations()

      const root = join(process.env.ORCHESTOS_HOME, 'real-project')
      const link = join(process.env.ORCHESTOS_HOME, 'project-link')
      mkdirSync(root, { recursive: true })
      writeFileSync(join(root, 'src.ts'), 'export const value = 1\\n')
      symlinkSync(root, link)
      const registered = await ensureProject(link)
      const response = await route(new Request('http://localhost:4242/api/project/index', {
        method: 'POST',
        headers: { 'x-orchestos-project-id': registered.id },
      }), 4242)
      const projects = await route(new Request('http://localhost:4242/api/projects'), 4242)
      const rows = await projects.json()
      process.stdout.write(JSON.stringify({
        indexStatus: response.status,
        projectId: registered.id,
        realPath: realpathSync(root),
        rows,
      }))
      db.close()
    `)

    expect(result.indexStatus).toBe(200)
    const rows = result.rows as Array<{ id: string; path: string }>
    expect(rows).toHaveLength(1)
    const row = rows[0]!
    expect(row).toMatchObject({ id: result.projectId })
    expect(row.path).toContain('project-link')
  })
})
