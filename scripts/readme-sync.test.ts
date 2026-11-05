import { describe, expect, test } from 'bun:test'
import { parseTestRun, renderBlocks, syncReadme } from './readme-sync.ts'

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
    expect(syncReadme(['--check'], () => ({ status: 0, stdout: '', stderr: output }))).toBe(0)
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
