import { existsSync, readFileSync, realpathSync } from 'fs'
import { fileURLToPath } from 'url'
import { extname, join, sep } from 'path'
import { redactSensitive } from '../security/secrets.ts'
import { STATIC_DIR } from './types.ts'

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
}

function mimeType(path: string): string {
  return MIME[extname(path)] ?? 'application/octet-stream'
}

const APP_DIR = fileURLToPath(new URL('./app', import.meta.url))

function realBase(root: string): string {
  try {
    return realpathSync(root)
  } catch {
    return root
  }
}

function serveFrom(root: string, rel: string): Response {
  const baseReal = realBase(root)
  let candidate = join(root, rel)

  if (!existsSync(candidate) && !extname(rel)) {
    candidate = join(root, rel + '.html')
  }
  if (!existsSync(candidate)) {
    return new Response('Not found', { status: 404 })
  }

  let real: string
  try {
    real = realpathSync(candidate)
  } catch {
    return new Response('Not found', { status: 404 })
  }
  if (real !== baseReal && !real.startsWith(baseReal + sep)) {
    return new Response('Forbidden', { status: 403 })
  }

  const content = readFileSync(real)
  return new Response(content, {
    headers: { 'Content-Type': mimeType(real) },
  })
}

function serveStatic(url: string): Response {
  if (url === '/legacy' || url.startsWith('/legacy/')) {
    const rel = url === '/legacy' || url === '/legacy/' ? 'index.html' : url.slice('/legacy/'.length)
    const response = serveFrom(STATIC_DIR, rel)
    if (url !== '/legacy' || rel !== 'index.html' || !response.ok) return response
    const html = readFileSync(join(STATIC_DIR, 'index.html'), 'utf8').replace(
      '<head>',
      '<head><base href="/legacy/">',
    )
    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  if (url.startsWith('/app/dist/')) {
    return serveFrom(APP_DIR, url.slice('/app/'.length))
  }

  if (url === '/api' || url.startsWith('/api/')) {
    return new Response('Not found', { status: 404 })
  }

  // The AI Studio prototype is the product UI. Any non-API route without an
  // extension is a client-side route and must boot that app shell.
  if (url === '/' || !extname(url)) {
    return serveFrom(APP_DIR, 'index.html')
  }

  return serveFrom(STATIC_DIR, url.replace(/^\//, ''))
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function errorResponse(msg: string, status: number): Response {
  return jsonResponse({ error: redactSensitive(msg) }, status)
}

// L.2 (Mes 23) — comparar solo el hostname dejaba pasar cualquier página servida
// desde OTRO puerto de localhost (ej. un dev server en :3000 abierto en el mismo
// navegador) porque `localhost`/`127.0.0.1` matcheaban sin importar el puerto —
// CSRF real entre apps locales, no solo entre sitios remotos. Ahora se exige que
// el origen declare exactamente el mismo puerto en el que corre este server.
function isSameOrigin(req: Request, port: number): boolean {
  const origin = req.headers.get('origin')
  if (!origin) return true
  try {
    const o = new URL(origin)
    const hostOk = o.hostname === 'localhost' || o.hostname === '127.0.0.1'
    const portOk = o.port === String(port)
    return hostOk && portOk
  } catch {
    return false
  }
}

// PLAN.md historically includes IDs such as H.8.3'. Keep the shared validator aligned with
// the plan parser so dashboard plan routes can address every persisted plan_item.
const TASK_ID_RE = /^[A-Za-z0-9_.\-']{1,64}$/

function validateTaskId(id: string): string | null {
  const t = id.trim()
  if (!t || !TASK_ID_RE.test(t) || t.startsWith('-')) return null
  return t
}

export { errorResponse, isSameOrigin, jsonResponse, serveStatic, validateTaskId }
