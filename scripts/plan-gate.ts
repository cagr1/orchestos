import { execFileSync } from 'node:child_process'
import { runMigrations } from '../src/db/migrate.ts'
import { db } from '../src/db/sqlite.ts'
import { parsePlanDocumentSegments, parsePlanFeatureStatus } from './plan-status.ts'

function git(args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf8' })
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

function checkProvenance(): void {
  const diff = git(['diff', '--cached', '-U0', '--', 'PLAN.md'])
  const deletedOpen = new Set<string>()
  const addedDone = new Set<string>()
  const line = /^(--|\+-) \[([ x])\] \*\*([A-Za-z0-9][A-Za-z0-9.'-]*) — /
  for (const entry of diff.split('\n')) {
    const match = entry.match(line)
    if (!match) continue
    if (match[1] === '--' && match[2] === ' ' && match[3]) deletedOpen.add(match[3])
    if (match[1] === '+-' && match[2] === 'x' && match[3]) addedDone.add(match[3])
  }

  const closed = [...deletedOpen].filter((id) => addedDone.has(id))
  if (closed.length === 0) return
  const stagedPlan = git(['show', ':PLAN.md'])
  const segments = parsePlanDocumentSegments(stagedPlan)
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
