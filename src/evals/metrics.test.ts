import { describe, expect, test } from 'bun:test'
import { calculateEvalMetrics } from './metrics.ts'

describe('calculateEvalMetrics', () => {
  test('pass^k and pass@k are true when every trial passes', () => {
    expect(calculateEvalMetrics([true, true, true])).toEqual({
      trials: 3,
      passedTrials: 3,
      passPowerK: true,
      passAtK: true,
    })
  })

  test('one failure makes pass^k false while pass@k remains true', () => {
    expect(calculateEvalMetrics([true, false, true])).toEqual({
      trials: 3,
      passedTrials: 2,
      passPowerK: false,
      passAtK: true,
    })
  })

  test('all failures make both metrics false', () => {
    expect(calculateEvalMetrics([false, false])).toEqual({
      trials: 2,
      passedTrials: 0,
      passPowerK: false,
      passAtK: false,
    })
  })

  test('rejects an empty batch instead of reporting a vacuous pass^k', () => {
    expect(() => calculateEvalMetrics([])).toThrow('at least one trial')
  })
})
