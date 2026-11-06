import { describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

async function runIsolated(body: string): Promise<Record<string, unknown>> {
  const home = mkdtempSync(join(tmpdir(), 'orchestos-multi-project-'))
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

describe('CC.3 — contexto multi-proyecto explícito', () => {
  it('aísla archivos y tareas por project id y rechaza selecciones inválidas', async () => {
    const result = await runIsolated(`
      const { mkdirSync, writeFileSync } = await import('fs')
      const { join } = await import('path')
      const { stringify } = await import('yaml')
      const { runMigrations } = await import('./src/db/migrate.ts')
      const { db } = await import('./src/db/sqlite.ts')
      const { route } = await import('./src/dashboard/server.ts')
      runMigrations()

      const home = process.env.ORCHESTOS_HOME
      const roots = { alpha: join(home, 'alpha'), beta: join(home, 'beta') }
      const now = new Date().toISOString()
      for (const [id, root] of Object.entries(roots)) {
        mkdirSync(root, { recursive: true })
        writeFileSync(join(root, 'tasks.yaml'), stringify({
          version: 1,
          project: id,
          tasks: [{ id: id + '-task', description: id, executor: 'openrouter', input: [], output: [id + '.txt'], depends_on: [], status: 'pending', retry_count: 0 }],
        }))
        writeFileSync(join(root, 'CONTEXT.md'), 'CONTEXT-' + id.toUpperCase())
        writeFileSync(join(root, 'marker.txt'), 'FILE-' + id.toUpperCase())
        db.run('INSERT INTO projects (id, path, stack_profile, agents_md, last_updated) VALUES (?, ?, ?, ?, ?)', [id, root, '{}', '', now])
      }
      db.run('INSERT INTO projects (id, path, stack_profile, agents_md, last_updated) VALUES (?, ?, ?, ?, ?)', ['gone', join(home, 'does-not-exist'), '{}', '', now])

      const request = (path, project) => new Request('http://localhost:4242' + path, {
        headers: project ? { 'X-Orchestos-Project-Id': project } : undefined,
      })
      const read = async (path, project) => {
        const response = await route(request(path, project), 4242)
        return { status: response.status, body: await response.json() }
      }

      const projects = await read('/api/projects')
      const alphaTasks = await read('/api/tasks', 'alpha')
      const betaTasks = await read('/api/tasks', 'beta')
      const alphaContext = await read('/api/project/context', 'alpha')
      const betaContext = await read('/api/project/context?project=beta')
      const alphaFile = await read('/api/explorer/file?path=marker.txt', 'alpha')
      const betaFile = await read('/api/explorer/file?path=marker.txt&project=beta')
      const missing = await read('/api/tasks', 'missing')
      const gone = await read('/api/tasks', 'gone')

      process.stdout.write(JSON.stringify({ projects, alphaTasks, betaTasks, alphaContext, betaContext, alphaFile, betaFile, missing, gone }))
      db.close()
    `)

    expect(result.projects).toMatchObject({ status: 200 })
    expect((result.projects as any).body.map((p: any) => p.id).sort()).toEqual([
      'alpha',
      'beta',
      'gone',
    ])
    expect(result.alphaTasks).toMatchObject({
      status: 200,
      body: { tasks: [{ id: 'alpha-task' }] },
    })
    expect(result.betaTasks).toMatchObject({ status: 200, body: { tasks: [{ id: 'beta-task' }] } })
    expect(result.alphaContext).toMatchObject({ status: 200, body: { content: 'CONTEXT-ALPHA' } })
    expect(result.betaContext).toMatchObject({ status: 200, body: { content: 'CONTEXT-BETA' } })
    expect(result.alphaFile).toMatchObject({ status: 200, body: { content: 'FILE-ALPHA' } })
    expect(result.betaFile).toMatchObject({ status: 200, body: { content: 'FILE-BETA' } })
    expect(result.missing).toMatchObject({ status: 404 })
    expect(result.gone).toMatchObject({ status: 410 })
  })
})
