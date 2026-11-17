import { expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import ts from 'typescript'

function findAutoModeChanges(source: string): string[] {
  const file = ts.createSourceFile(
    'fixture.tsx',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  )
  const changes: string[] = []
  const effectNames = new Set(['useEffect', 'useLayoutEffect'])

  function visit(node: ts.Node, inEffect: boolean): void {
    if (
      inEffect &&
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'setMode' &&
      node.arguments[0] &&
      !(ts.isStringLiteral(node.arguments[0]) && node.arguments[0].text === 'chat')
    ) {
      changes.push(node.getText(file))
    }
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      effectNames.has(node.expression.text)
    ) {
      const callback = node.arguments[0]
      if (callback && (ts.isArrowFunction(callback) || ts.isFunctionExpression(callback))) {
        visit(callback, true)
        for (const argument of node.arguments.slice(1)) visit(argument, inEffect)
        return
      }
    }
    ts.forEachChild(node, (child) => visit(child, inEffect))
  }
  visit(file, false)
  return changes
}

const appPath = new URL('../app/src/App.tsx', import.meta.url)
const appSource = readFileSync(appPath, 'utf8')

it('finds automatic non-Chat mode changes in effects, including nested callbacks', () => {
  expect(findAutoModeChanges("useEffect(() => { if (x) setMode('settings') })")).toHaveLength(1)
  expect(findAutoModeChanges("useEffect(() => { foo.then(() => setMode('dev')) })")).toHaveLength(1)
  expect(findAutoModeChanges("useEffect(() => { setMode('chat') })")).toHaveLength(0)
  expect(findAutoModeChanges("button.onClick(() => setMode('dev'))")).toHaveLength(0)
})

it('keeps the real dashboard home in Chat', () => {
  const file = ts.createSourceFile(
    'App.tsx',
    appSource,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  )
  const modeState = (function find(node: ts.Node): ts.VariableDeclaration | undefined {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isArrayBindingPattern(node.name) &&
      node.name.elements[1] &&
      !ts.isOmittedExpression(node.name.elements[1]) &&
      ts.isIdentifier(node.name.elements[1].name) &&
      node.name.elements[1].name.text === 'setMode' &&
      node.initializer &&
      ts.isCallExpression(node.initializer) &&
      ts.isIdentifier(node.initializer.expression) &&
      node.initializer.expression.text === 'useState' &&
      node.initializer.typeArguments?.[0]?.getText(file) === 'AppMode'
    )
      return node
    return ts.forEachChild(node, find)
  })(file)
  expect(
    findAutoModeChanges(appSource),
    'el dashboard abre siempre en Chat; no cambiar de modo sin acción del usuario',
  ).toEqual([])
  const initialMode = modeState?.initializer
  const initialArgument =
    initialMode && ts.isCallExpression(initialMode) ? initialMode.arguments[0] : undefined
  expect(
    initialArgument && ts.isStringLiteral(initialArgument) ? initialArgument.text : undefined,
  ).toBe('chat')
})
