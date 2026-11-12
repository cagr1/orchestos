import { check, z } from './index.ts'

export const BUILTIN_ROLE_AGENTS = ['claude', 'codex', 'opencode', 'api'] as const

export const MIN_TIMEOUT_MS = 60_000
export const MAX_TIMEOUT_MS = 86_400_000
export const MIN_TIMEOUT_MINUTES = 1
export const MAX_TIMEOUT_MINUTES = MAX_TIMEOUT_MS / MIN_TIMEOUT_MS
export const MIN_ITERATIONS = 1
export const MAX_ITERATIONS = 100

export const TimeoutMsSchema = z.number().int().min(MIN_TIMEOUT_MS).max(MAX_TIMEOUT_MS)
export const TimeoutMinutesSchema = z
  .number()
  .int()
  .min(MIN_TIMEOUT_MINUTES)
  .max(MAX_TIMEOUT_MINUTES)
export const MaxIterationsSchema = z.number().int().min(MIN_ITERATIONS).max(MAX_ITERATIONS)

export const TimerMsSchema = z.number().int().min(1).max(2_147_483_647)

export function safeTimeoutMs(value: unknown, fallback: number): number {
  const result = check(TimerMsSchema, value)
  return result.ok ? result.data : fallback
}
