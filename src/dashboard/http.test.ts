import { afterEach, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { serveStatic } from './http.ts'

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('serveStatic', () => {
  test('does not cache the app shell or its bundle', async () => {
    const appDir = mkdtempSync(join(tmpdir(), 'orchestos-static-'))
    roots.push(appDir)
    mkdirSync(join(appDir, 'dist'))
    writeFileSync(join(appDir, 'index.html'), '<html></html>')
    writeFileSync(join(appDir, 'dist', 'main.js'), 'console.log("ok")')
    const shell = serveStatic('/', appDir)
    const bundle = serveStatic('/app/dist/main.js', appDir)
    expect(shell.status).toBe(200)
    expect(shell.headers.get('cache-control')).toBe('no-cache')
    expect(bundle.status).toBe(200)
    expect(bundle.headers.get('cache-control')).toBe('no-cache')
  })
})
