import { describe, expect, test } from 'bun:test'
import { resolveTaskRunProjectId } from './tasks.ts'

describe('dashboard task run project binding', () => {
  test('uses the request-selected project id instead of re-resolving by path', () => {
    expect(resolveTaskRunProjectId('/path-that-is-not-registered', 'request-project')).toBe(
      'request-project',
    )
  })
})
