import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { parse } from 'yaml'
import {
  mutationFiles,
  mutationTestArgs,
  runWithMemoryCap,
  selectMutationShardTests,
} from './mutation-test-shard.ts'

describe('selectMutationShardTests', () => {
  for (const [parent, children] of [
    [
      'executors',
      [
        'executors-engines',
        'executors-engines-b',
        'executors-routing',
        'executors-routing-b',
        'executors-routing-c',
        'executors-routing-d',
      ],
    ],
    [
      'executors-codex',
      [
        'executors-codex-server',
        'executors-codex-server-b',
        'executors-codex-server-c',
        'executors-codex-server-d',
        'executors-codex-server-e',
        'executors-codex-engines',
        'executors-codex-engines-b',
      ],
    ],
    ['runtime-boundaries', ['runtime-boundaries-sandbox', 'runtime-boundaries-checks']],
  ] as const) {
    test(`las particiones de ${parent} conservan todos los archivos y gates sin solaparse`, async () => {
      const root = resolve(import.meta.dir, '..')
      const base = (await import(join(root, `stryker.run-${parent}.config.mjs`))).default
      const workflow = parse(
        await Bun.file(join(root, '.github/workflows/mutation-nightly.yml')).text(),
      )
      const commands = workflow.jobs.mutation.strategy.matrix.include.map(
        (entry: { command: string }) => entry.command,
      )
      const pkg = await Bun.file(join(root, 'package.json')).json()
      const original = await mutationFiles(root, base.mutate)
      const partitioned: string[] = []
      for (const child of children) {
        const config = (await import(join(root, `stryker.run-${child}.config.mjs`))).default
        expect(commands).toContain(`mutation:run:${child}`)
        expect(pkg.scripts[`mutation:run:${child}`]).toBe(
          `stryker run stryker.run-${child}.config.mjs`,
        )
        expect(config.commandRunner.command).toBe(
          `bun run scripts/mutation-test-shard.ts stryker.run-${child}.config.mjs`,
        )
        const { commandRunner: _command, mutate: _mutate, ...gates } = config
        const { commandRunner: _baseCommand, mutate: _baseMutate, ...baseGates } = base
        expect(gates).toEqual(baseGates)
        const files = await mutationFiles(root, config.mutate)
        expect(files.length).toBeGreaterThan(0)
        partitioned.push(...files)
      }
      expect([...new Set(partitioned)].sort()).toEqual(original)
      const duplicates = partitioned.filter((path, index) => partitioned.indexOf(path) !== index)
      // codex-app-server.ts se reparte por rangos de líneas en 5 shards: 4 repeticiones.
      expect(duplicates).toEqual(
        parent === 'executors-codex' ? Array(4).fill('src/run/executors/codex-app-server.ts') : [],
      )
    })
  }

  test('los rangos de codex-app-server.ts cubren el archivo sin huecos ni solapes', async () => {
    const root = resolve(import.meta.dir, '..')
    const ranges: number[][] = []
    for (const shard of ['', '-b', '-c', '-d', '-e']) {
      const file = join(root, `stryker.run-executors-codex-server${shard}.config.mjs`)
      for (const pattern of (await import(file)).default.mutate as string[]) {
        const match = /^src\/run\/executors\/codex-app-server\.ts:(\d+)-(\d+)$/.exec(pattern)
        if (match) ranges.push([Number(match[1]), Number(match[2])])
      }
    }
    ranges.sort((a, b) => a[0]! - b[0]!)
    expect(ranges.map(([start]) => start)).toEqual([
      1,
      ...ranges.slice(0, -1).map(([, end]) => end! + 1),
    ])
    const source = await Bun.file(join(root, 'src/run/executors/codex-app-server.ts')).text()
    expect(ranges.at(-1)![1]).toBeGreaterThanOrEqual(source.split('\n').length)
  })

  test('mutation test args include --bail', () => {
    expect(mutationTestArgs(['src/__tests__/example.test.ts'])).toContain('--bail')
  })

  test('mata y reporta un proceso que supera el tope de memoria', async () => {
    const result = await runWithMemoryCap(['bun', '-e', 'setInterval(()=>{},1000)'], {
      capKb: 1,
      intervalMs: 20,
      readRss: async () => 5,
    })
    expect(result).toBe(1)
  }, 5000)

  test('devuelve el código de salida normal cuando no supera el tope', async () => {
    const result = await runWithMemoryCap(['bun', '-e', 'process.exit(3)'], {
      capKb: 10,
      readRss: async () => 1,
    })
    expect(result).toBe(3)
  })

  test('mutationFiles resta archivos incluidos menos los patrones negados', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mutation-glob-'))
    try {
      await mkdir(join(root, 'src/run/executors'), { recursive: true })
      await writeFile(join(root, 'src/run/executors/local.ts'), '')
      await writeFile(join(root, 'src/run/executors/codex.ts'), '')
      await writeFile(join(root, 'src/run/executors/external.ts'), '')
      expect(
        await mutationFiles(root, [
          'src/run/executors/**/*.ts',
          '!src/run/executors/codex*.ts',
          '!src/run/executors/external.ts',
        ]),
      ).toEqual(['src/run/executors/local.ts'])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test('mutationFiles quita los rangos de línea de patrones incluidos y negados', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mutation-range-'))
    try {
      await mkdir(root, { recursive: true })
      await writeFile(join(root, 'x.ts'), '')
      expect(await mutationFiles(root, ['x.ts:1-10'])).toEqual(['x.ts'])
      expect(await mutationFiles(root, ['x.ts:1-10', '!x.ts:1-10'])).toEqual([])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test('mutationFiles procesa negaciones en orden y permite reincluir archivos', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mutation-glob-order-'))
    try {
      await mkdir(join(root, 'src/run/executors'), { recursive: true })
      await writeFile(join(root, 'src/run/executors/local.ts'), '')
      await writeFile(join(root, 'src/run/executors/codex.ts'), '')
      expect(
        await mutationFiles(root, [
          'src/run/executors/**/*.ts',
          '!src/run/executors/codex.ts',
          'src/run/executors/codex.ts',
        ]),
      ).toEqual(['src/run/executors/codex.ts', 'src/run/executors/local.ts'])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test('selector de shard incluye imports directos y transitivos, omite los que no alcanzan archivos mutados', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mutation-shard-'))
    try {
      await mkdir(join(root, 'src/__tests__'), { recursive: true })
      await mkdir(join(root, 'src/lib'), { recursive: true })
      await writeFile(join(root, 'src/__tests__/direct.test.ts'), "import '../lib/target.ts'\n")
      await writeFile(join(root, 'src/__tests__/transitive.test.ts'), "import '../lib/bridge.ts'\n")
      await writeFile(join(root, 'src/__tests__/unrelated.test.ts'), "import '../lib/other.ts'\n")
      await writeFile(join(root, 'src/lib/bridge.ts'), "export { value } from './target.ts'\n")
      await writeFile(join(root, 'src/lib/target.ts'), 'export const value = 1\n')
      await writeFile(join(root, 'src/lib/other.ts'), 'export const other = 1\n')
      expect(await selectMutationShardTests(root, ['src/lib/target.ts'])).toEqual([
        'src/__tests__/direct.test.ts',
        'src/__tests__/transitive.test.ts',
      ])
      expect(await selectMutationShardTests(root, ['src/no-match.ts'])).toEqual([])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test('sigue aristas runtime de Bun y no tipos, comentarios ni snippets', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mutation-runtime-'))
    const cases: [string, string, boolean][] = [
      ['type-import', "import type { Value } from '../lib/target.ts'", false],
      ['inline-type-import', "import { type Value } from '../lib/target.ts'", false],
      ['type-export', "export type { Value } from '../lib/target.ts'", false],
      ['inline-type-export', "export { type Value } from '../lib/target.ts'", false],
      ['type-star-export', "export type * from '../lib/target.ts'", false],
      ['mixed-import', "import { type Value, value } from '../lib/target.ts'", true],
      ['mixed-export', "export { type Value, value } from '../lib/target.ts'", true],
      ['side-effect', "import '../lib/target.ts'", true],
      ['empty-import', "import {} from '../lib/target.ts'", true],
      ['star-export', "export * from '../lib/target.ts'", true],
      ['dynamic', "const mod = import('../lib/target.ts')", true],
      ['require', "const mod = require('../lib/target.ts')", true],
      ['template-import', 'const mod = import(`../lib/target.ts`)', true],
      ['computed-require', "const path = '../lib/target.ts'; const mod = require(path)", true],
      ['computed-import', "const path = '../lib/target.ts'; const mod = import(path)", true],
      [
        'computed-type-only',
        "import type { Value } from '../lib/target.ts'; const path = '../lib/other.ts'; require(path)",
        false,
      ],
      ['line-comment', "// import '../lib/target.ts'", false],
      ['block-comment', "/* export * from '../lib/target.ts' */", false],
      ['snippet', 'const fixture = "import \'../lib/target.ts\'"', false],
      ['template-snippet', "const fixture = `export * from '../lib/target.ts'`", false],
      ['shebang', "#!/usr/bin/env bun\nimport '../lib/target.ts'", true],
    ]
    try {
      await mkdir(join(root, 'src/__tests__'), { recursive: true })
      await mkdir(join(root, 'src/lib'), { recursive: true })
      await writeFile(join(root, 'src/lib/target.ts'), 'export const value = 1')
      await writeFile(join(root, 'src/lib/other.ts'), 'export const other = 1')
      for (const [name, source] of cases)
        await writeFile(join(root, `src/__tests__/${name}.test.ts`), source)
      expect(await selectMutationShardTests(root, ['src/lib/target.ts'])).toEqual(
        cases
          .filter(([, , runtime]) => runtime)
          .map(([name]) => `src/__tests__/${name}.test.ts`)
          .sort(),
      )
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test('un puente de tipos corta la transitividad; preserva ciclos runtime, TSX y registros lazy', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mutation-bridges-'))
    try {
      await mkdir(join(root, 'src/__tests__'), { recursive: true })
      await mkdir(join(root, 'src/lib'), { recursive: true })
      const sources: Record<string, string> = {
        'src/__tests__/types.test.ts': "import '../lib/types.ts'",
        'src/__tests__/runtime.test.ts': "import '../lib/runtime.tsx'",
        'src/__tests__/lazy.test.ts': "import '../lib/registry.ts'",
        'src/lib/types.ts': "export type { Value } from './target.ts'",
        'src/lib/runtime.tsx':
          "import './cycle.ts'; import data from './data.json'; const el = <div />",
        'src/lib/cycle.ts': "import './runtime.tsx'; export * from './target.ts'",
        'src/lib/registry.ts':
          "function lazy(module: string) { return () => require(module) }; lazy('./target.ts')",
        'src/lib/data.json': '{"note": "import fake from ./missing.ts"}',
        'src/lib/target.ts': 'export const value = 1',
      }
      for (const [file, source] of Object.entries(sources))
        await writeFile(join(root, file), source)
      expect(await selectMutationShardTests(root, ['src/lib/target.ts'])).toEqual([
        'src/__tests__/lazy.test.ts',
        'src/__tests__/runtime.test.ts',
      ])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
