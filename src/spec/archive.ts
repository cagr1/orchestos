/**
 * src/spec/archive.ts — S29
 *
 * archiveSpec(root, taskId) — moves a spec to .orchestos/specs/archive/YYYY-MM-DD-{id}.md
 * and sets status: 'archived' + archivedAt in the frontmatter.
 *
 * The original file is deleted. The archive file is the canonical record.
 * `spec list` hides archived specs by default; `--all` shows them.
 */

import { join } from 'path'
import { existsSync, mkdirSync, unlinkSync, writeFileSync, readdirSync } from 'fs'
import { loadSpec, specPath } from './store.ts'

const SPECS_DIR = '.orchestos/specs'
const ARCHIVE_DIR = `${SPECS_DIR}/archive`

export interface ArchiveResult {
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

  const archivedAt  = new Date().toISOString()
  const datePrefix  = archivedAt.slice(0, 10) // YYYY-MM-DD
  const archiveDir  = join(root, ARCHIVE_DIR)
  const archiveFile = join(archiveDir, `${datePrefix}-${taskId}.md`)

  if (!existsSync(archiveDir)) mkdirSync(archiveDir, { recursive: true })

  // Update frontmatter
  spec.frontmatter.status     = 'archived'
  spec.frontmatter.archivedAt = archivedAt

  // Write to archive location using saveSpec-compatible serialization
  // We write directly because saveSpec uses the task id, not the date-prefix filename.
  const { serializeSpecRaw } = _internals
  const content = serializeSpecRaw(spec)
  writeFileSync(archiveFile, content, 'utf-8')

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
  const match = readdirSync(archiveDir).find(f => f.endsWith(`-${taskId}.md`))
  if (!match) return false
  unlinkSync(join(archiveDir, match))
  return true
}

// Exposed for testing — raw serialization shared with store.ts logic
import { stringify as yamlStringify } from 'yaml'
import type { Spec } from './store.ts'

export const _internals = {
  serializeSpecRaw(spec: Spec): string {
    const fm: Record<string, unknown> = {
      id:        spec.frontmatter.id,
      status:    spec.frontmatter.status,
      createdAt: spec.frontmatter.createdAt,
      clarify:   spec.frontmatter.clarify,
    }
    if (spec.frontmatter.approvedAt) fm.approvedAt = spec.frontmatter.approvedAt
    if (spec.frontmatter.archivedAt) fm.archivedAt = spec.frontmatter.archivedAt
    const yamlText = yamlStringify(fm).trimEnd()
    return `---\n${yamlText}\n---\n${spec.body}`
  },
}
