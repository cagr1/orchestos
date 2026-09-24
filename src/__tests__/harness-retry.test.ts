import { describe, expect, it } from 'bun:test'
import { buildPrompt, previousFailureForTask } from '../run/prompt.ts'
import type { Task } from '../tasks/schema.ts'

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'retry-test',
    description: 'rewrite the file',
    executor: 'openrouter',
    input: [],
    output: ['out.txt'],
    depends_on: [],
    status: 'pending',
    retry_count: 0,
    ...overrides,
  }
}

describe('runTask — F1.3 retry prompt', () => {
  it('includes the previous failure in user content when retry_count > 0', () => {
    const task = makeTask({
      retry_count: 1,
      retry_reason: 'previous run failed: missing output out.txt',
    })
    const previousFailure = previousFailureForTask(task)
    const { system, userContent } = buildPrompt(
      task,
      '',
      '/tmp',
      undefined,
      undefined,
      undefined,
      previousFailure,
    )

    expect(userContent).toContain('## PREVIOUS ATTEMPT FAILED')
    expect(userContent).toContain('previous run failed: missing output out.txt')
    expect(userContent).toContain('Fix the cause described above. Do not repeat the same mistake.')
    expect(system).not.toContain('PREVIOUS ATTEMPT FAILED')
  })

  it('omits the previous failure block when retry_count is 0', () => {
    const task = makeTask({ retry_count: 0 })
    const previousFailure = previousFailureForTask(task)
    const { userContent } = buildPrompt(
      task,
      '',
      '/tmp',
      undefined,
      undefined,
      undefined,
      previousFailure,
    )

    expect(userContent).not.toContain('PREVIOUS ATTEMPT FAILED')
  })
})
