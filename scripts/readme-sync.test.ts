import { describe, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { KNOWN_CLIS } from '../src/run/executors/cli-registry.ts'
import { parseTestRun, renderBlocks, syncReadme } from './readme-sync.ts'

function withReadmeFixture(readme: string, run: (path: string) => void) {
  const directory = mkdtempSync(join(tmpdir(), 'readme-sync-'))
  const path = join(directory, 'README.md')
  writeFileSync(path, readme)
  try {
    run(path)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

describe('parseTestRun', () => {
  test('parses a green run', () => {
    expect(parseTestRun('Ran 2289 tests across 51 files.\n0 fail')).toEqual({
      tests: 2289,
      fail: 0,
    })
  })
  test('parses failures', () => {
    expect(parseTestRun('Ran 10 tests across 2 files.\n2 fail')).toEqual({ tests: 10, fail: 2 })
  })
  test('rejects output without the summary line', () => {
    expect(() => parseTestRun('0 fail')).toThrow('No se encontró')
  })
  test('parses a summary written only to stderr', () => {
    const output = '\n2295 pass\n0 fail\nRan 2295 tests across 244 files.\n'
    expect(parseTestRun(output)).toEqual({ tests: 2295, fail: 0 })
  })
})

describe('syncReadme', () => {
  const output = '0 fail\nRan 2295 tests across 244 files.\n'
  const coverage = () => ({ status: 0, stdout: output, stderr: '' })
  const cliLabels = `${KNOWN_CLIS.map((cli) => cli.label).join(', ')}, …`
  const matchingReadme =
    `<!-- readme-sync:clis -->${cliLabels}<!-- /readme-sync:clis -->\n` +
    '<!-- readme-sync:tests -->2295 tests · 0 failures · coverage gate in CI<!-- /readme-sync:tests -->\n'
  const differingReadme =
    '<!-- readme-sync:clis -->old<!-- /readme-sync:clis -->\n' +
    '<!-- readme-sync:tests -->old tests<!-- /readme-sync:tests -->\n'

  test('--check returns 0 when the fixture matches', () => {
    withReadmeFixture(matchingReadme, (path) => {
      expect(syncReadme(['--check'], coverage, path)).toBe(0)
    })
  })

  test('--check returns 1 when the fixture differs without writing', () => {
    withReadmeFixture(differingReadme, (path) => {
      expect(syncReadme(['--check'], coverage, path)).toBe(1)
      expect(readFileSync(path, 'utf8')).toBe(differingReadme)
    })
  })

  test('writes the new values to the fixture without flags', () => {
    withReadmeFixture(differingReadme, (path) => {
      expect(syncReadme([], coverage, path)).toBe(0)
      expect(readFileSync(path, 'utf8')).toBe(matchingReadme)
    })
  })
})

describe('renderBlocks', () => {
  const input =
    'A<!-- readme-sync:clis -->old<!-- /readme-sync:clis -->B<!-- readme-sync:tests -->old tests<!-- /readme-sync:tests -->C'
  const values = { clis: 'new', tests: 'new tests' }
  test('replaces only marked text and preserves the rest', () => {
    expect(renderBlocks(input, values)).toBe(
      'A<!-- readme-sync:clis -->new<!-- /readme-sync:clis -->B<!-- readme-sync:tests -->new tests<!-- /readme-sync:tests -->C',
    )
  })
  test('rejects missing or malformed blocks', () => {
    expect(() => renderBlocks('A', values)).toThrow('ausente o mal cerrado')
  })
  test('is idempotent', () => {
    expect(renderBlocks(renderBlocks(input, values), values)).toBe(renderBlocks(input, values))
  })
})
