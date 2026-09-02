import { db } from './sqlite.ts'

export interface EvalTrialConfig {
  model: string
  engine: string
  skill: string | null
  cli_effort: string | null
}

export interface EvalTrialRecord {
  id: number
  run_id: string
  eval_task_id: string
  trial_index: number
  batch_id: string
  config_json: string
  passed: number
  created_at: string
}

export interface EvalBatchRecord {
  batch_id: string
  config_json: string
  passed_trials: number
  trials: number
  created_at: string
}

export function serializeEvalConfig(config: EvalTrialConfig): string {
  return JSON.stringify(config)
}

export function insertEvalTrial(input: {
  runId: string
  evalTaskId: string
  trialIndex: number
  batchId: string
  config: EvalTrialConfig
  passed: boolean
}): void {
  db.run(
    `INSERT INTO eval_trials
      (run_id, eval_task_id, trial_index, batch_id, config_json, passed, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      input.runId,
      input.evalTaskId,
      input.trialIndex,
      input.batchId,
      serializeEvalConfig(input.config),
      input.passed ? 1 : 0,
      new Date().toISOString(),
    ],
  )
}

export function listEvalBatches(evalTaskId: string): EvalBatchRecord[] {
  return db
    .query<EvalBatchRecord, string>(
      `SELECT batch_id, config_json, SUM(passed) AS passed_trials, COUNT(*) AS trials,
              MAX(created_at) AS created_at
       FROM eval_trials
       WHERE eval_task_id = ?
       GROUP BY batch_id, config_json
       ORDER BY created_at DESC`,
    )
    .all(evalTaskId)
}
