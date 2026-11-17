import { expect, it } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import ts from 'typescript'

export function findMaxOutputTokensCallers(source: string, fileName = 'fixture.ts'): string[] {
  const file = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  const references: string[] = []
  function visit(node: ts.Node): void {
    if (
      ts.isIdentifier(node) &&
      node.text === 'maxOutputTokensFor' &&
      !(
        fileName.endsWith('src/router/model-catalog.ts') &&
        ts.isFunctionDeclaration(node.parent) &&
        node.parent.name === node
      )
    ) {
      references.push(node.getText(file))
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  return references
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(path)
    return entry.isFile() && path.endsWith('.ts') ? [path] : []
  })
}

const srcRoot = new URL('../', import.meta.url).pathname

it('finds calls and aliases but ignores comments', () => {
  expect(findMaxOutputTokensCallers("maxOutputTokensFor('x')")).toHaveLength(1)
  expect(
    findMaxOutputTokensCallers("import { maxOutputTokensFor as limit } from './catalog'"),
  ).toHaveLength(1)
  expect(findMaxOutputTokensCallers('const limit = maxOutputTokensFor')).toHaveLength(1)
  expect(findMaxOutputTokensCallers("// maxOutputTokensFor('x')")).toHaveLength(0)
})

it('keeps maxOutputTokensFor out of production call sites', () => {
  const callers = sourceFiles(srcRoot).flatMap((path) =>
    findMaxOutputTokensCallers(readFileSync(path, 'utf8'), path),
  )
  expect(
    callers,
    'max_tokens sale de contextWindow − prompt; maxOutputTokensFor no lo alimenta',
  ).toEqual([])
})
