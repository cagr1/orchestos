import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import {
  ensureFreshUiBundle,
  readUiBundleState,
  uiBundleWarning,
  withUiBundleWarning,
} from '../ui-bundle.ts'

describe('dashboard UI bundle freshness', () => {
  let root: string
  let builds: string[]
  let messages: unknown[][]
  const bundle = 'src/dashboard/app/dist/main.js'
  const source = 'src/dashboard/app/src/x.tsx'
  const logger = {
    log: (...args: unknown[]) => messages.push(args),
    error: (...args: unknown[]) => messages.push(args),
  }
  function file(path: string, time: number) {
    const absolute = join(root, path)
    mkdirSync(dirname(absolute), { recursive: true })
    writeFileSync(absolute, '// fixture')
    utimesSync(absolute, time, time)
  }
  function build(path: string) {
    builds.push(path)
    file(bundle, 300)
    return { ok: true, stdout: '', stderr: '' }
  }

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'ui-bundle-test-'))
    builds = []
    messages = []
  })
  afterEach(() => {
    // Clear module warning state before discarding the isolated fixture.
    file(bundle, 400)
    ensureFreshUiBundle(root, build, logger)
    rmSync(root, { recursive: true, force: true })
  })

  it('builds a missing bundle once', () => {
    expect(readUiBundleState(root)).toEqual({ state: 'missing' })
    expect(ensureFreshUiBundle(root, build, logger)).toEqual({ rebuilt: true, warning: null })
    expect(builds).toEqual([root])
    expect(messages).toEqual([
      ['[dashboard] UI bundle missing — running bun run build:app...'],
      ['[dashboard] UI bundle rebuilt.'],
    ])
  })

  it('rebuilds when a nested source is newer', () => {
    file(bundle, 100)
    file(source, 200)
    expect(readUiBundleState(root)).toEqual({ state: 'stale', newerSource: source })
    expect(ensureFreshUiBundle(root, build, logger)).toEqual({ rebuilt: true, warning: null })
    expect(builds).toEqual([root])
    expect(readUiBundleState(root)).toEqual({ state: 'fresh' })
    expect(uiBundleWarning()).toBeNull()
  })

  it('does not build when all sources are older or equal', () => {
    file(source, 100)
    file('scripts/build-app.ts', 200)
    file(bundle, 200)
    expect(readUiBundleState(root)).toEqual({ state: 'fresh' })
    expect(ensureFreshUiBundle(root, build, logger)).toEqual({ rebuilt: false, warning: null })
    expect(builds).toEqual([])
    expect(messages).toEqual([])
  })

  it('ignores dist outputs and nested node_modules', () => {
    file(bundle, 100)
    file('src/dashboard/app/dist/main.css', 200)
    file('src/dashboard/app/src/node_modules/dependency/index.js', 200)
    expect(readUiBundleState(root)).toEqual({ state: 'fresh' })
  })

  it('checks the build script even without the app sources', () => {
    file(bundle, 100)
    file('scripts/build-app.ts', 200)
    expect(readUiBundleState(root)).toEqual({
      state: 'stale',
      newerSource: 'scripts/build-app.ts',
    })
  })

  it('keeps a warning and build output when rebuilding fails', async () => {
    file(bundle, 100)
    file(source, 200)
    const failed = () => ({ ok: false, stdout: 'build stdout', stderr: 'build stderr' })
    const result = ensureFreshUiBundle(root, failed, logger)
    expect(result.rebuilt).toBe(false)
    expect(result.warning).toBe(
      `The dashboard UI is out of date (newer source: ${source}) and the rebuild failed. Run "bun run build:app" and restart the dashboard.`,
    )
    expect(uiBundleWarning()).toBe(result.warning)
    expect(messages[1]).toEqual([`[dashboard] ${result.warning}`, 'build stdout\nbuild stderr'])
    const response = new Response('<html><body class="x">app</body></html>', {
      status: 203,
      statusText: 'Non-Authoritative Information',
      headers: { 'content-type': 'text/html; charset=utf-8', 'content-length': '44' },
    })
    const warned = await withUiBundleWarning(response, result.warning)
    expect(await warned.text()).toContain(
      '<body class="x"><div role="alert" data-ui-bundle-warning',
    )
    expect(warned.headers.has('content-length')).toBe(false)
    expect(warned.status).toBe(203)
    expect(warned.statusText).toBe('Non-Authoritative Information')
    expect(ensureFreshUiBundle(root, build, logger)).toEqual({ rebuilt: true, warning: null })
    expect(uiBundleWarning()).toBeNull()
  })

  it('warns when a successful build leaves the bundle stale or absent', () => {
    const noOutput = () => ({ ok: true, stdout: '', stderr: '' })
    expect(ensureFreshUiBundle(root, noOutput, logger).warning).toContain('rebuild failed')
    file(bundle, 100)
    file(source, 200)
    expect(ensureFreshUiBundle(root, noOutput, logger).warning).toContain('rebuild failed')
  })

  it('warns if the builder throws', () => {
    const result = ensureFreshUiBundle(
      root,
      () => {
        throw new Error('spawn failed')
      },
      logger,
    )
    expect(result.warning).toContain('bun run build:app')
    expect(messages[1]?.[1]).toBe('Error: spawn failed')
  })

  it('escapes warning text in the banner', async () => {
    const response = new Response('<body class="x">app</body>', {
      headers: { 'content-type': 'text/html' },
    })
    const warned = await withUiBundleWarning(response, '<script>&"\'')
    const html = await warned.text()
    expect(html).toContain('&lt;script&gt;&amp;&quot;&#39;</div>')
    expect(html).not.toContain('<script>')
  })

  it('returns the same response for JSON or no warning', async () => {
    const json = Response.json({ ok: true })
    expect(await withUiBundleWarning(json, 'warning')).toBe(json)
    expect(await json.json()).toEqual({ ok: true })
    const html = new Response('<body>app</body>', { headers: { 'content-type': 'text/html' } })
    expect(await withUiBundleWarning(html, null)).toBe(html)
    expect(await html.text()).toBe('<body>app</body>')
  })
})
