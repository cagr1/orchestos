import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import ts from 'typescript'

export function countMockModule(content: string): number {
  const file = ts.createSourceFile('fixture.ts', content, ts.ScriptTarget.Latest, true)
  let count = 0
  function visit(node: ts.Node): void {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === 'mock' &&
      node.expression.name.text === 'module'
    )
      count++
    ts.forEachChild(node, visit)
  }
  visit(file)
  return count
}

export function compareMockBudget(
  counts: Record<string, number>,
  budget: Record<string, number>,
): { over: string[]; unknown: string[]; under: string[] } {
  const over: string[] = []
  const unknown: string[] = []
  const under: string[] = []
  const paths = new Set([...Object.keys(counts), ...Object.keys(budget)])
  for (const path of [...paths].sort((a, b) => a.localeCompare(b))) {
    const count = counts[path] ?? 0
    const limit = budget[path]
    if (count > 0 && limit === undefined) unknown.push(path)
    else if (limit !== undefined && count > limit) over.push(path)
    else if (limit !== undefined && count < limit) under.push(path)
  }
  return { over, unknown, under }
}

function currentCounts(root: string): Record<string, number> {
  const paths = execFileSync('git', ['ls-files', '*.test.ts', '*.test.tsx'], {
    cwd: root,
    encoding: 'utf8',
  })
    .trim()
    .split('\n')
    .filter(Boolean)
  const counts: Record<string, number> = {}
  for (const path of paths) {
    const count = countMockModule(readFileSync(resolve(root, path), 'utf8'))
    if (count > 0) counts[path] = count
  }
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)))
}

if (import.meta.main) {
  const root = resolve(import.meta.dir, '..')
  const budgetPath = resolve(import.meta.dir, 'mock-module-budget.json')
  const counts = currentCounts(root)
  if (process.argv.includes('--write')) {
    writeFileSync(budgetPath, `${JSON.stringify(counts, null, 2)}\n`)
    process.exit(0)
  }
  const budget = JSON.parse(readFileSync(budgetPath, 'utf8')) as Record<string, number>
  const result = compareMockBudget(counts, budget)
  for (const path of [...result.over, ...result.unknown])
    console.error(
      `✗ ${path}: mock.module() no puede crecer; usar inyección de dependencias o correr el mock en un subproceso bun -e`,
    )
  for (const path of result.under) console.warn(formatUnderBudget(path, counts[path] ?? 0))
  if (result.over.length || result.unknown.length) process.exit(1)
}

export function formatUnderBudget(path: string, count: number): string {
  return `⚠ bajar el presupuesto de ${path} a ${count}`
}
