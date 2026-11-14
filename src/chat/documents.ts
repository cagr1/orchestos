import { createHash } from 'node:crypto'
import {
  type Dirent,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
} from 'node:fs'
import { basename, isAbsolute, join, relative, sep } from 'node:path'
import { parseJson, z } from '../boundary/index.ts'
import { orchestosDir } from '../config/orchestos-home.ts'

export interface ChatDocument {
  name: string
  path: string
  size: number
}

export function chatDirectory(sessionId: string, create = false): string {
  if (!/^[a-zA-Z0-9_-]+$/.test(sessionId)) throw new Error('Invalid session id')
  const base = join(orchestosDir(), 'chats')
  const directory = join(base, sessionId)
  if (create) mkdirSync(directory, { recursive: true })
  // A session directory itself must never be a symlink to another workspace.
  if (lstatSync(directory).isSymbolicLink()) throw new Error('Invalid chat directory')
  const canonical = realpathSync(directory)
  if (relative(realpathSync(base), canonical) !== sessionId)
    throw new Error('Invalid chat directory')
  return canonical
}

export function resolveChatDocument(sessionId: string, path: string): string {
  const root = chatDirectory(sessionId)
  if (!path || isAbsolute(path) || path.split(/[\\/]/).includes('..'))
    throw new Error('Invalid document path')
  const target = realpathSync(join(root, path))
  const inside = relative(root, target)
  if (!inside || inside === '..' || inside.startsWith(`..${sep}`) || isAbsolute(inside))
    throw new Error('Invalid document path')
  if (!lstatSync(target).isFile()) throw new Error('Invalid document path')
  return target
}

export function snapshotChatDocuments(root: string): Map<string, string> {
  const result = new Map<string, string>()
  const visit = (directory: string) => {
    let entries: Dirent[]
    try {
      entries = readdirSync(directory, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) visit(path)
      else if (entry.isFile()) {
        // Content hash; an unreadable file falls back to size+mtime and never blocks the turn (qa USO.11).
        try {
          result.set(
            relative(root, path),
            createHash('sha256').update(readFileSync(path)).digest('hex'),
          )
        } catch {
          try {
            const stat = lstatSync(path)
            result.set(relative(root, path), `stat:${stat.size}:${stat.mtimeMs}`)
          } catch {
            // Vanished between listing and stat: not a delivered document.
          }
        }
      }
    }
  }
  visit(root)
  return result
}

export function changedChatDocuments(root: string, before: Map<string, string>): ChatDocument[] {
  return [...snapshotChatDocuments(root)]
    .filter(([path, hash]) => before.get(path) !== hash)
    .map(([path]) => ({ name: basename(path), path, size: lstatSync(join(root, path)).size }))
    .sort((a, b) => a.path.localeCompare(b.path))
}

export function removeChatDirectory(sessionId: string): void {
  if (!/^[a-zA-Z0-9_-]+$/.test(sessionId)) throw new Error('Invalid session id')
  rmSync(join(orchestosDir(), 'chats', sessionId), { recursive: true, force: true })
}

const documentEnvelope = z.object({
  documents: z.array(
    z.object({ name: z.string(), path: z.string(), size: z.number().int().nonnegative() }),
  ),
})

export function documentsFromEnvelope(envelope: string | null): ChatDocument[] | undefined {
  if (!envelope) return undefined
  const parsed = parseJson(documentEnvelope, envelope)
  return parsed.ok ? parsed.data.documents : undefined
}
