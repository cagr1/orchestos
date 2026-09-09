import type { Database } from 'bun:sqlite'
import { parsePlanItemSources } from '../../scripts/plan-status.ts'
import { db } from './sqlite.ts'

export interface RenderedPlanSegment {
  position: number
  kind: string
  text: string | null
  item_id: string | null
}

interface StoredPlanItem {
  id: string
  sprint: string
  block: string | null
  delegation: string
  title: string
  status: string
  position: number
}

/**
 * The document is rendered from segments, but its item metadata must remain the
 * same projection as plan_items.  Refusing a divergent projection is safer than
 * returning a PLAN.md that merely looks synchronized.
 */
export function validatePlanDocumentIntegrity(
  segments: RenderedPlanSegment[],
  database: Database,
): void {
  const text = segments.map((segment) => segment.text ?? '').join('')
  const parsed = parsePlanItemSources(text)
  const rows = database
    .query<StoredPlanItem, []>(
      'SELECT id, sprint, block, delegation, title, status, position FROM plan_items ORDER BY position ASC, id ASC',
    )
    .all()
  const segmentItems = segments.filter((segment) => segment.kind === 'item')
  const parsedById = new Map<string, (typeof parsed)[number]>()

  for (const item of parsed) {
    if (parsedById.has(item.id)) throw new Error(`PLAN.md item ${item.id} is duplicated`)
    parsedById.set(item.id, item)
  }
  if (segmentItems.length !== parsed.length)
    throw new Error('PLAN.md item segment count does not match parsed item count')
  for (const segment of segmentItems) {
    if (!segment.item_id) throw new Error('PLAN.md item segment has no item_id')
    const item = parsedById.get(segment.item_id)
    if (!item)
      throw new Error(`PLAN.md segment item_id ${segment.item_id} has no matching item text`)
    const header = (segment.text ?? '').match(/^- \[[ x]\] \*\*([A-Za-z0-9][A-Za-z0-9.'-]*) — /)
    if (!header?.[1] || header[1] !== segment.item_id)
      throw new Error(`PLAN.md segment ${segment.item_id} item_id does not match its text`)
  }

  const rowsById = new Map(rows.map((row) => [row.id, row]))
  for (const item of parsed) {
    const row = rowsById.get(item.id)
    if (!row) throw new Error(`PLAN.md item ${item.id} is missing from plan_items`)
    const expected: Record<string, string | number | null> = {
      status: item.status,
      title: item.title,
      delegation: item.delegation,
      sprint: item.sprint ?? '',
      block: item.block,
      position: item.position,
    }
    for (const [field, value] of Object.entries(expected)) {
      if (row[field as keyof StoredPlanItem] !== value)
        throw new Error(
          `PLAN.md item ${item.id} diverges from plan_items field ${field}: document=${String(value)} DB=${String(row[field as keyof StoredPlanItem])}`,
        )
    }
  }
  for (const row of rows) {
    if (!parsedById.has(row.id)) throw new Error(`plan_items row ${row.id} is missing from PLAN.md`)
  }
}

export function renderPlan(database: Database = db): string {
  const segments = database
    .query<RenderedPlanSegment, string>(
      'SELECT position, kind, text, item_id FROM plan_doc_segments WHERE doc = ? ORDER BY position ASC',
    )
    .all('PLAN.md')
  if (segments.length === 0)
    throw new Error('No PLAN.md segments found; run bun run plan:reconcile')
  for (let index = 0; index < segments.length; index += 1) {
    if (segments[index]?.position !== index)
      throw new Error('PLAN.md segment positions are not contiguous')
    if (segments[index]?.text == null) throw new Error(`PLAN.md segment ${index} has no text`)
  }
  validatePlanDocumentIntegrity(segments, database)
  return segments.map((segment) => segment.text ?? '').join('')
}
