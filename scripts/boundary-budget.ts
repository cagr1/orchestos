import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { Glob } from 'bun'
import * as ts from 'typescript'
import { compareBudget } from './lint-budget'

type Category = 'json-parse' | 'response-json' | 'yaml-parse'
type Counts = Record<string, number>

const categories: Category[] = ['json-parse', 'response-json', 'yaml-parse']

function isExcluded(path: string): boolean {
  return (
    path.startsWith('src/boundary/') ||
    path.includes('/__tests__/') ||
    path.startsWith('src/__tests__/') ||
    /\.test\.ts$/.test(path) ||
    path.startsWith('src/dashboard/app/')
  )
}

function unparenthesize(expression: ts.Expression): ts.Expression {
  let current = expression
  while (ts.isParenthesizedExpression(current)) current = current.expression
  return current
}

function yamlBindings(source: ts.SourceFile): { direct: Set<string>; modules: Set<string> } {
  const direct = new Set<string>()
  const modules = new Set<string>()
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier))
      continue
    if (statement.moduleSpecifier.text !== 'yaml' || !statement.importClause) continue
    const clause = statement.importClause
    if (clause.name) modules.add(clause.name.text)
    const bindings = clause.namedBindings
    if (bindings && ts.isNamespaceImport(bindings)) modules.add(bindings.name.text)
    if (!bindings || !ts.isNamedImports(bindings)) continue
    for (const element of bindings.elements) {
      const imported = (element.propertyName ?? element.name).text
      if (['parse', 'parseDocument', 'parseAllDocuments'].includes(imported)) {
        direct.add(element.name.text)
      }
    }
  }
  return { direct, modules }
}

export function countBoundarySites(files: Array<{ path: string; text: string }>): Counts {
  const counts: Counts = { 'json-parse': 0, 'response-json': 0, 'yaml-parse': 0 }
  for (const file of files) {
    if (isExcluded(file.path)) continue
    const kind = file.path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
    const source = ts.createSourceFile(file.path, file.text, ts.ScriptTarget.Latest, true, kind)
    const { direct, modules } = yamlBindings(source)

    function visit(node: ts.Node): void {
      if (ts.isCallExpression(node)) {
        const expression = unparenthesize(node.expression)
        if (ts.isPropertyAccessExpression(expression)) {
          const object = unparenthesize(expression.expression)
          if (
            ts.isIdentifier(object) &&
            object.text === 'JSON' &&
            expression.name.text === 'parse'
          ) {
            counts['json-parse'] = (counts['json-parse'] ?? 0) + 1
          }
          if (expression.name.text === 'json' && node.arguments.length === 0) {
            counts['response-json'] = (counts['response-json'] ?? 0) + 1
          }
          if (
            modules.has(object.getText(source)) &&
            ['parse', 'parseDocument', 'parseAllDocuments'].includes(expression.name.text)
          ) {
            counts['yaml-parse'] = (counts['yaml-parse'] ?? 0) + 1
          }
        } else if (ts.isElementAccessExpression(expression)) {
          const object = unparenthesize(expression.expression)
          const argument = expression.argumentExpression
          if (
            ts.isIdentifier(object) &&
            object.text === 'JSON' &&
            argument &&
            ((ts.isStringLiteral(argument) && argument.text === 'parse') ||
              (ts.isNoSubstitutionTemplateLiteral(argument) && argument.text === 'parse'))
          ) {
            counts['json-parse'] = (counts['json-parse'] ?? 0) + 1
          }
        } else if (ts.isIdentifier(expression) && direct.has(expression.text)) {
          counts['yaml-parse'] = (counts['yaml-parse'] ?? 0) + 1
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
  }
  return counts
}

async function main(): Promise<void> {
  const root = resolve(import.meta.dir, '..')
  const files: Array<{ path: string; text: string }> = []
  for await (const path of new Glob('src/**/*.{ts,tsx,mts,cts}').scan({
    cwd: root,
    onlyFiles: true,
  })) {
    files.push({ path, text: await readFile(resolve(root, path), 'utf8') })
  }

  const counts = countBoundarySites(files)
  let budget: Counts
  try {
    budget = JSON.parse(
      await Bun.file(resolve(root, 'scripts/boundary-budget.json')).text(),
    ) as Counts
  } catch {
    console.error('boundary-budget: no se pudo leer scripts/boundary-budget.json')
    process.exit(1)
  }

  const comparison = compareBudget(counts, budget)
  for (const category of comparison.over) {
    console.log(
      `✗ boundary-budget: ${category} ${counts[category] ?? 0} > ${budget[category] ?? 'sin tope'} — valida con src/boundary (Zod) en vez de parsear a mano`,
    )
  }
  for (const category of comparison.under) {
    console.log(
      `↓ boundary-budget: ${category} ${counts[category] ?? 0} < ${budget[category] ?? 0} — baja el tope en scripts/boundary-budget.json`,
    )
  }
  if (comparison.over.length > 0) process.exit(1)
  if (comparison.under.length === 0) {
    console.log(
      `✓ boundary-budget: ${categories.reduce((total, category) => total + (counts[category] ?? 0), 0)} sitios, ningún presupuesto sube`,
    )
  }
}

if (import.meta.main) main()
