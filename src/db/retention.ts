import { db } from './sqlite.ts'

export interface RetentionPolicy {
  runStepsDays: number
  chatTaskBarEventsDays: number
}

export const DEFAULT_RETENTION_POLICY: RetentionPolicy = {
  runStepsDays: 30,
  chatTaskBarEventsDays: 30,
}

export interface RetentionPreview {
  runSteps: number
  chatTaskBarEvents: number
  before: string
}

export interface RetentionPurgeResult extends RetentionPreview {}

function cutoff(now: Date, days: number): string {
  if (!Number.isInteger(days) || days < 0)
    throw new Error('retention days must be a non-negative integer')
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString()
}

function buildCutoffs(
  now: Date,
  policy: RetentionPolicy,
): { runSteps: string; chatTaskBarEvents: string } {
  return {
    runSteps: cutoff(now, policy.runStepsDays),
    chatTaskBarEvents: cutoff(now, policy.chatTaskBarEventsDays),
  }
}

export function previewEphemeralData(
  now = new Date(),
  policy: RetentionPolicy = DEFAULT_RETENTION_POLICY,
): RetentionPreview {
  const cutoffs = buildCutoffs(now, policy)
  return {
    runSteps:
      db
        .query<{ count: number }, string>(
          'SELECT COUNT(*) AS count FROM run_steps WHERE created_at < ?',
        )
        .get(cutoffs.runSteps)?.count ?? 0,
    chatTaskBarEvents:
      db
        .query<{ count: number }, string>(
          'SELECT COUNT(*) AS count FROM chat_task_bar_events WHERE created_at < ?',
        )
        .get(cutoffs.chatTaskBarEvents)?.count ?? 0,
    before: [cutoffs.runSteps, cutoffs.chatTaskBarEvents].sort()[0]!,
  }
}

/** Explicit caller action; never invoked automatically at startup. */
export function purgeEphemeralData(
  now = new Date(),
  policy: RetentionPolicy = DEFAULT_RETENTION_POLICY,
): RetentionPurgeResult {
  const cutoffs = buildCutoffs(now, policy)
  const purge = db.transaction(() => {
    const runSteps = db.run('DELETE FROM run_steps WHERE created_at < ?', [
      cutoffs.runSteps,
    ]).changes
    const chatTaskBarEvents = db.run('DELETE FROM chat_task_bar_events WHERE created_at < ?', [
      cutoffs.chatTaskBarEvents,
    ]).changes
    return { runSteps, chatTaskBarEvents }
  })
  const deleted = purge()
  return { ...deleted, before: [cutoffs.runSteps, cutoffs.chatTaskBarEvents].sort()[0]! }
}
