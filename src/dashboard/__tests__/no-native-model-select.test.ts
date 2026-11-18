import { expect, it } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

function stringLiterals(node: ts.Node): string[] {
  const values: string[] = []
  function visit(current: ts.Node): void {
    if (ts.isStringLiteral(current) || ts.isNoSubstitutionTemplateLiteral(current)) {
      values.push(current.text)
    }
    ts.forEachChild(current, visit)
  }
  visit(node)
  return values
}

function jsxLabelText(label: ts.JsxElement): string[] {
  const values: string[] = []
  function visit(node: ts.Node): void {
    if (ts.isJsxText(node)) values.push(node.text)
    else if (ts.isJsxExpression(node) && node.expression)
      values.push(...stringLiterals(node.expression))
    else if (ts.isJsxElement(node)) node.children.forEach(visit)
    else if (ts.isJsxSelfClosingElement(node)) return
    else ts.forEachChild(node, visit)
  }
  label.children.forEach(visit)
  return values
}

export function findNativeModelSelects(source: string, fileName = 'fixture.tsx'): string[] {
  const file = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  )
  const violations: string[] = []

  function visit(node: ts.Node): void {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      if (node.tagName.getText(file) === 'select') {
        const attributes = node.attributes.properties
        const namedValues = attributes.flatMap((attribute) => {
          if (
            !ts.isJsxAttribute(attribute) ||
            !attribute.name ||
            !['aria-label', 'id', 'name'].includes(attribute.name.getText(file))
          )
            return []
          const initializer = attribute.initializer
          if (!initializer) return []
          return ts.isStringLiteral(initializer) || ts.isNoSubstitutionTemplateLiteral(initializer)
            ? [initializer.text]
            : stringLiterals(initializer)
        })
        let label: ts.Node | undefined = node.parent
        while (
          label &&
          !(ts.isJsxElement(label) && label.openingElement.tagName.getText(file) === 'label')
        ) {
          label = label.parent
        }
        const labelValues = label && ts.isJsxElement(label) ? jsxLabelText(label) : []
        if ([...namedValues, ...labelValues].some((value) => /model|modelo/i.test(value))) {
          violations.push(node.getText(file))
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  return violations
}

function tsxFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory()
      ? tsxFiles(path)
      : entry.isFile() && path.endsWith('.tsx')
        ? [path]
        : []
  })
}

const appRoot = fileURLToPath(new URL('../app/src/', import.meta.url))

it('finds native model selects in literal attributes, expressions, and labels', () => {
  expect(findNativeModelSelects('<select aria-label="Default model">')).toHaveLength(1)
  expect(findNativeModelSelects('<label>Modelo<select/></label>')).toHaveLength(1)
  expect(findNativeModelSelects("<select aria-label={es ? 'Modelo' : 'Model'}>")).toHaveLength(1)
  expect(findNativeModelSelects('<select aria-label="Base branch">')).toHaveLength(0)
})

it('keeps native model selects out of the dashboard app', () => {
  const violations = tsxFiles(appRoot).flatMap((path) =>
    findNativeModelSelects(readFileSync(path, 'utf8'), relative(appRoot, path)),
  )
  expect(violations, 'lista de modelos con <select> nativo: usar el selector con búsqueda').toEqual(
    [],
  )
})
