import { describe, expect, test } from 'bun:test'
import { validateEvalTask } from './schema.ts'

function validEval(): Record<string, unknown> {
  return {
    id: 'real-regression',
    description: 'Fix a documented regression',
    executor: 'openrouter',
    input: ['src/input.ts'],
    output: ['src/result.ts'],
    depends_on: [],
    status: 'pending',
    retry_count: 0,
    checks: [{ cmd: 'bun test' }],
    origin: 'docs/done/mes-22.md',
    reference_solution: { 'src/result.ts': 'export const fixed = true\n' },
  }
}

describe('validateEvalTask', () => {
  test('reuses Task fields and preserves the eval-specific contract', () => {
    const task = validateEvalTask(validEval())
    expect(task.id).toBe('real-regression')
    expect(task.executor).toBe('openrouter')
    expect(task.checks).toEqual([{ cmd: 'bun test' }])
    expect(task.reference_solution).toEqual({
      'src/result.ts': 'export const fixed = true\n',
    })
    expect(task.origin).toBe('docs/done/mes-22.md')
  })

  test('rejects a missing or empty reference solution', () => {
    const missing = validEval()
    delete missing.reference_solution
    expect(() => validateEvalTask(missing)).toThrow('reference_solution')

    const empty = validEval()
    empty.reference_solution = {}
    expect(() => validateEvalTask(empty)).toThrow('non-empty')
  })

  test('requires every reference path to be declared in output', () => {
    const raw = validEval()
    raw.reference_solution = { 'src/undeclared.ts': 'content' }
    expect(() => validateEvalTask(raw)).toThrow('must be declared in output')
  })

  test('rejects absolute and escaping reference paths', () => {
    for (const path of ['/tmp/result.ts', '../result.ts', 'src/../../result.ts', 'C:\\result.ts']) {
      const raw = validEval()
      raw.output = [path]
      raw.reference_solution = { [path]: 'content' }
      expect(() => validateEvalTask(raw)).toThrow('must be relative')
    }
  })

  test('requires exact string content for every reference file', () => {
    const raw = validEval()
    raw.reference_solution = { 'src/result.ts': 42 }
    expect(() => validateEvalTask(raw)).toThrow('content must be a string')
  })

  test('fails closed when checks are missing or empty', () => {
    const missing = validEval()
    delete missing.checks
    expect(() => validateEvalTask(missing)).toThrow('without a grader is invalid')

    const empty = validEval()
    empty.checks = []
    expect(() => validateEvalTask(empty)).toThrow('without a grader is invalid')
  })

  test('requires a non-empty origin and still enforces the base Task schema', () => {
    const noOrigin = validEval()
    noOrigin.origin = ' '
    expect(() => validateEvalTask(noOrigin)).toThrow('origin')

    const noOutput = validEval()
    noOutput.output = []
    expect(() => validateEvalTask(noOutput)).toThrow('output')
  })
})
