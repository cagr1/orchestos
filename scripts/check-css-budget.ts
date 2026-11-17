import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { compareMockBudget, formatUnderBudget } from './check-mock-module.ts'

export function countCssLines(content: string): number {
  return content.replace(/\n$/, '').split('\n').length
}

function currentCounts(root: string): Record<string, number> {
  const paths = execFileSync('git', ['ls-files', '*.css'], { cwd: root, encoding: 'utf8' })
    .trim()
    .split('\n')
    .filter(Boolean)
  return Object.fromEntries(
    paths
      .map((path) => [path, countCssLines(readFileSync(resolve(root, path), 'utf8'))] as const)
      .sort(([a], [b]) => a.localeCompare(b)),
  )
}

if (import.meta.main) {
  const root = resolve(import.meta.dir, '..')
  const budgetPath = resolve(import.meta.dir, 'css-budget.json')
  const counts = currentCounts(root)
  if (process.argv.includes('--write')) {
    writeFileSync(budgetPath, `${JSON.stringify(counts, null, 2)}\n`)
    process.exit(0)
  }
  const budget = JSON.parse(readFileSync(budgetPath, 'utf8')) as Record<string, number>
  const result = compareMockBudget(counts, budget)
  for (const path of [...result.over, ...result.unknown])
    console.error(
      `✗ ${path}: el CSS no crece; copiar el className del prototipo (Tailwind) en vez de sumar reglas`,
    )
  for (const path of result.under) console.warn(formatUnderBudget(path, counts[path] ?? 0))
  if (result.over.length || result.unknown.length) process.exit(1)
}
