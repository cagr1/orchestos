import { readFile } from 'node:fs/promises'
import { dirname, extname, resolve } from 'node:path'
import { Glob } from 'bun'
import ts from 'typescript'

const transpilers = {
  ts: new Bun.Transpiler({ loader: 'ts' }),
  tsx: new Bun.Transpiler({ loader: 'tsx' }),
}

function runtimeImports(file: string, source: string): string[] {
  // Bun erases both `import type` and inline type-only specifiers. Parsing also
  // avoids treating comments and source snippets in test fixtures as imports.
  const transpiler = transpilers[file.endsWith('.tsx') ? 'tsx' : 'ts']
  const imports = new Set(
    transpiler.scanImports(source.replace(/^#![^\n]*/, '')).map(({ path }) => path),
  )
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest)
  let computed = false
  const candidates: string[] = []
  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node) || ts.isTypeNode(node)) return
    if (ts.isStringLiteralLike(node) && /^\.\.?\//.test(node.text)) candidates.push(node.text)
    if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) && node.expression.text === 'require')) &&
      node.arguments[0] &&
      !ts.isStringLiteralLike(node.arguments[0])
    )
      computed = true
    ts.forEachChild(node, visit)
  }
  visit(ast)
  // Lazy registries pass local paths to require(module). Keep their possible
  // targets conservatively; scanImports alone cannot see those runtime edges.
  if (computed) for (const path of candidates) imports.add(path)
  return [...imports].filter((path) => /^\.\.?\//.test(path))
}

async function files(root: string, pattern: string): Promise<string[]> {
  const result: string[] = []
  for await (const path of new Glob(pattern).scan({ cwd: root, onlyFiles: true })) result.push(path)
  return result.sort()
}

export async function mutationFiles(root: string, patterns: string[]): Promise<string[]> {
  const result = new Set<string>()
  for (const rawPattern of patterns) {
    const pattern = rawPattern.replace(/^(!?)(.*?):\d+-\d+$/, '$1$2')
    if (pattern.startsWith('!')) {
      for (const path of await files(root, pattern.slice(1))) result.delete(path)
    } else {
      for (const path of await files(root, pattern)) result.add(path)
    }
  }
  return [...result].sort()
}

async function resolveImport(
  root: string,
  from: string,
  specifier: string,
): Promise<string | null> {
  const base = resolve(root, dirname(from), specifier)
  const candidates = extname(base)
    ? [base]
    : [`${base}.ts`, `${base}.tsx`, resolve(base, 'index.ts')]
  for (const candidate of candidates) {
    try {
      const relative = candidate.slice(root.length + 1)
      await readFile(candidate)
      return relative
    } catch {}
  }
  return null
}

export async function selectMutationShardTests(
  root: string,
  mutatedFiles: string[],
): Promise<string[]> {
  const tests = await files(root, 'src/__tests__/**/*.test.ts')
  const mutated = new Set(mutatedFiles.map((path) => path.replaceAll('\\', '/')))
  const selected: string[] = []
  const graph = new Map<string, string[]>()

  for (const test of tests) {
    const visited = new Set<string>()
    const pending = [test]
    let reachesMutation = false
    while (pending.length && !reachesMutation) {
      const current = pending.pop() as string
      if (visited.has(current)) continue
      visited.add(current)
      if (mutated.has(current)) {
        reachesMutation = true
        break
      }
      if (!/\.[cm]?[jt]sx?$/.test(current)) continue
      let dependencies = graph.get(current)
      if (!dependencies) {
        dependencies = []
        const source = await readFile(resolve(root, current), 'utf8')
        for (const specifier of runtimeImports(current, source)) {
          const imported = await resolveImport(root, current, specifier)
          if (imported) dependencies.push(imported)
        }
        graph.set(current, dependencies)
      }
      pending.push(...dependencies)
    }
    if (reachesMutation) selected.push(test)
  }
  return selected
}

export function mutationTestArgs(selected: string[]): string[] {
  return ['bun', 'test', ...selected, '--timeout', '30000', '--bail']
}

async function main() {
  const configPath = process.argv[2]
  if (!configPath) throw new Error('Uso: bun run scripts/mutation-test-shard.ts <stryker-config>')
  const root = process.cwd()
  const config = (await import(resolve(root, configPath))).default
  const mutated = await mutationFiles(root, config.mutate ?? [])
  const selected = await selectMutationShardTests(root, mutated)
  const total = (await files(root, 'src/__tests__/**/*.test.ts')).length
  if (selected.length === 0) {
    console.error(`mutation-test-shard: selección vacía (${total} test files)`)
    process.exitCode = 1
    return
  }
  console.error(`mutation-test-shard: ${selected.length}/${total} test files`)
  const proc = Bun.spawn(mutationTestArgs(selected), {
    stdout: 'inherit',
    stderr: 'inherit',
    stdin: 'inherit',
  })
  process.exitCode = await proc.exited
}

if (import.meta.main) await main()
