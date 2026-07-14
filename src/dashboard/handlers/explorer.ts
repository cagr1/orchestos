import { resolve, join, relative, sep } from 'path'
import { readdirSync, statSync, readFileSync } from 'fs'
import { jsonResponse, errorResponse } from '../http.ts'

// v0.13 seed — panel derecho (header redesign, Mes 21 tardío). Explorador
// read-only del proyecto: un nivel por request (patrón VS Code, evita leer
// el árbol completo de una vez — proyectos grandes tendrían miles de nodos).
const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', '.next', 'coverage'])
const MAX_FILE_BYTES = 200_000

interface ExplorerEntry {
  name: string
  path: string
  type: 'dir' | 'file'
}

// Evita path traversal (../../etc) — el resuelto debe quedar dentro de root.
function safeResolve(root: string, rel: string): string | null {
  const target = resolve(root, rel || '.')
  if (target !== root && !target.startsWith(root + sep)) return null
  return target
}

function handleApiExplorerTree(url: URL): Response {
  const root = resolve('.')
  const rel = url.searchParams.get('path') || ''
  const target = safeResolve(root, rel)
  if (!target) return errorResponse('Invalid path', 400)

  let dirents
  try {
    dirents = readdirSync(target, { withFileTypes: true })
  } catch {
    return errorResponse('Not found', 404)
  }

  const entries: ExplorerEntry[] = dirents
    .filter(e => !IGNORE_DIRS.has(e.name))
    .map(e => ({
      name: e.name,
      path: relative(root, join(target, e.name)).split(sep).join('/'),
      type: e.isDirectory() ? 'dir' as const : 'file' as const,
    }))
    .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1))

  return jsonResponse({ path: rel, entries })
}

function handleApiExplorerFile(url: URL): Response {
  const root = resolve('.')
  const rel = url.searchParams.get('path')
  if (!rel) return errorResponse('Missing path', 400)
  const target = safeResolve(root, rel)
  if (!target) return errorResponse('Invalid path', 400)

  let stat
  try {
    stat = statSync(target)
  } catch {
    return errorResponse('Not found', 404)
  }
  if (!stat.isFile()) return errorResponse('Not a file', 400)
  if (stat.size > MAX_FILE_BYTES) {
    return jsonResponse({ path: rel, content: '', tooLarge: true, binary: false, sizeBytes: stat.size })
  }

  const buf = readFileSync(target)
  // Sniff heurístico de binario: un null byte en los primeros bytes casi
  // nunca aparece en texto real (mismo criterio que `file`/git).
  const isBinary = buf.subarray(0, 8000).includes(0)
  if (isBinary) return jsonResponse({ path: rel, content: '', tooLarge: false, binary: true })

  return jsonResponse({ path: rel, content: buf.toString('utf-8'), tooLarge: false, binary: false })
}

export { handleApiExplorerTree, handleApiExplorerFile }
