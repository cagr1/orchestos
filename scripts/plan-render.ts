import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { runMigrations } from '../src/db/migrate.ts'
import { db } from '../src/db/sqlite.ts'

export interface RenderedPlanSegment {
  position: number
  kind: string
  text: string | null
  item_id: string | null
}

export function renderPlan(database = db): string {
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

function firstDivergentLine(actual: string, expected: string): number {
  const actualLines = actual.split('\n')
  const expectedLines = expected.split('\n')
  const length = Math.max(actualLines.length, expectedLines.length)
  for (let index = 0; index < length; index += 1) {
    if (actualLines[index] !== expectedLines[index]) return index + 1
  }
  return length
}

function checkPlan(sourcePath: string): number {
  const rendered = renderPlan()
  const onDisk = readFileSync(sourcePath, 'utf-8')
  if (rendered === onDisk) return 0
  const line = firstDivergentLine(rendered, onDisk)
  const renderedLine = rendered.split('\n')[line - 1] ?? '<EOF>'
  const diskLine = onDisk.split('\n')[line - 1] ?? '<EOF>'
  console.error(`✗ PLAN.md differs at line ${line}`)
  console.error(`  render(DB): ${JSON.stringify(renderedLine)}`)
  console.error(`  disk:       ${JSON.stringify(diskLine)}`)
  return 1
}

if (import.meta.main) {
  runMigrations()
  const check = Bun.argv.includes('--check')
  if (check) {
    process.exit(checkPlan(process.env.PLAN_RENDER_SOURCE ?? join(process.cwd(), 'PLAN.md')))
  }
  process.stdout.write(renderPlan())
}
