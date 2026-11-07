import { spawnSync } from 'node:child_process'
import {
  chmodSync,
  type Dirent,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import { errorResponse, jsonResponse } from '../http.ts'

// v0.13 seed — panel derecho (header redesign, Mes 21 tardío). Explorador
// del proyecto: lee y edita archivos existentes, un nivel por request (evita leer
// el árbol completo de una vez — proyectos grandes tendrían miles de nodos).
const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', '.next', 'coverage'])
const MAX_FILE_BYTES = 200_000

interface ExplorerEntry {
  name: string
  path: string
  type: 'dir' | 'file'
  ignored: boolean
  size?: number
}

export type ExplorerIgnoreProbe = (root: string, paths: string[]) => string | null

const gitIgnoreProbe: ExplorerIgnoreProbe = (root, paths) => {
  const result = spawnSync('git', ['check-ignore', '--stdin', '-z'], {
    cwd: root,
    input: `${paths.join('\0')}\0`,
    encoding: 'utf8',
    timeout: 3000,
    windowsHide: true,
  })
  return result.status === 0 || result.status === 1 ? result.stdout : null
}

// Evita path traversal (../../etc) — el resuelto debe quedar dentro de root.
function safeResolve(root: string, rel: string): string | null {
  const target = resolve(root, rel || '.')
  if (target !== root && !target.startsWith(root + sep)) return null
  return target
}

function handleApiExplorerTree(
  url: URL,
  root: string,
  probe: ExplorerIgnoreProbe = gitIgnoreProbe,
): Response {
  const rel = url.searchParams.get('path') || ''
  const target = safeResolve(root, rel)
  if (!target) return errorResponse('Invalid path', 400)

  let dirents: Dirent<string>[]
  try {
    dirents = readdirSync(target, { withFileTypes: true, encoding: 'utf8' }) as Dirent<string>[]
  } catch {
    return errorResponse('Not found', 404)
  }

  const entries: ExplorerEntry[] = dirents
    .filter((e) => !IGNORE_DIRS.has(e.name))
    .map((e) => ({
      name: e.name,
      path: relative(root, join(target, e.name)).split(sep).join('/'),
      type: e.isDirectory() ? ('dir' as const) : ('file' as const),
      ignored: false,
      size: e.isDirectory() ? undefined : statSync(join(target, e.name)).size,
    }))
    .sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'dir' ? -1 : 1))

  if (entries.length) {
    try {
      const ignored = new Set(
        (
          probe(
            root,
            entries.map((entry) => entry.path),
          ) ?? ''
        ).split('\0'),
      )
      for (const entry of entries) entry.ignored = ignored.has(entry.path)
    } catch {
      // Git is optional: listing files still works when unavailable.
    }
  }

  return jsonResponse({ path: rel, entries })
}

function handleApiExplorerFile(url: URL, root: string): Response {
  const rel = url.searchParams.get('path')
  if (!rel) return errorResponse('Missing path', 400)
  const target = safeResolve(root, rel)
  if (!target) return errorResponse('Invalid path', 400)

  let stat: ReturnType<typeof statSync>
  try {
    stat = statSync(target)
  } catch {
    return errorResponse('Not found', 404)
  }
  if (!stat.isFile()) return errorResponse('Not a file', 400)
  if (stat.size > MAX_FILE_BYTES) {
    return jsonResponse({
      path: rel,
      content: '',
      tooLarge: true,
      binary: false,
      sizeBytes: stat.size,
      mtimeMs: stat.mtimeMs,
    })
  }

  const buf = readFileSync(target)
  // Sniff heurístico de binario: un null byte en los primeros bytes casi
  // nunca aparece en texto real (mismo criterio que `file`/git).
  const isBinary = buf.subarray(0, 8000).includes(0)
  if (isBinary)
    return jsonResponse({
      path: rel,
      content: '',
      tooLarge: false,
      binary: true,
      mtimeMs: stat.mtimeMs,
      sizeBytes: stat.size,
    })

  return jsonResponse({
    path: rel,
    content: buf.toString('utf-8'),
    tooLarge: false,
    binary: false,
    mtimeMs: stat.mtimeMs,
    sizeBytes: stat.size,
  })
}

async function handleApiExplorerWrite(req: Request, root: string): Promise<Response> {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return errorResponse('Invalid body', 400)
  }
  if (!body || typeof body !== 'object' || Array.isArray(body))
    return errorResponse('Invalid body', 400)
  const { path, content, expectedMtimeMs } = body as Record<string, unknown>
  if (
    typeof path !== 'string' ||
    !path.trim() ||
    typeof content !== 'string' ||
    typeof expectedMtimeMs !== 'number' ||
    !Number.isFinite(expectedMtimeMs)
  )
    return errorResponse('Invalid body', 400)
  const target = safeResolve(root, path)
  if (!target || path.split(sep).includes('.git')) return errorResponse('Invalid path', 400)
  if (Buffer.byteLength(content) > MAX_FILE_BYTES) return errorResponse('File too large', 413)

  let stat: ReturnType<typeof statSync>
  let realTarget: string
  try {
    const realRoot = realpathSync(root)
    realTarget = realpathSync(target)
    if (
      (realTarget !== realRoot && !realTarget.startsWith(realRoot + sep)) ||
      relative(realRoot, realTarget).split(sep).includes('.git')
    )
      return errorResponse('Invalid path', 400)
    stat = statSync(target)
  } catch {
    return errorResponse('Not found', 404)
  }
  if (!stat.isFile()) return errorResponse('Not a file', 400)
  const tmp = `${realTarget}.orchestos-tmp-${process.pid}-${Date.now()}`
  try {
    const current = readFileSync(realTarget)
    if (current.subarray(0, 8000).includes(0)) return errorResponse('Binary file', 400)
    if (Math.abs(stat.mtimeMs - expectedMtimeMs) > 1)
      return jsonResponse(
        { error: 'conflict', mtimeMs: stat.mtimeMs, content: current.toString('utf-8') },
        409,
      )
    writeFileSync(tmp, content)
    chmodSync(tmp, stat.mode)
    renameSync(tmp, realTarget)
    return jsonResponse({ path, mtimeMs: statSync(realTarget).mtimeMs })
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Unable to save file', 500)
  } finally {
    rmSync(tmp, { force: true })
  }
}

export { handleApiExplorerFile, handleApiExplorerTree, handleApiExplorerWrite }
