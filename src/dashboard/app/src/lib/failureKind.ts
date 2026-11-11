import type { RunFailureKind } from '../../../../db/runs'

export const failureKindLabels = {
  'parse': 'Unreadable reply',
  'contract': 'Contract violation',
  'output_missing': 'Missing output',
  'check': 'Check failed',
  'qa': 'QA failed',
  'unexpected': 'Internal error',
  'quota': 'Usage limit',
  'rate-limit': 'Rate limit',
  'auth': 'Sign-in failed',
  'network': 'Network error',
  'overloaded': 'Provider overloaded',
  'invalid-model': 'Invalid model',
  'no-response': 'No response',
  'process-exit': 'CLI exited',
  'timeout': 'Timed out',
  'unknown': 'Provider error',
} satisfies Record<RunFailureKind, string>
