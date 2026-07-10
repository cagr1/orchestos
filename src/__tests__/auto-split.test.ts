/**
 * Mes 20 B.1 — shouldSplit() unit tests
 *
 * Verifica la función pura sin llamar al LLM ni gastar dinero.
 * Constantes: SPLIT_AVG_TOKENS_PER_FILE=2048, SPLIT_THRESHOLD=0.7
 */
import { describe, it, expect } from 'bun:test'
import { shouldSplit, SPLIT_AVG_TOKENS_PER_FILE, SPLIT_THRESHOLD } from '../run/harness.ts'
import type { Task } from '../tasks/schema.ts'

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'test-task',
    description: 'Test',
    status: 'pending',
    executor: 'openrouter',
    depends_on: [],
    output: [],
    input: [],
    retry_count: 0,
    ...overrides,
  } as Task
}

describe('shouldSplit', () => {
  const budget8k = 8192
  const budget16k = 16384
  const budget128k = 131072

  it('returns false when task has no output files', () => {
    const task = makeTask({ output: [], topic_key: 'some-key' } as any)
    expect(shouldSplit(task, budget8k)).toBe(false)
  })

  it('returns false for external engine regardless of output count', () => {
    const task = makeTask({ output: ['a.ts', 'b.ts', 'c.ts', 'd.ts', 'e.ts'], engine: 'external' })
    expect(shouldSplit(task, budget8k)).toBe(false)
  })

  it('returns false for 1 file against any reasonable budget', () => {
    // 1 × 2048 = 2048 < 8192 × 0.7 = 5734
    expect(shouldSplit(makeTask({ output: ['a.ts'] }), budget8k)).toBe(false)
    expect(shouldSplit(makeTask({ output: ['a.ts'] }), budget16k)).toBe(false)
    expect(shouldSplit(makeTask({ output: ['a.ts'] }), budget128k)).toBe(false)
  })

  it('returns true for 3 files against 8K budget', () => {
    // 3 × 2048 = 6144 > 8192 × 0.7 = 5734
    expect(shouldSplit(makeTask({ output: ['a.ts', 'b.ts', 'c.ts'] }), budget8k)).toBe(true)
  })

  it('returns false for 3 files against 16K budget', () => {
    // 3 × 2048 = 6144 < 16384 × 0.7 = 11468
    expect(shouldSplit(makeTask({ output: ['a.ts', 'b.ts', 'c.ts'] }), budget16k)).toBe(false)
  })

  it('returns true for 6 files against 16K budget', () => {
    // 6 × 2048 = 12288 > 16384 × 0.7 = 11468
    const files = Array.from({ length: 6 }, (_, i) => `f${i}.ts`)
    expect(shouldSplit(makeTask({ output: files }), budget16k)).toBe(true)
  })

  it('returns true for 20 files (crypto dashboard) against tight budgets, false against 128K', () => {
    // 20 × 2048 = 40960
    // vs 8K × 0.7 = 5734   → split
    // vs 16K × 0.7 = 11468  → split
    // vs 128K × 0.7 = 91750 → no split (40960 < 91750 — cabe con modelo grande)
    const files = Array.from({ length: 20 }, (_, i) => `src/component${i}.tsx`)
    expect(shouldSplit(makeTask({ output: files }), budget8k)).toBe(true)
    expect(shouldSplit(makeTask({ output: files }), budget16k)).toBe(true)
    expect(shouldSplit(makeTask({ output: files }), budget128k)).toBe(false)
  })

  it('threshold boundary: exactly at SPLIT_THRESHOLD is false, one file over is true', () => {
    // Find N where N × AVG just crosses THRESHOLD × budget
    // N = ceil(THRESHOLD × budget / AVG)
    const budget = 10000
    const crossover = Math.ceil((SPLIT_THRESHOLD * budget) / SPLIT_AVG_TOKENS_PER_FILE)
    const below = Array.from({ length: crossover - 1 }, (_, i) => `f${i}.ts`)
    const above = Array.from({ length: crossover }, (_, i) => `f${i}.ts`)
    expect(shouldSplit(makeTask({ output: below }), budget)).toBe(false)
    expect(shouldSplit(makeTask({ output: above }), budget)).toBe(true)
  })
})
