import { describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

async function isolated(body: string): Promise<any> {
  const home = mkdtempSync(join(tmpdir(), 'orchestos-project-clone-'))
  try {
    const proc = Bun.spawn(
      [
        'bun',
        '-e',
        `
      const { mkdirSync, writeFileSync, existsSync, readFileSync, symlinkSync, rmSync } = await import('node:fs')
      const { join } = await import('node:path')
      const { runMigrations } = await import('./src/db/migrate.ts')
      const { handleApiProjectClone, handleApiProjectCloneLocation } = await import('./src/dashboard/handlers/projects.ts')
      const { listProjects } = await import('./src/db/projects.ts')
      runMigrations()
      const parent = process.env.ORCHESTOS_HOME
      const request = (url, parentDir = parent) => new Request('http://localhost/api/projects/clone', { method: 'POST', body: JSON.stringify({url, parentDir}) })
      const respond = async (response) => ({ status: response.status, body: await response.json() })
      const branch = () => undefined
      ${body}
    `,
      ],
      {
        cwd: process.cwd(),
        env: { ...process.env, ORCHESTOS_HOME: home, ORCHESTOS_TEST_PROJECT_CLONE_FILE: '' },
        stdout: 'pipe',
        stderr: 'pipe',
      },
    )
    const [exit, stdout, stderr] = await Promise.all([
      proc.exited,
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ])
    expect(exit, stderr).toBe(0)
    return JSON.parse(stdout)
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
}

describe('UI.64 clone project', () => {
  it('accepts HTTPS, SSH and scp URLs and registers the real destination using the injected probe', async () => {
    const result = await isolated(`
      const urls = ['https://example.invalid/org/https-repo.git', 'ssh://git@example.invalid/org/ssh-repo.git', 'git@example.invalid:org/scp-repo.git']
      const calls = []
      const results = []
      for (const url of urls) results.push(await respond(await handleApiProjectClone(request(url), async (source, destination) => { calls.push({source, destination}); writeFileSync(join(destination, 'README.md'), 'fixture') }, branch)))
      console.log(JSON.stringify({ results, calls, rows: listProjects() }))
    `)
    expect(result.results.map((item: any) => item.status)).toEqual([200, 200, 200])
    expect(result.calls).toHaveLength(3)
    expect(result.rows).toHaveLength(3)
    for (const [index, name] of ['https-repo', 'ssh-repo', 'scp-repo'].entries()) {
      expect(result.results[index].body.path).toBe(result.calls[index].destination)
      expect(result.results[index].body.path.endsWith(`/${name}`)).toBe(true)
      expect(result.results[index].body.id).toBeString()
    }
  })

  it('rejects invalid URLs, leading options, empty or traversal names, malformed bodies and invalid parents before invoking the probe', async () => {
    const result = await isolated(`
      let calls = 0
      const probe = async () => { calls++ }
      const urls = ['-https://example.invalid/repo', '--upload-pack=evil', 'file:///tmp/repo', '/tmp/repo', 'http://example.invalid/repo', 'https://example.invalid/', 'https://example.invalid/.git', 'https://example.invalid/%2e%2e.git', 'https://example.invalid/a%2fb.git', 'git@example.invalid:', 'git@example.invalid:repo', 'https://example.invalid/repo?option=x', 'https://example.invalid/repo#x', 'https://example.invalid/repo name', 7, null]
      const results = []
      for (const url of urls) results.push(await respond(await handleApiProjectClone(request(url), probe, branch)))
      writeFileSync(join(parent, 'file'), 'existing')
      for (const dir of [join(parent, 'missing'), join(parent, 'file'), '', 7]) results.push(await respond(await handleApiProjectClone(request('https://example.invalid/repo', dir), probe, branch)))
      for (const body of ['{', 'null', '[]']) results.push(await respond(await handleApiProjectClone(new Request('http://localhost/api/projects/clone', {method:'POST', body}), probe, branch)))
      console.log(JSON.stringify({results, calls}))
    `)
    expect(result.calls).toBe(0)
    expect(result.results.every((item: any) => item.status === 400)).toBe(true)
  })

  it('preserves existing directories and symlinks with 409, including concurrent clone attempts', async () => {
    const result = await isolated(`
      mkdirSync(join(parent, 'repo'))
      writeFileSync(join(parent, 'repo', 'keep'), 'keep')
      symlinkSync(join(parent, 'missing'), join(parent, 'link'))
      let calls = 0
      const probe = async () => { calls++ }
      const existing = await respond(await handleApiProjectClone(request('https://example.invalid/repo'), probe, branch))
      const link = await respond(await handleApiProjectClone(request('https://example.invalid/link'), probe, branch))
      let competing
      const first = await respond(await handleApiProjectClone(request('https://example.invalid/concurrent'), async () => { competing = await respond(await handleApiProjectClone(request('https://example.invalid/concurrent'), probe, branch)) }, branch))
      console.log(JSON.stringify({existing, link, first, competing, calls, keep: readFileSync(join(parent, 'repo', 'keep'), 'utf8')}))
    `)
    expect(result.existing).toEqual({
      status: 409,
      body: { error: 'Destination folder already exists' },
    })
    expect(result.link.status).toBe(409)
    expect(result.competing.status).toBe(409)
    expect(result.first.status).toBe(200)
    expect(result.calls).toBe(0)
    expect(result.keep).toBe('keep')
  })

  it('removes its partial destination on failure, limits errors, and does not register failed clones', async () => {
    const result = await isolated(`
      const response = await respond(await handleApiProjectClone(request('https://example.invalid/broken.git'), async (_url, dest) => { writeFileSync(join(dest, 'partial'), 'partial'); throw new Error('界'.repeat(4000)) }, branch))
      const timedOut = await respond(await handleApiProjectClone(request('https://example.invalid/timeout.git'), async () => { throw new Error('Git clone timed out') }, branch))
      console.log(JSON.stringify({response, timedOut, partial:existsSync(join(parent, 'broken')), timeout:existsSync(join(parent, 'timeout')), rows:listProjects()}))
    `)
    expect(result.response.status).toBe(500)
    expect(Buffer.byteLength(result.response.body.error)).toBeLessThanOrEqual(2048)
    expect(result.timedOut).toEqual({ status: 500, body: { error: 'Git clone timed out' } })
    expect(result.partial).toBe(false)
    expect(result.timeout).toBe(false)
    expect(result.rows).toEqual([])
  })

  it('chooses clone parents without registering them, handles cancellation, and rejects non-macOS pickers', async () => {
    const result = await isolated(`
      const selected = await respond(await handleApiProjectCloneLocation(true, async () => parent, () => 'darwin'))
      const cancelled = await respond(await handleApiProjectCloneLocation(true, async () => null, () => 'darwin'))
      const unavailable = await respond(await handleApiProjectCloneLocation(true, async () => { throw new Error('must not run') }, () => 'linux'))
      const home = await respond(await handleApiProjectCloneLocation(false))
      console.log(JSON.stringify({selected, cancelled, unavailable, home, rows:listProjects()}))
    `)
    expect(result.selected.status).toBe(200)
    expect(result.selected.body.parentDir).toBeString()
    expect(result.cancelled.body).toEqual({ cancelled: true })
    expect(result.unavailable.status).toBe(501)
    expect(result.home.body.parentDir).toBeString()
    expect(result.rows).toEqual([])
  })
})
