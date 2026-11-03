import ts from 'typescript'
import { runCommand } from './agent-governance.ts'

function git(root: string, args: string[]): string {
  const result = runCommand(['git', ...args], root)
  if (result.exitCode !== 0) throw new Error(result.stderr.trim())
  return result.stdout
}

function addedLines(diff: string): Map<number, string> {
  const added = new Map<number, string>()
  let lineNumber = 0
  for (const line of diff.split('\n')) {
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line)
    if (hunk) lineNumber = Number(hunk[1])
    else if (line.startsWith('+') && !line.startsWith('+++')) {
      added.set(lineNumber++, line.slice(1))
    } else if (line.startsWith(' ')) lineNumber++
  }
  return added
}

function visibleText(source: string, path: string, added: Map<number, string>) {
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const found: { text: string; path: string; line: number }[] = []
  function record(value: string, position: number) {
    let offset = position
    for (const part of value.split('\n')) {
      const line = file.getLineAndCharacterOfPosition(offset).line + 1
      const text = part.trim()
      if (added.has(line) && /\p{L}/u.test(text.replace(/&(?:#\d+|#x[\da-f]+|\w+);/gi, ''))) {
        found.push({ text, path, line })
      }
      offset += part.length + 1
    }
  }
  function visit(node: ts.Node) {
    if (ts.isJsxText(node)) record(node.text, node.pos)
    if (
      ts.isJsxAttribute(node) &&
      ['title', 'placeholder', 'alt'].includes(node.name.getText(file)) &&
      node.initializer &&
      ts.isStringLiteral(node.initializer)
    ) {
      record(node.initializer.text, node.initializer.getStart(file) + 1)
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  return found
}

export function main(root = process.cwd()): number {
  try {
    const paths = git(root, ['diff', '--cached', '--name-only', '-z', '--diff-filter=ACMR'])
      .split('\0')
      .filter(
        (path) => /^src\/dashboard\/app\/src\/.*\.tsx$/.test(path) && !path.endsWith('.test.tsx'),
      )
    const texts = paths.flatMap((path) =>
      visibleText(
        git(root, ['show', `:${path}`]),
        path,
        addedLines(git(root, ['diff', '--cached', '--no-ext-diff', '--unified=0', '--', path])),
      ),
    )
    if (texts.length === 0) {
      console.log('✓ Texto visible: no aplica')
      return 0
    }
    const declarations = [
      ...addedLines(git(root, ['diff', '--cached', '--unified=0', '--', 'PLAN.md'])).values(),
    ]
      .map((line) => line.trimStart())
      .filter((line) => line.startsWith('Texto visible:'))
    const missing = texts.filter(
      ({ text }) => !declarations.some((line) => line.toLowerCase().includes(text.toLowerCase())),
    )
    if (missing.length > 0) {
      console.error('✗ Texto visible nuevo sin declarar:')
      for (const { text, path, line } of missing) console.error(`  ${path}:${line}: ${text}`)
      console.error(
        '  Declararlo en Texto visible: del ítem con por qué no basta un ícono, o borrarlo.',
      )
      return 1
    }
    console.log('✓ Texto visible declarado en PLAN.md')
    return 0
  } catch (error) {
    console.error(String(error))
    return 1
  }
}

if (import.meta.main) process.exit(main())
