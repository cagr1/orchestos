import { execFileSync } from 'node:child_process'
import { posix } from 'node:path'
import { runMigrations } from '../src/db/migrate.ts'
import { db } from '../src/db/sqlite.ts'
import {
  parsePlanDocumentSegments,
  parsePlanFeatureStatus,
  parsePlanItemSources,
} from './plan-status.ts'

function git(args: string[], cwd?: string): string {
  return execFileSync('git', args, { encoding: 'utf8', cwd })
}

function stagedBlob(path: string, cwd?: string): string {
  const mode = git(['ls-files', '-s', '--', path], cwd).trim().split(/\s+/)[0]
  if (!mode || mode === '120000')
    throw new Error(`Evidence ${path}: staged path is not a regular blob`)
  return git(['show', `:${path}`], cwd)
}

function sectionFor(text: string, path: string, anchor: string): string {
  const marker = `<a id="${anchor}"></a>`
  const first = text.indexOf(marker)
  if (first === -1) throw new Error(`Evidence ${path}#${anchor}: anchor is absent`)
  if (text.indexOf(marker, first + marker.length) !== -1)
    throw new Error(`Evidence ${path}#${anchor}: anchor is duplicated`)
  const next = text.indexOf('<a id="', first + marker.length)
  return text.slice(first, next === -1 ? text.length : next)
}

/**
 * Resolves `→ [evidencia](docs/done/x.md#anchor)` to that section's text, reading the
 * STAGED blob (never the working tree). `cwd` defaults to `process.cwd()` for the
 * pre-commit hook's own use; `check-live-gate.ts` passes an explicit fixture root in tests.
 */
export function evidenceSectionFromIndex(
  href: string,
  cwd?: string,
): { path: string; section: string } {
  const split = href.indexOf('#')
  if (split <= 0 || split === href.length - 1)
    throw new Error(`Evidence link must include file and anchor: ${href}`)
  const path = href.slice(0, split)
  const anchor = href.slice(split + 1)
  if (
    path.startsWith('/') ||
    path.includes('\\') ||
    !path.startsWith('docs/done/') ||
    posix.normalize(path) !== path ||
    path.split('/').includes('..') ||
    /^[a-z][a-z0-9+.-]*:/i.test(path)
  )
    throw new Error(`Evidence link must stay under docs/done/: ${href}`)
  return { path, section: sectionFor(stagedBlob(path, cwd), path, anchor) }
}

function sectionAtHead(path: string, anchor: string, cwd?: string): string {
  try {
    return sectionFor(git(['show', `HEAD:${path}`], cwd), path, anchor)
  } catch {
    return ''
  }
}

function checkSegmentStatuses(): void {
  const segments = db
    .query<{ text: string; item_id: string | null }, []>(
      "SELECT text, item_id FROM plan_doc_segments WHERE doc = 'PLAN.md' AND kind = 'item' ORDER BY position",
    )
    .all()
  for (const segment of segments) {
    if (!segment.item_id || !segment.text) throw new Error('Item segment has no item_id or text')
    const parsed = parsePlanFeatureStatus(segment.text)
    if (parsed.length !== 1)
      throw new Error(`Could not parse exactly one item segment: ${segment.item_id}`)
    const parsedItem = parsed[0]
    if (!parsedItem) throw new Error(`Could not parse item segment: ${segment.item_id}`)
    const status = db
      .query<{ status: string }, string>('SELECT status FROM plan_items WHERE id = ?')
      .get(segment.item_id)
    if (!status) throw new Error(`Item segment has no plan_items row: ${segment.item_id}`)
    if (parsedItem.status !== status.status)
      throw new Error(
        `Status mismatch for ${segment.item_id}: segment=${parsedItem.status}, DB=${status.status}`,
      )
  }
}

/**
 * IDs whose PLAN.md line flips from `[ ]` to `[x]` in the staged diff. Shared with
 * `check-live-gate.ts` so both gates agree on what "this commit closes" means.
 */
export function closedPlanItemIds(diff: string): string[] {
  const deletedOpen = new Set<string>()
  const addedDone = new Set<string>()
  const line = /^(--|\+-) \[([ x])\] \*\*([A-Za-z0-9][A-Za-z0-9.'-]*) — /
  for (const entry of diff.split('\n')) {
    const match = entry.match(line)
    if (!match) continue
    if (match[1] === '--' && match[2] === ' ' && match[3]) deletedOpen.add(match[3])
    if (match[1] === '+-' && match[2] === 'x' && match[3]) addedDone.add(match[3])
  }
  return [...deletedOpen].filter((id) => addedDone.has(id))
}

export function checkProvenance(): void {
  const diff = git(['diff', '--cached', '-U0', '--', 'PLAN.md'])
  const closed = closedPlanItemIds(diff)
  if (closed.length === 0) return
  const stagedPlan = git(['show', ':PLAN.md'])
  const segments = parsePlanDocumentSegments(stagedPlan)
  const sources = new Map(parsePlanItemSources(stagedPlan).map((item) => [item.id, item]))
  const deletedSpecs = new Set(
    git(['diff', '--cached', '--diff-filter=D', '--name-only']).split('\n').filter(Boolean),
  )
  for (const id of closed) {
    const segment = segments.find((candidate) => candidate.itemId === id)
    if (!segment) throw new Error(`Closed item ${id} is missing from staged PLAN.md`)
    const hasDelegation = segment.text.split('\n').some((item) => /^\s+Ejecutado por:/.test(item))
    const noDelegation = segment.text
      .split('\n')
      .some((item) => /^\s+Sin delegación:\s+\S/.test(item))
    const evidenceAdded = diff
      .split('\n')
      .some((item) => item.startsWith('+') && /^\+\s+Ejecutado por:/.test(item))
    if (noDelegation) continue
    if (!deletedSpecs.has(`docs/specs/${id}.md`))
      throw new Error(
        `Procedencia ${id}: commit must delete docs/specs/${id}.md (or use Sin delegación: <motivo>)`,
      )
    const source = sources.get(id)
    if (source?.evidenceHref) {
      const hrefSplit = source.evidenceHref.indexOf('#')
      const { path, section } = evidenceSectionFromIndex(source.evidenceHref)
      const anchor = source.evidenceHref.slice(hrefSplit + 1)
      const expected = new RegExp(
        `^Ejecutado por: .+ · Spec: docs/specs/${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.md$`,
        'm',
      )
      if (!expected.test(section))
        throw new Error(
          `Procedencia ${id}: evidence section must declare its executor and exact spec`,
        )
      if (expected.test(sectionAtHead(path, anchor)))
        throw new Error(
          `Procedencia ${id}: executor declaration must be added in this evidence section`,
        )
      continue
    }
    if (!hasDelegation || !evidenceAdded)
      throw new Error(
        `Procedencia ${id}: staged PLAN.md must add a line starting with Ejecutado por:`,
      )
  }
}

if (import.meta.main) {
  try {
    runMigrations()
    checkSegmentStatuses()
    checkProvenance()
  } catch (error) {
    console.error(`✗ plan gate: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  }
}
