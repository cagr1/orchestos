import { describe, it, expect } from 'bun:test'
import { buildPrompt } from '../run/prompt.ts'
import type { Task } from '../tasks/schema.ts'

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    description: 'do the thing',
    executor: 'openrouter',
    input: [],
    output: ['out.txt'],
    depends_on: [],
    status: 'pending',
    retry_count: 0,
    ...overrides,
  }
}

describe('buildPrompt — F1.1 retry feedback', () => {
  it('without previousFailure returns the current prompt unchanged', () => {
    const task = makeTask()
    const a = buildPrompt(task, '# context', '/tmp')
    const b = buildPrompt(task, '# context', '/tmp')
    expect(a).toEqual(b)
    expect(a.userContent).not.toContain('PREVIOUS ATTEMPT FAILED')
    expect(a.system).not.toContain('PREVIOUS ATTEMPT FAILED')
  })

  it('appends the PREVIOUS ATTEMPT FAILED block to userContent (not system) when given a reason', () => {
    const task = makeTask()
    const { system, userContent } = buildPrompt(task, '# context', '/tmp', undefined, undefined, undefined, 'spec_violation: missing output foo.txt')

    expect(userContent).toContain('## PREVIOUS ATTEMPT FAILED')
    expect(userContent).toContain('The last attempt at this task failed for this reason:')
    expect(userContent).toContain('spec_violation: missing output foo.txt')
    expect(userContent).toContain('Fix the cause described above. Do not repeat the same mistake.')
    expect(userContent.endsWith('Do not repeat the same mistake.')).toBe(true)
    expect(system).not.toContain('PREVIOUS ATTEMPT FAILED')
  })

  it('truncates a previousFailure longer than 2000 chars to exactly 2000 in the block', () => {
    const long = 'X'.repeat(5000)
    const { userContent } = buildPrompt(makeTask(), '# context', '/tmp', undefined, undefined, undefined, long)

    const marker = 'failed for this reason:\n'
    const idx = userContent.indexOf(marker)
    expect(idx).toBeGreaterThan(-1)
    const tail = userContent.slice(idx + marker.length)
    const reasonInBlock = tail.slice(0, tail.indexOf('\nFix the cause described above.'))
    expect(reasonInBlock.length).toBe(2000)
    expect(reasonInBlock).toBe('X'.repeat(2000))
  })

  it('preserves a previousFailure shorter than 2000 chars verbatim', () => {
    const reason = 'short reason'
    const { userContent } = buildPrompt(makeTask(), '# context', '/tmp', undefined, undefined, undefined, reason)
    expect(userContent).toContain(`failed for this reason:\n${reason}\nFix the cause described above.`)
  })

  it('appends the block at the end of userContent (after task description and inputs)', () => {
    const { userContent } = buildPrompt(
      makeTask({ description: 'MY-TASK-DESC' }),
      '# context',
      '/tmp',
      undefined, undefined, undefined,
      'last fail',
    )
    const descIdx = userContent.indexOf('MY-TASK-DESC')
    const blockIdx = userContent.indexOf('## PREVIOUS ATTEMPT FAILED')
    expect(descIdx).toBeGreaterThan(-1)
    expect(blockIdx).toBeGreaterThan(descIdx)
  })
})
