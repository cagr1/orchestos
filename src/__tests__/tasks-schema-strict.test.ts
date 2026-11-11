import { describe, expect, it } from 'bun:test'
import { validateTask, validateTasksFile } from '../tasks/schema.ts'

const base = { id: 'a', description: 'd', output: ['x.ts'] }

describe('strict task schema validation', () => {
  it('rejects non-string output entries', () => {
    expect(() => validateTask({ ...base, output: [123] }, 0)).toThrow('output[0]')
  })

  it('rejects empty output entries', () => {
    expect(() => validateTask({ ...base, output: ['ok', ''] }, 0)).toThrow('output[1]')
  })

  it('rejects null input entries', () => {
    expect(() => validateTask({ ...base, input: [null] }, 0)).toThrow('input[0]')
  })

  it('rejects non-string dependencies', () => {
    expect(() => validateTask({ ...base, depends_on: [1] }, 0)).toThrow('depends_on[0]')
  })

  it('treats null input and dependencies as omitted', () => {
    const task = validateTask({ ...base, input: null, depends_on: null }, 0)
    expect(task.input).toEqual([])
    expect(task.depends_on).toEqual([])
  })

  it('defaults undeclared input and dependencies to empty arrays', () => {
    const task = validateTask(base, 0)
    expect(task.input).toEqual([])
    expect(task.depends_on).toEqual([])
  })

  it('rejects unknown status values', () => {
    expect(() => validateTask({ ...base, status: 'banana' }, 0)).toThrow('unknown status')
  })

  it('accepts a known status', () => {
    expect(validateTask({ ...base, status: 'done' }, 0).status).toBe('done')
  })

  it('defaults missing status to pending', () => {
    expect(validateTask(base, 0).status).toBe('pending')
  })

  it('rejects unknown QA verdicts', () => {
    expect(() => validateTask({ ...base, qa_verdict: 'maybe' }, 0)).toThrow('unknown qa_verdict')
  })

  it('accepts a known QA verdict', () => {
    expect(validateTask({ ...base, qa_verdict: 'pass' }, 0).qa_verdict).toBe('pass')
  })

  it('treats null QA verdict as undefined', () => {
    expect(validateTask({ ...base, qa_verdict: null }, 0).qa_verdict).toBeUndefined()
  })

  it('rejects NaN timeout values', () => {
    expect(() =>
      validateTask({ ...base, checks: [{ cmd: 'bun test', timeout_ms: NaN }] }, 0),
    ).toThrow('timeout_ms')
  })

  it('rejects infinite timeout values', () => {
    expect(() =>
      validateTask({ ...base, checks: [{ cmd: 'bun test', timeout_ms: Infinity }] }, 0),
    ).toThrow('timeout_ms')
  })

  it('rejects zero timeout values', () => {
    expect(() =>
      validateTask({ ...base, checks: [{ cmd: 'bun test', timeout_ms: 0 }] }, 0),
    ).toThrow('timeout_ms')
  })

  it('rejects negative timeout values', () => {
    expect(() =>
      validateTask({ ...base, checks: [{ cmd: 'bun test', timeout_ms: -5 }] }, 0),
    ).toThrow('timeout_ms')
  })

  it('rejects fractional timeout values', () => {
    expect(() =>
      validateTask({ ...base, checks: [{ cmd: 'bun test', timeout_ms: 1.5 }] }, 0),
    ).toThrow('timeout_ms')
  })

  it('rejects negative expected exit values', () => {
    expect(() =>
      validateTask({ ...base, checks: [{ cmd: 'bun test', expect_exit: -1 }] }, 0),
    ).toThrow('expect_exit')
  })

  it('accepts expected exit zero', () => {
    expect(
      validateTask({ ...base, checks: [{ cmd: 'bun test', expect_exit: 0 }] }, 0).checks?.[0]
        ?.expect_exit,
    ).toBe(0)
  })

  it('rejects a null tasks file root', () => {
    expect(() => validateTasksFile(null)).toThrow('root must be a mapping')
  })

  it('rejects an array tasks file root', () => {
    expect(() => validateTasksFile([])).toThrow('root must be a mapping')
  })

  it('rejects a string tasks file root', () => {
    expect(() => validateTasksFile('x')).toThrow('root must be a mapping')
  })
})
