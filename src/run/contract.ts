import { createHash, randomUUID } from 'node:crypto'
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import { normalizeRelPath, resolveProjectPath } from './path-policy.ts'

export interface FileChange {
  path: string // relative to project root
  content: string
}

interface ContractResult {
  filesAttempted: string[]
  filesAuthorized: string[]
  filesBlocked: string[]
  written: FileChange[]
}

export interface LLMFileResponse {
  files: FileChange[]
}

// ── snapshot ──────────────────────────────────────────────────────────────────
export function snapshotHashes(root: string, paths: string[]): Record<string, string> {
  const snap: Record<string, string> = {}
  for (const p of paths) {
    const full = join(root, p)
    if (existsSync(full)) {
      snap[p] = createHash('sha1').update(readFileSync(full)).digest('hex')
    } else {
      snap[p] = 'absent'
    }
  }
  return snap
}

// ── parse LLM response ────────────────────────────────────────────────────────
// Expects delimiter format: <<<FILE:path>>>\ncontent\n<<<ENDFILE>>>
// More robust than JSON — no escaping issues with code content.
export function parseLLMResponse(raw: string): LLMFileResponse {
  const files: FileChange[] = []
  const delimiter = /<<<FILE:([^>\n]+)>>>([\s\S]*?)<<<ENDFILE>>>/g
  let match: RegExpExecArray | null

  while ((match = delimiter.exec(raw)) !== null) {
    const rawPath = match[1]
    const rawContent = match[2]
    if (rawPath === undefined || rawContent === undefined) continue
    const path = rawPath.trim()
    if (!path) throw new Error('FILE delimiter found with empty path')
    // Strip exactly one leading newline that follows the opening delimiter
    const content = rawContent.startsWith('\n') ? rawContent.slice(1) : rawContent
    files.push({ path, content })
  }

  if (files.length === 0) {
    throw new Error(
      `No <<<FILE:...>>>...<<<ENDFILE>>> blocks found in LLM response.\n` +
        `Got:\n${raw.slice(0, 400)}`,
    )
  }

  return { files }
}

export { normalizeRelPath } from './path-policy.ts'

// ── enforce contract ──────────────────────────────────────────────────────────
// BLOCKS writes outside allowedPaths — throws on violation.
export function enforceContract(
  root: string,
  response: LLMFileResponse,
  allowedPaths: string[],
): ContractResult {
  mkdirSync(root, { recursive: true })
  const normalizedAllowed = allowedPaths.map(normalizeRelPath)
  const attempted: string[] = []
  const authorized: string[] = []
  const blocked: string[] = []

  for (const file of response.files) {
    const normalizedPath = normalizeRelPath(file.path)
    attempted.push(normalizedPath)
    if (!normalizedAllowed.includes(normalizedPath)) {
      blocked.push(normalizedPath)
    } else {
      authorized.push(normalizedPath)
    }
  }

  if (blocked.length > 0) {
    throw new Error(
      `CONTRACT VIOLATION — LLM attempted to write files outside declared outputs:\n` +
        blocked.map((p) => `  ✗ ${p}`).join('\n') +
        `\nAllowed: ${normalizedAllowed.join(', ')}`,
    )
  }

  const written: FileChange[] = []
  const staged: {
    destination: string
    temporary: string
    previous: Buffer | null
    created: boolean
  }[] = []
  let committed = 0
  try {
    for (const file of response.files) {
      const normalizedPath = normalizeRelPath(file.path)
      const destination = resolveProjectPath(root, normalizedPath, 'write')
      mkdirSync(dirname(destination), { recursive: true })
      const temporary = `${destination}.orchestos-tmp-${randomUUID()}`
      const previous = existsSync(destination) ? readFileSync(destination) : null
      const entry = { destination, temporary, previous, created: false }
      staged.push(entry)
      try {
        writeFileSync(temporary, file.content, { encoding: 'utf-8', flag: 'wx' })
      } catch (error) {
        // Nombre con UUID: solo EEXIST significa que el archivo es ajeno; cualquier otro fallo
        // (p. ej. ENOSPC a mitad) puede haber dejado nuestro temporal creado.
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') entry.created = true
        throw error
      }
      entry.created = true
      written.push({ path: normalizedPath, content: file.content })
    }
    for (const file of staged) {
      if (existsSync(file.destination)) {
        chmodSync(file.temporary, statSync(file.destination).mode & 0o7777)
      }
      renameSync(file.temporary, file.destination)
      committed += 1
    }
  } catch (error) {
    const failedRestores: string[] = []
    for (const file of staged.slice(0, committed).reverse()) {
      try {
        if (file.previous === null) unlinkSync(file.destination)
        else writeFileSync(file.destination, file.previous)
      } catch {
        failedRestores.push(file.destination)
      }
    }
    if (failedRestores.length > 0) {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(`${message} (rollback incompleto: ${failedRestores.join(', ')})`, {
        cause: error,
      })
    }
    throw error
  } finally {
    for (const file of staged) {
      // La limpieza nunca tapa el error del commit/rollback ni deja de intentar los demás.
      try {
        if (file.created && existsSync(file.temporary)) unlinkSync(file.temporary)
      } catch {
        /* temporal huérfano: no reemplaza el error original */
      }
    }
  }

  return { filesAttempted: attempted, filesAuthorized: authorized, filesBlocked: blocked, written }
}
