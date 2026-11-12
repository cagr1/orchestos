/**
 * src/spec/archive.ts — S29
 *
 * archiveSpec(root, taskId) — moves a spec to .orchestos/specs/archive/YYYY-MM-DD-{id}.md
 * and sets status: 'archived' + archivedAt in the frontmatter.
 *
 * The original file is deleted. The archive file is the canonical record.
 * `spec list` hides archived specs by default; `--all` shows them.
 */

import { existsSync, mkdirSync, readdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadSpec, serializeSpec, specPath } from './store.ts'

const SPECS_DIR = '.orchestos/specs'
const ARCHIVE_DIR = `${SPECS_DIR}/archive`

interface ArchiveResult {
  archivedPath: string
  archivedAt: string
}

/**
 * Archive a spec by task id.
 * - Marks status as 'archived' and sets archivedAt.
 * - Moves the file to .orchestos/specs/archive/YYYY-MM-DD-{id}.md.
 * @throws if the spec does not exist
 */
export function archiveSpec(root: string, taskId: string): ArchiveResult {
  const spec = loadSpec(root, taskId)
  if (!spec) throw new Error(`No spec found for task "${taskId}"`)

  const archivedAt = new Date().toISOString()
  const datePrefix = archivedAt.slice(0, 10) // YYYY-MM-DD
  const archiveDir = join(root, ARCHIVE_DIR)
  let archiveFile = join(archiveDir, `${datePrefix}-${taskId}.md`)

  if (!existsSync(archiveDir)) mkdirSync(archiveDir, { recursive: true })

  // Update frontmatter
  spec.frontmatter.status = 'archived'
  spec.frontmatter.archivedAt = archivedAt

  // Write to archive location using saveSpec-compatible serialization
  // We write directly because saveSpec uses the task id, not the date-prefix filename.
  const content = serializeSpec(spec)
  let version = 1
  while (true) {
    try {
      writeFileSync(archiveFile, content, { encoding: 'utf-8', flag: 'wx' })
      break
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      version += 1
      archiveFile = join(archiveDir, `${datePrefix}-${taskId}~${version}.md`)
    }
  }

  // Remove the original file
  const original = specPath(root, taskId)
  if (existsSync(original)) unlinkSync(original)

  return { archivedPath: archiveFile, archivedAt }
}

/**
 * I.8 (Mes 18) — Specs solo tenía archive (soft), sin forma de borrar
 * permanentemente. A propósito solo borra specs YA archivadas — nunca
 * drafts/approved activos, que deben pasar por archiveSpec() primero.
 * @returns true si se borró un archivo, false si no se encontró.
 */
export function deleteArchivedSpec(root: string, taskId: string): boolean {
  const archiveDir = join(root, ARCHIVE_DIR)
  if (!existsSync(archiveDir)) return false
  const escapedId = taskId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`^\\d{4}-\\d{2}-\\d{2}-${escapedId}(~\\d+)?\\.md$`)
  const matches = readdirSync(archiveDir).filter((file) => pattern.test(file))
  for (const file of matches) unlinkSync(join(archiveDir, file))
  return matches.length > 0
}
