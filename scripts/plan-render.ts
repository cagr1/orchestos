import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { runMigrations } from '../src/db/migrate.ts'
import { renderPlan } from '../src/db/plan-doc.ts'

export { renderPlan } from '../src/db/plan-doc.ts'

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
