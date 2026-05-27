import { describe, it, expect } from 'bun:test'
import { needsClarify, clarifyReason } from '../spec/clarify.ts'
import type { Task } from '../tasks/schema.ts'

function task(description: string, input: string[] = []): Task {
  return {
    id: 'test',
    description,
    status: 'pending',
    executor: 'openrouter',
    input,
    output: [],
    depends_on: [],
    retry_count: 0,
  }
}

describe('needsClarify', () => {
  it('flags "optimize" without input files', () => {
    expect(needsClarify(task('optimize the database queries'))).toBe(true)
  })

  it('flags "improve" without input files', () => {
    expect(needsClarify(task('improve the performance of the app'))).toBe(true)
  })

  it('flags "refactor" without input files', () => {
    expect(needsClarify(task('refactor the auth module'))).toBe(true)
  })

  it('flags Spanish verb "optimiza"', () => {
    expect(needsClarify(task('optimiza el rendimiento del servidor'))).toBe(true)
  })

  it('does NOT flag when input files are provided', () => {
    expect(needsClarify(task('refactor the service', ['src/service.ts']))).toBe(false)
  })

  it('does NOT flag specific implementation tasks', () => {
    expect(needsClarify(task('add email validation to the registration form'))).toBe(false)
  })

  it('does NOT flag fix tasks', () => {
    expect(needsClarify(task('fix the login bug in src/auth.ts'))).toBe(false)
  })

  it('does NOT flag doc tasks', () => {
    expect(needsClarify(task('document the authentication flow'))).toBe(false)
  })
})

describe('clarifyReason', () => {
  it('returns a reason mentioning the matched verb', () => {
    const reason = clarifyReason(task('optimize the queries'))
    expect(reason.toLowerCase()).toContain('optimize')
  })

  it('returns a fallback when no specific verb matched', () => {
    const reason = clarifyReason(task('do something vague'))
    expect(reason).toBeTruthy()
    expect(reason.length).toBeGreaterThan(0)
  })
})
