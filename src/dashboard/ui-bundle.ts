import { existsSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

type UiBundleState =
  | { state: 'missing' }
  | { state: 'stale'; newerSource: string }
  | { state: 'fresh' }

let warning: string | null = null

function* sourceFiles(directory: string, dist: string): Generator<string> {
  if (!existsSync(directory)) return
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (path === dist || entry.name === 'node_modules') continue
    if (entry.isDirectory()) yield* sourceFiles(path, dist)
    else if (entry.isFile()) yield path
  }
}

export function readUiBundleState(root: string): UiBundleState {
  const app = join(root, 'src/dashboard/app')
  const bundle = join(app, 'dist/main.js')
  if (!existsSync(bundle)) return { state: 'missing' }
  const bundleTime = statSync(bundle).mtimeMs
  const sources = [...sourceFiles(app, join(app, 'dist')), join(root, 'scripts/build-app.ts')]
  for (const source of sources) {
    if (existsSync(source) && statSync(source).mtimeMs > bundleTime)
      return { state: 'stale', newerSource: relative(root, source) }
  }
  return { state: 'fresh' }
}

function runBuildApp(root: string) {
  const result = Bun.spawnSync(['bun', 'run', 'build:app'], {
    cwd: root,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  return {
    ok: result.exitCode === 0,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  }
}

export function ensureFreshUiBundle(
  root: string,
  build = runBuildApp,
  log: Pick<Console, 'log' | 'error'> = console,
) {
  warning = null
  const state = readUiBundleState(root)
  if (state.state === 'fresh') return { rebuilt: false, warning }
  const reason =
    state.state === 'missing' ? 'UI bundle missing' : `newer source: ${state.newerSource}`
  log.log(`[dashboard] ${reason} — running bun run build:app...`)
  let output: string
  try {
    const result = build(root)
    if (result.ok && readUiBundleState(root).state === 'fresh') {
      log.log('[dashboard] UI bundle rebuilt.')
      return { rebuilt: true, warning }
    }
    output = [result.stdout, result.stderr].filter(Boolean).join('\n')
  } catch (error) {
    output = String(error)
  }
  warning = `The dashboard UI is out of date (${reason}) and the rebuild failed. Run "bun run build:app" and restart the dashboard.`
  log.error(`[dashboard] ${warning}`, output)
  return { rebuilt: false, warning }
}

export function uiBundleWarning(): string | null {
  return warning
}

export async function withUiBundleWarning(
  response: Response,
  warning: string | null,
): Promise<Response> {
  if (!warning || !response.headers.get('content-type')?.startsWith('text/html')) return response
  const escaped = warning.replace(/[&<>"']/g, (character) => {
    return (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character] ??
      character
    )
  })
  const html = await response.text()
  const body = html.replace(
    /<body[^>]*>/,
    (tag) =>
      `${tag}<div role="alert" data-ui-bundle-warning style="position:fixed;top:0;left:0;right:0;z-index:2147483647;padding:12px;background:#fff3cd;color:#664d03;font:16px sans-serif">${escaped}</div>`,
  )
  const headers = new Headers(response.headers)
  headers.delete('content-length')
  return new Response(body, { status: response.status, statusText: response.statusText, headers })
}
