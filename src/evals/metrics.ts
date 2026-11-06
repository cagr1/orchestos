export interface EvalMetrics {
  trials: number
  passedTrials: number
  passPowerK: boolean
  passAtK: boolean
}

export function calculateEvalMetrics(passed: readonly boolean[]): EvalMetrics {
  if (passed.length === 0) throw new Error('eval metrics require at least one trial')
  const passedTrials = passed.filter(Boolean).length
  return {
    trials: passed.length,
    passedTrials,
    passPowerK: passedTrials === passed.length,
    passAtK: passedTrials > 0,
  }
}
