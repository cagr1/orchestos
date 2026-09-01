export interface CheckSummary {
  exitCode: number
  timedOut: boolean
  pass?: boolean
}

export function countFailedChecks(checks: CheckSummary[]): number {
  return checks.filter((check) => !check.pass).length
}
