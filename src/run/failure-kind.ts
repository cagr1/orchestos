import type { RunFailureKind } from '../db/runs.ts'
import { CliFailure, classifyCliFailure } from './executors/cli-failure.ts'

export function providerFailureKind(error: Error): RunFailureKind {
  const kind = error instanceof CliFailure ? error.notice.kind : classifyCliFailure(error.message)
  return kind === 'retrying' ? 'unknown' : kind
}
