import { expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('project Preview URLs and shots persist locally and reject invalid input', async () => {
  const home = mkdtempSync(join(tmpdir(), 'preview-handler-'))
  try {
    const proc = Bun.spawn(
      [
        process.execPath,
        '-e',
        `
      import { expect } from 'bun:test'
      import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
      import { join } from 'node:path'
      import { runMigrations } from './src/db/migrate.ts'
      import { db } from './src/db/sqlite.ts'
      import { upsertProject, getProject, deleteProject } from './src/db/projects.ts'
      import { previewDir } from './src/preview/paths.ts'
      import { handleApiPreviewUrl, handleApiPreviewShot } from './src/dashboard/handlers/previews.ts'
      runMigrations()
      const root = join(process.env.ORCHESTOS_HOME, 'project')
      upsertProject(root, {}, '')
      const project = getProject(root)
      const get = (id = project.id) => handleApiPreviewUrl(new Request('http://localhost/', { method: 'GET' }), id)
      const put = (url, id = project.id) => handleApiPreviewUrl(new Request('http://localhost/', { method: 'PUT', body: JSON.stringify({ url }) }), id)
      expect(await (await get()).json()).toEqual({ url: null })
      expect((await put('localhost:3000')).status).toBe(200)
      expect(readFileSync(join(previewDir(project.id), 'url'), 'utf8')).toBe('http://localhost:3000/\\n')
      expect(await (await get()).json()).toEqual({ url: 'http://localhost:3000/' })
      for (const url of ['https://example.com', 'http://localhost.evil.com', 'file:///etc/passwd', 42, {}]) expect((await put(url)).status).toBe(400)
      expect(await (await get()).json()).toEqual({ url: 'http://localhost:3000/' })
      expect((await put(null)).status).toBe(200)
      expect(existsSync(join(previewDir(project.id), 'url'))).toBe(false)
      expect(await (await get()).json()).toEqual({ url: null })
      expect((await get('missing')).status).toBe(404)
      expect((await put('localhost:3000', 'missing')).status).toBe(404)
      for (const name of ['../secret.png', 'a/b.png', 'a..png', 'x.svg', 'missing.png']) expect((await handleApiPreviewShot(project.id, name)).status).toBe(404)
      mkdirSync(join(previewDir(project.id), 'shots'), { recursive: true })
      writeFileSync(join(previewDir(project.id), 'shots', 'shot.png'), Buffer.from('png fixture'))
      const shot = await handleApiPreviewShot(project.id, 'shot.png')
      expect(shot.status).toBe(200)
      expect(shot.headers.get('content-type')).toBe('image/png')
      expect(await shot.text()).toBe('png fixture')
      expect((await handleApiPreviewShot('missing', 'shot.png')).status).toBe(404)
      deleteProject(project.id)
      expect((await get()).status).toBe(404)
      expect((await put(null)).status).toBe(404)
      expect((await handleApiPreviewShot(project.id, 'shot.png')).status).toBe(404)
      db.close()
    `,
      ],
      { env: { ...process.env, ORCHESTOS_HOME: home }, stdout: 'pipe', stderr: 'pipe' },
    )
    const [code, stdout, stderr] = await Promise.all([
      proc.exited,
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ])
    expect(code, `${stdout}\n${stderr}`).toBe(0)
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})
