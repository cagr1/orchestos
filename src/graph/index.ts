import { createHash } from 'crypto'
import { existsSync, readFileSync, statSync } from 'fs'
import { glob } from 'glob'
import { dirname, extname, join, normalize } from 'path'
import { db } from '../db/sqlite.ts'
import { inferEmbeddingProvider } from '../providers/embeddings.ts'
import { registerResolver, resolveWithRegistry } from './resolver-registry.ts'
import { csharpResolver } from './resolvers/csharp.ts'
import { goResolver } from './resolvers/go.ts'
import { javaResolver } from './resolvers/java.ts'
import { rubyResolver } from './resolvers/ruby.ts'
import { rustResolver } from './resolvers/rust.ts'

const INDEX_GLOB =
  '**/*.{ts,tsx,js,jsx,mjs,cjs,py,cs,rs,go,java,kt,rb,php,swift,scala,ex,exs,hs,lua,pl,pm}'
const IGNORE = [
  'node_modules/**',
  'dist/**',
  '.next/**',
  '.git/**',
  'runs/**',
  'bin/**',
  'obj/**',
  'target/**',
]
registerResolver(csharpResolver)
registerResolver(rustResolver)
registerResolver(goResolver)
registerResolver(javaResolver)
registerResolver(rubyResolver)
const RESOLVE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.py', '/index.ts', '/index.js']

export interface IndexOpts {
  noEmbed?: boolean
}

export interface IndexResult {
  files: number
  edges: number
  changed: number
  removed: number
  embeddings: number
}

interface ImportEdge {
  kind: 'import' | 'require' | 'from' | 'use'
  specifier: string
  raw: string
}

const EMBED_CHUNK_MAX = 8000

