import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { KNOWN_CLIS } from '../src/run/executors/cli-registry.ts'

export type TestRun = { tests: number; fail: number }
export type ReadmeValues = { clis: string; tests: string }

export function parseTestRun(output: string): TestRun {
  const ran = output.match(/^Ran (\d+) tests? across \d+ files?\./m)
  if (!ran) throw new Error('No se encontró la línea "Ran N tests across M files." en la salida.')
  const failures = [...output.matchAll(/^\s*(\d+) fail(?:ures?)?\b/gim)]
  return { tests: Number(ran[1]), fail: failures.reduce((sum, match) => sum + Number(match[1]), 0) }
}

export function renderBlocks(readme: string, values: ReadmeValues): string {
  let result = readme
  for (const [name, value] of Object.entries(values)) {
    const open = `<!-- readme-sync:${name} -->`
    const close = `<!-- /readme-sync:${name} -->`
    const start = result.indexOf(open)
    const end = result.indexOf(close)
    if (
      start < 0 ||
      end < 0 ||
      end < start + open.length ||
      result.indexOf(open, start + open.length) >= 0 ||
      result.indexOf(close, end + close.length) >= 0
    ) {
      throw new Error(`Bloque readme-sync:${name} ausente o mal cerrado.`)
    }
    result = `${result.slice(0, start + open.length)}${value}${result.slice(end)}`
  }
  return result
}

export type CoverageRunner = () => { status: number | null; stdout: string; stderr: string }

export function syncReadme(
  args: string[],
  runCoverage: CoverageRunner = () => {
    const result = spawnSync('bun', ['run', 'test:coverage'], { encoding: 'utf8' })
    return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' }
  },
  readmePath = 'README.md',
): number {
  const check = args.includes('--check')
  const fromLogIndex = args.indexOf('--from-log')
  if (
    args.some(
      (arg) => arg !== '--check' && arg !== '--from-log' && args.indexOf(arg) !== fromLogIndex + 1,
    ) ||
    (fromLogIndex >= 0 && !args[fromLogIndex + 1])
  ) {
    console.error('Uso: readme:sync [--check] [--from-log <archivo>]')
    return 1
  }
  try {
    const coverage =
      fromLogIndex >= 0
        ? { status: 0, stdout: readFileSync(args[fromLogIndex + 1]!, 'utf8'), stderr: '' }
        : runCoverage()
    const output = `${coverage.stdout}\n${coverage.stderr}`
    const parsed = parseTestRun(output)
    if (parsed.fail > 0)
      throw new Error(`test:coverage reportó ${parsed.fail} fallos; README no actualizado.`)
    if (coverage.status !== 0)
      throw new Error(
        `test:coverage terminó con estado ${coverage.status}: ${coverage.stderr.trim()}`,
      )
    const readme = readFileSync(readmePath, 'utf8')
    const next = renderBlocks(readme, {
      clis: `${KNOWN_CLIS.map((cli) => cli.label).join(', ')}, …`,
      tests: `${parsed.tests} tests · 0 failures · coverage gate in CI`,
    })
    if (next === readme) return 0
    if (check) {
      console.error('README.md necesita actualizarse (readme:sync --check).')
      return 1
    }
    writeFileSync(readmePath, next)
    return 0
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    return 1
  }
}

if (import.meta.main) process.exit(syncReadme(process.argv.slice(2)))
