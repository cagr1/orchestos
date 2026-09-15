import { describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

async function runIsolated(body: string): Promise<Record<string, unknown>> {
  const home = mkdtempSync(join(tmpdir(), 'orchestos-project-choose-'))
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

describe('UI.9.4 — native dashboard project picker', () => {
  it('registers a selected folder without writing inside it and never duplicates it', async () => {
    const result = await runIsolated(`
      const { mkdirSync, readdirSync, writeFileSync } = await import('node:fs')
      const { join } = await import('node:path')
      const { runMigrations } = await import('./src/db/migrate.ts')
      const { handleApiProjectChoose, handleApiProjects } = await import('./src/dashboard/handlers/projects.ts')
      runMigrations()
      const root = join(process.env.ORCHESTOS_HOME, 'chosen-project')
      mkdirSync(root, { recursive: true })
      writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'chosen-project' }))
      const before = readdirSync(root).sort()
      const choose = async () => root
      const first = await handleApiProjectChoose(choose, () => 'darwin')
      const second = await handleApiProjectChoose(choose, () => 'darwin')
      const rows = handleApiProjects()
      process.stdout.write(JSON.stringify({
        first: { status: first.status, body: await first.json() },
        second: { status: second.status, body: await second.json() },
        rows: { status: rows.status, body: await rows.json() },
        filesUnchanged: JSON.stringify(before) === JSON.stringify(readdirSync(root).sort()),
      }))
    `)

    expect(result.first).toMatchObject({
      status: 200,
      body: { path: expect.stringContaining('chosen-project'), stackProfile: expect.any(String) },
    })
    const first = result.first as { body: { id: string } }
    expect(result.second).toMatchObject({ status: 200, body: { id: first.body.id } })
    expect(result.rows).toMatchObject({ status: 200, body: [first.body] })
    expect(result.filesUnchanged).toBe(true)
  })

  it('leaves the database unchanged when selection is cancelled, fails, or is unavailable', async () => {
    const result = await runIsolated(`
      const { runMigrations } = await import('./src/db/migrate.ts')
      const { handleApiProjectChoose, handleApiProjects } = await import('./src/dashboard/handlers/projects.ts')
      runMigrations()
      const cancelled = await handleApiProjectChoose(async () => null, () => 'darwin')
      const failed = await handleApiProjectChoose(async () => { throw new Error('selector failed') }, () => 'darwin')
      let selectorCalled = false
      const unsupported = await handleApiProjectChoose(async () => { selectorCalled = true; return '/ignored' }, () => 'linux')
      const rows = handleApiProjects()
      process.stdout.write(JSON.stringify({
        cancelled: { status: cancelled.status, body: await cancelled.json() },
        failed: { status: failed.status, body: await failed.json() },
        unsupported: { status: unsupported.status, body: await unsupported.json() },
        selectorCalled,
        rows: await rows.json(),
      }))
    `)

    expect(result.cancelled).toEqual({ status: 200, body: { cancelled: true } })
    expect(result.failed).toMatchObject({
      status: 500,
      body: { error: expect.stringContaining('selector failed') },
    })
    expect(result.unsupported).toMatchObject({ status: 501 })
    expect(result.selectorCalled).toBe(false)
    expect(result.rows).toEqual([])
  })

  it('exposes the picker only through POST and never accepts a request path', async () => {
    const result = await runIsolated(`
      const { runMigrations } = await import('./src/db/migrate.ts')
      const { route } = await import('./src/dashboard/server.ts')
      const { handleApiProjects } = await import('./src/dashboard/handlers/projects.ts')
      runMigrations()
      const get = await route(new Request('http://localhost:4242/api/projects/choose?path=/tmp/untrusted'), 4242)
      const put = await route(new Request('http://localhost:4242/api/projects/choose', { method: 'PUT' }), 4242)
      const rows = handleApiProjects()
      process.stdout.write(JSON.stringify({
        get: get.status,
        put: put.status,
        rows: await rows.json(),
      }))
    `)

    expect(result.get).toBe(404)
    expect(result.put).toBe(405)
    expect(result.rows).toEqual([])
  })
})
