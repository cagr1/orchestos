import { readFile } from 'node:fs/promises'
import { dirname, extname, resolve } from 'node:path'
import { Glob } from 'bun'

const IMPORT_RE =
  /(?:import\s*(?:[^'";]*?\sfrom\s*)?|export\s+[^'";]*?\sfrom\s*|import\s*\()(['"])(\.\.?\/[^'"\n]+)\1/g

async function files(root: string, pattern: string): Promise<string[]> {
  const result: string[] = []
  for await (const path of new Glob(pattern).scan({ cwd: root, onlyFiles: true })) result.push(path)
  return result.sort()
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
      const source = await readFile(resolve(root, current), 'utf8')
      for (const match of source.matchAll(IMPORT_RE)) {
        if (!match[2]) continue
        const imported = await resolveImport(root, current, match[2])
        if (imported) pending.push(imported)
      }
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
  const mutated: string[] = []
  for (const pattern of config.mutate ?? []) mutated.push(...(await files(root, pattern)))
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
