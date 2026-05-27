import { createHash } from 'crypto'
import { existsSync, readFileSync, statSync } from 'fs'
import { dirname, extname, join, normalize } from 'path'
import { glob } from 'glob'
import { db } from '../db/sqlite.ts'

const INDEX_GLOB = '**/*.{ts,tsx,js,jsx,mjs,cjs,py}'
const IGNORE = ['node_modules/**', 'dist/**', '.next/**', '.git/**', 'runs/**']
const RESOLVE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.py', '/index.ts', '/index.js']

export interface IndexResult {
  files: number
  edges: number
  changed: number
  removed: number
}

interface ImportEdge {
  kind: 'import' | 'require' | 'from'
  specifier: string
  raw: string
}

export async function indexProject(projectRoot: string, projectId: string): Promise<IndexResult> {
  const files = (await glob(INDEX_GLOB, {
    cwd: projectRoot,
    ignore: IGNORE,
    nodir: true,
  })).map(toPosix).sort()

  const now = new Date().toISOString()
  const seen = new Set(files)
  const existing = db.query<{ id: number; path: string }, string>(
    'SELECT id, path FROM files WHERE project_id = ?'
  ).all(projectId)

  let removed = 0
  for (const row of existing) {
    if (!seen.has(row.path)) {
      db.run('DELETE FROM code_edges WHERE from_file_id = ?', [row.id])
      db.run('DELETE FROM code_edges WHERE to_file_id = ?', [row.id])
      db.run('DELETE FROM files WHERE id = ?', [row.id])
      removed++
    }
  }

  let changed = 0
  let edges = 0
  for (const file of files) {
    const fullPath = join(projectRoot, file)
    const content = readFileSync(fullPath, 'utf-8')
    const sha1 = createHash('sha1').update(content).digest('hex')
    const size = statSync(fullPath).size
    const previous = db.query<{ id: number; sha1: string }, [string, string]>(
      'SELECT id, sha1 FROM files WHERE project_id = ? AND path = ?'
    ).get(projectId, file)

    if (previous?.sha1 === sha1) continue

    const fileId = upsertFile(projectId, file, languageFor(file), sha1, size, now)
    changed++

    db.run('DELETE FROM code_edges WHERE from_file_id = ?', [fileId])

    for (const edge of extractImports(file, content)) {
      const toPath = resolveImport(projectRoot, file, edge.specifier) ?? edge.specifier
      const toFileId = resolveFileId(projectId, toPath)
      db.run(
        `INSERT OR IGNORE INTO code_edges
         (project_id, from_file_id, to_path, to_file_id, kind, raw)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [projectId, fileId, toPath, toFileId, edge.kind, edge.raw]
      )
      edges++
    }
  }

  return { files: files.length, edges, changed, removed }
}

function upsertFile(
  projectId: string,
  path: string,
  language: string,
  sha1: string,
  sizeBytes: number,
  indexedAt: string
): number {
  db.run(
    `INSERT INTO files (project_id, path, language, sha1, size_bytes, indexed_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(project_id, path) DO UPDATE SET
       language = excluded.language,
       sha1 = excluded.sha1,
       size_bytes = excluded.size_bytes,
       indexed_at = excluded.indexed_at`,
    [projectId, path, language, sha1, sizeBytes, indexedAt]
  )
  const row = db.query<{ id: number }, [string, string]>(
    'SELECT id FROM files WHERE project_id = ? AND path = ?'
  ).get(projectId, path)
  if (!row) throw new Error(`failed to upsert indexed file: ${path}`)
  return row.id
}

function extractImports(file: string, content: string): ImportEdge[] {
  const ext = extname(file)
  return ext === '.py' ? extractPythonImports(content) : extractJsImports(content)
}

function extractJsImports(content: string): ImportEdge[] {
  const edges: ImportEdge[] = []
  const patterns: Array<{ kind: ImportEdge['kind']; re: RegExp }> = [
    { kind: 'import', re: /^\s*import\s+(?:[^'"]+\s+from\s+)?['"]([^'"]+)['"].*$/gm },
    { kind: 'require', re: /^\s*(?:const|let|var)?\s*[^=]*=?\s*require\(['"]([^'"]+)['"]\).*$/gm },
  ]
  for (const { kind, re } of patterns) {
    for (const match of content.matchAll(re)) {
      if (match[1]) edges.push({ kind, specifier: match[1], raw: match[0] })
    }
  }
  return edges
}

function extractPythonImports(content: string): ImportEdge[] {
  const edges: ImportEdge[] = []
  const patterns: Array<{ kind: ImportEdge['kind']; re: RegExp }> = [
    { kind: 'from', re: /^\s*from\s+([.\w]+)\s+import\s+.+$/gm },
    { kind: 'import', re: /^\s*import\s+([.\w]+).*$/gm },
  ]
  for (const { kind, re } of patterns) {
    for (const match of content.matchAll(re)) {
      if (match[1]) edges.push({ kind, specifier: match[1], raw: match[0] })
    }
  }
  return edges
}

function resolveImport(projectRoot: string, fromFile: string, specifier: string): string | null {
  if (specifier.startsWith('./') || specifier.startsWith('../')) {
    return resolveRelative(projectRoot, dirname(fromFile), specifier)
  }
  if (specifier.startsWith('.')) {
    const pyPath = specifier.replace(/^\.+/, '').replace(/\./g, '/')
    return pyPath ? resolveRelative(projectRoot, dirname(fromFile), `./${pyPath}`) : null
  }
  return null
}

function resolveRelative(projectRoot: string, fromDir: string, specifier: string): string | null {
  const base = toPosix(normalize(join(fromDir, specifier)))
  const candidates = extname(base) ? [base] : RESOLVE_EXTENSIONS.map(ext => `${base}${ext}`)
  for (const candidate of candidates) {
    if (existsSync(join(projectRoot, candidate))) return candidate
  }
  return null
}

function resolveFileId(projectId: string, path: string): number | null {
  const row = db.query<{ id: number }, [string, string]>(
    'SELECT id FROM files WHERE project_id = ? AND path = ?'
  ).get(projectId, path)
  return row?.id ?? null
}

function languageFor(file: string): string {
  return extname(file).replace(/^\./, '') || 'unknown'
}

function toPosix(path: string): string {
  return path.replace(/\\/g, '/')
}