export async function indexProject(
  projectRoot: string,
  projectId: string,
  opts?: IndexOpts,
): Promise<IndexResult> {
  const files = (
    await glob(INDEX_GLOB, {
      cwd: projectRoot,
      ignore: IGNORE,
      nodir: true,
    })
  )
    .map(toPosix)
    .sort()

  const now = new Date().toISOString()
  const seen = new Set(files)
  const existing = db
    .query<{ id: number; path: string }, string>('SELECT id, path FROM files WHERE project_id = ?')
    .all(projectId)

  let removed = 0
  for (const row of existing) {
    if (!seen.has(row.path)) {
      db.run('DELETE FROM code_edges WHERE from_file_id = ?', [row.id])
      db.run('DELETE FROM code_edges WHERE to_file_id = ?', [row.id])
      db.run('DELETE FROM files WHERE id = ?', [row.id])
      removed++
    }
  }

  const embedProvider = opts?.noEmbed ? null : inferEmbeddingProvider('openrouter')

  // S (Mes 26, 2026-08-06) — bug real encontrado al investigar #5 (Ruby resolver):
  // este bucle era UN SOLO PASE — cada archivo se upsertaba y sus edges se
  // resolvían en el mismo instante, contra la tabla `files` tal como estaba EN
  // ESE MOMENTO. Si el archivo importado ordenaba alfabéticamente DESPUÉS en el
  // glob (ej. `a.ts` importa `z.ts`), su fila todavía no existía cuando
  // `resolveFileId()` se llamaba — el resolver encontraba el path correcto, pero
  // el lookup por id fallaba y el edge quedaba huérfano (`to_file_id: null`)
  // PARA SIEMPRE, porque un archivo sin cambios (`sha1` igual) nunca vuelve a
  // pasar por acá. Verificado en vivo: 0/2 Rust, 0/3 C#, 0/1 Go, 1/3 Java,
  // 0/1 JS/TS resueltos con los fixtures reales de tests/fixtures/graph/ — no
  // era específico de un lenguaje, era el pase entero desde S21.
  //
  // Fix: dos pasadas. (1) upsert de TODOS los archivos primero — la tabla
  // `files` queda completa antes de resolver un solo edge. (2) edges solo para
  // los archivos que cambiaron, ahora contra el estado final de `files`.
  let changed = 0
  let edges = 0
  let embeddings = 0
  const toResolve: Array<{ file: string; fileId: number; content: string }> = []

  for (const file of files) {
    const fullPath = join(projectRoot, file)
    const content = readFileSync(fullPath, 'utf-8')
    const sha1 = createHash('sha1').update(content).digest('hex')
    const size = statSync(fullPath).size
    const previous = db
      .query<{ id: number; sha1: string }, [string, string]>(
        'SELECT id, sha1 FROM files WHERE project_id = ? AND path = ?',
      )
      .get(projectId, file)

    if (previous?.sha1 === sha1) {
      // unchanged but check if embedding is missing
      if (embedProvider && !hasEmbedding(projectId, file)) {
        const emb = await embedFile(embedProvider, file, content)
        if (emb) {
          saveEmbedding(projectId, file, emb)
          embeddings++
        }
      }
      continue
    }

    const fileId = upsertFile(projectId, file, languageFor(file), sha1, size, now)
    changed++
    toResolve.push({ file, fileId, content })

    if (embedProvider) {
      const emb = await embedFile(embedProvider, file, content)
      if (emb) {
        saveEmbedding(projectId, file, emb)
        embeddings++
      }
    }
  }

  // Pass 2 — `files` ya tiene TODAS las filas (cambiadas y sin cambios) antes
  // de resolver un solo edge, sin importar el orden del glob.
  const repoFiles = files.map((p) => ({ path: p, language: languageFor(p) }))
  for (const { file, fileId, content } of toResolve) {
    db.run('DELETE FROM code_edges WHERE from_file_id = ?', [fileId])
    for (const edge of extractImports(file, content)) {
      const toPath = resolveImport(projectRoot, file, edge.specifier) ?? edge.specifier
      const language = languageFor(file)
      const registryPath = resolveWithRegistry(language, edge.specifier, file, {
        projectRoot,
        projectId,
        files: repoFiles,
      })
      const toFileId = registryPath
        ? resolveFileId(projectId, registryPath)
        : resolveFileId(projectId, toPath)
      db.run(
        `INSERT OR IGNORE INTO code_edges
         (project_id, from_file_id, to_path, to_file_id, kind, raw)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [projectId, fileId, toPath, toFileId, edge.kind, edge.raw],
      )
      edges++
    }
  }

  return { files: files.length, edges, changed, removed, embeddings }
}

function upsertFile(
  projectId: string,
  path: string,
  language: string,
  sha1: string,
  sizeBytes: number,
  indexedAt: string,
): number {
  db.run(
    `INSERT INTO files (project_id, path, language, sha1, size_bytes, indexed_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(project_id, path) DO UPDATE SET
       language = excluded.language,
       sha1 = excluded.sha1,
       size_bytes = excluded.size_bytes,
       indexed_at = excluded.indexed_at`,
    [projectId, path, language, sha1, sizeBytes, indexedAt],
  )
  const row = db
    .query<{ id: number }, [string, string]>(
      'SELECT id FROM files WHERE project_id = ? AND path = ?',
    )
    .get(projectId, path)
  if (!row) throw new Error(`failed to upsert indexed file: ${path}`)
  return row.id
}

function extractImports(file: string, content: string): ImportEdge[] {
  const ext = extname(file).toLowerCase()
  switch (ext) {
    case '.py':
      return extractPythonImports(content)
    case '.cs':
      return extractCSharpImports(content)
    case '.rs':
      return extractRustImports(content)
    case '.go':
      return extractGoImports(content)
    case '.java':
    case '.kt':
    case '.scala':
      return extractJvmImports(content)
    case '.rb':
      return extractRubyImports(content)
    case '.php':
      return extractPhpImports(content)
    case '.swift':
      return extractSwiftImports(content)
    case '.ex':
    case '.exs':
      return extractElixirImports(content)
    default:
      return extractJsImports(content)
  }
}

function extractJsImports(content: string): ImportEdge[] {
  const edges: ImportEdge[] = []
  const patterns: Array<{ kind: ImportEdge['kind']; re: RegExp }> = [
    { kind: 'import', re: /^\s*import\s+(?:[^'"]+\s+from\s+)?['"]([^'"]+)['"].*$/gm },
    { kind: 'require', re: /^\s*(?:const|let|var)?\s*[^=]*=?\s*require\(['"]([^'"]+)['"]\).*$/gm },
  ]
  for (const { kind, re } of patterns) {
    for (const match of content.matchAll(re)) {
      if (match[1]) edges.push({ kind, specifier: match[1], raw: match[0].trim() })
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
      if (match[1]) edges.push({ kind, specifier: match[1], raw: match[0].trim() })
    }
  }
  return edges
}

function extractCSharpImports(content: string): ImportEdge[] {
  const edges: ImportEdge[] = []
  for (const match of content.matchAll(/^\s*using\s+([\w.]+)\s*;/gm)) {
    if (match[1]) edges.push({ kind: 'use', specifier: match[1], raw: match[0].trim() })
  }
  return edges
}

function extractRustImports(content: string): ImportEdge[] {
  const edges: ImportEdge[] = []
  for (const match of content.matchAll(/^\s*use\s+([\w:]+(?:::\{[^}]+\})?)\s*;/gm)) {
    if (match[1]) edges.push({ kind: 'use', specifier: match[1], raw: match[0].trim() })
  }
  for (const match of content.matchAll(/^\s*extern\s+crate\s+([\w]+)\s*;/gm)) {
    if (match[1]) edges.push({ kind: 'import', specifier: match[1], raw: match[0].trim() })
  }
  return edges
}

function extractGoImports(content: string): ImportEdge[] {
  const edges: ImportEdge[] = []
  // single import: import "pkg"
  for (const match of content.matchAll(/^\s*import\s+"([^"]+)"/gm)) {
    if (match[1]) edges.push({ kind: 'import', specifier: match[1], raw: match[0].trim() })
  }
  // block import: import ( "pkg" )
  const blockMatch = content.match(/import\s*\(([\s\S]*?)\)/)
  if (blockMatch?.[1]) {
    for (const m of blockMatch[1].matchAll(/"([^"]+)"/g)) {
      if (m[1]) edges.push({ kind: 'import', specifier: m[1], raw: m[0] })
    }
  }
  return edges
}

function extractJvmImports(content: string): ImportEdge[] {
  const edges: ImportEdge[] = []
  for (const match of content.matchAll(/^\s*import\s+([\w]+(?:\.[\w]+)*(?:\.\*)?)\s*;?/gm)) {
    if (match[1]) edges.push({ kind: 'import', specifier: match[1], raw: match[0].trim() })
  }
  return edges
}

function extractRubyImports(content: string): ImportEdge[] {
  const edges: ImportEdge[] = []
  // S.2 (Mes 26, 2026-08-06) — `require_relative` y `require` tienen semántica
  // de resolución distinta (relativo al archivo vs. `$LOAD_PATH`, que puede ser
  // una gema externa), pero el `Resolver.resolve()` compartido solo recibe
  // `specifier` (nunca `kind`) — no hay forma de distinguirlos ahí. Se
  // distinguen ACÁ, en la extracción: `require_relative` siempre es relativo
  // por definición del lenguaje, así que se normaliza con `./` al frente si no
  // lo trae ya (`require_relative 'foo'` y `require_relative './foo'` son el
  // mismo require) — no es un hack, es la semántica real de Ruby.
  for (const match of content.matchAll(/^\s*require_relative\s+['"]([^'"]+)['"]/gm)) {
    if (match[1]) {
      const specifier = match[1].startsWith('.') ? match[1] : `./${match[1]}`
      edges.push({ kind: 'require', specifier, raw: match[0].trim() })
    }
  }
  for (const match of content.matchAll(/^\s*require\s+['"]([^'"]+)['"]/gm)) {
    if (match[1]) edges.push({ kind: 'require', specifier: match[1], raw: match[0].trim() })
  }
  return edges
}

function extractPhpImports(content: string): ImportEdge[] {
  const edges: ImportEdge[] = []
  for (const match of content.matchAll(/^\s*(?:require|include)(?:_once)?\s+['"]([^'"]+)['"]/gm)) {
    if (match[1]) edges.push({ kind: 'require', specifier: match[1], raw: match[0].trim() })
  }
  for (const match of content.matchAll(/^\s*use\s+([\w\\]+)/gm)) {
    if (match[1]) edges.push({ kind: 'use', specifier: match[1], raw: match[0].trim() })
  }
  return edges
}

function extractSwiftImports(content: string): ImportEdge[] {
  const edges: ImportEdge[] = []
  for (const match of content.matchAll(/^\s*import\s+([\w.]+)/gm)) {
    if (match[1]) edges.push({ kind: 'import', specifier: match[1], raw: match[0].trim() })
  }
  return edges
}

function extractElixirImports(content: string): ImportEdge[] {
  const edges: ImportEdge[] = []
  for (const match of content.matchAll(/^\s*(?:alias|import|use|require)\s+([\w.]+)/gm)) {
    if (match[1]) edges.push({ kind: 'use', specifier: match[1], raw: match[0].trim() })
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
  const candidates = extname(base) ? [base] : RESOLVE_EXTENSIONS.map((ext) => `${base}${ext}`)
  for (const candidate of candidates) {
    if (existsSync(join(projectRoot, candidate))) return candidate
  }
  return null
}

function resolveFileId(projectId: string, path: string): number | null {
  const row = db
    .query<{ id: number }, [string, string]>(
      'SELECT id FROM files WHERE project_id = ? AND path = ?',
    )
    .get(projectId, path)
  return row?.id ?? null
}

function languageFor(file: string): string {
  return extname(file).replace(/^\./, '') || 'unknown'
}

function toPosix(path: string): string {
  return path.replace(/\\/g, '/')
}

// -- Embedding helpers (S24.3) ------------------------------------------------

function hasEmbedding(projectId: string, file: string): boolean {
  const row = db
    .query<{ embedding: string | null }, [string, string]>(
      'SELECT embedding FROM files WHERE project_id = ? AND path = ?',
    )
    .get(projectId, file)
  return row?.embedding != null && row.embedding !== ''
}

async function embedFile(
  provider: { embed(texts: string[]): Promise<{ embeddings: number[][] }> },
  file: string,
  content: string,
): Promise<number[] | null> {
  const text = `File: ${file}\n\n${content.slice(0, EMBED_CHUNK_MAX)}`
  try {
    const res = await provider.embed([text])
    return res.embeddings[0] ?? null
  } catch {
    return null
  }
}

function saveEmbedding(projectId: string, file: string, embedding: number[]): void {
  db.run(`UPDATE files SET embedding = ? WHERE project_id = ? AND path = ?`, [
    JSON.stringify(embedding),
    projectId,
    file,
  ])
}
