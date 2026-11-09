import { resolve } from 'node:path'

type Budget = Record<string, number>

export function compareBudget(counts: Budget, budget: Budget): { over: string[]; under: string[] } {
  const over: string[] = []
  const under: string[] = []

  for (const category of new Set([...Object.keys(counts), ...Object.keys(budget)])) {
    const actual = counts[category] ?? 0
    const limit = budget[category]
    if (limit === undefined || actual > limit) over.push(category)
    else if (actual < limit) under.push(category)
  }

  return { over: over.sort(), under: under.sort() }
}

async function main(): Promise<void> {
  const root = resolve(import.meta.dir, '..')
  const result = Bun.spawnSync(['bunx', 'biome', 'lint', '--reporter=json', '.'], {
    cwd: root,
    env: process.env,
  })

  let report: { diagnostics?: Array<{ category?: string; severity?: string }> }
  try {
    report = JSON.parse(result.stdout.toString()) as typeof report
  } catch {
    console.error('lint-budget: no se pudo parsear el JSON de Biome')
    process.exit(1)
  }
  if (!Array.isArray(report.diagnostics)) {
    console.error('lint-budget: la salida JSON de Biome no contiene diagnostics')
    process.exit(1)
  }

  const counts: Budget = {}
  for (const diagnostic of report.diagnostics) {
    if (diagnostic.severity !== 'warning' || typeof diagnostic.category !== 'string') continue
    counts[diagnostic.category] = (counts[diagnostic.category] ?? 0) + 1
  }

  let budget: Budget
  try {
    budget = JSON.parse(await Bun.file(resolve(root, 'scripts/lint-budget.json')).text()) as Budget
  } catch {
    console.error('lint-budget: no se pudo leer scripts/lint-budget.json')
    process.exit(1)
  }

  const comparison = compareBudget(counts, budget)
  for (const category of comparison.over) {
    console.log(
      `✗ lint-budget: ${category} ${counts[category] ?? 0} > ${budget[category] ?? 'sin tope'}`,
    )
  }
  for (const category of comparison.under) {
    console.log(
      `↓ lint-budget: ${category} ${counts[category] ?? 0} < ${budget[category]} — baja el tope en scripts/lint-budget.json`,
    )
  }
  if (comparison.over.length > 0) process.exit(1)
  if (comparison.under.length === 0) {
    const total = Object.values(counts).reduce((sum, count) => sum + count, 0)
    console.log(`✓ lint-budget: ${total} avisos, ninguna regla sube`)
  }
}

if (import.meta.main) main()
