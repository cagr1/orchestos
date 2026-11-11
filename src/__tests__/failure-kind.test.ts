import { describe, expect, it } from 'bun:test'
import { failureKindLabels } from '../dashboard/app/src/lib/failureKind.ts'
import { RUN_FAILURE_KINDS } from '../db/runs.ts'
import { CliFailure } from '../run/executors/cli-failure.ts'
import { providerFailureKind } from '../run/failure-kind.ts'

describe('AUD.4 failure kinds', () => {
  it('preserves typed CLI failures and classifies generic errors', () => {
    expect(providerFailureKind(new CliFailure({ kind: 'quota', message: 'limit' }))).toBe('quota')
    expect(providerFailureKind(new Error('429 Too Many Requests'))).toBe('rate-limit')
    expect(providerFailureKind(new CliFailure({ kind: 'retrying', message: 'retry' }))).toBe(
      'unknown',
    )
  })
  it('provides a label for every persisted kind', () => {
    for (const kind of RUN_FAILURE_KINDS) expect(failureKindLabels[kind].length).toBeGreaterThan(0)
  })
})
