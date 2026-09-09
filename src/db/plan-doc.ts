import type { Database } from 'bun:sqlite'
import { db } from './sqlite.ts'

export interface RenderedPlanSegment {
  position: number
  kind: string
  text: string | null
  item_id: string | null
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
  return segments.map((segment) => segment.text ?? '').join('')
}
