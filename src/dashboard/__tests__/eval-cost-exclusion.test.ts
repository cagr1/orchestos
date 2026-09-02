import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { randomUUID } from 'node:crypto'
import { db } from '../../db/sqlite.ts'
import { handleApiHealth } from '../handlers/setup.ts'
import { handleApiUsage } from '../handlers/usage.ts'

const suffix = randomUUID()
const controlRunId = `cost-control-${suffix}`
const evalRunId = `cost-eval-${suffix}`
const controlModel = `control-${suffix}`
const evalModel = `eval-${suffix}`
const now = new Date().toISOString()

function insertFixtureRun(id: string, model: string, cost: number): void {
  db.run(
    `INSERT INTO runs
      (id, prompt, task_class, model, provider, status, input_tokens, output_tokens, usd_cost, elapsed_ms, created_at)
     VALUES (?, 'fixture', 'test', ?, 'fixture', 'done', 10, 5, ?, 1, ?)`,
    [id, model, cost, now],
  )
}

describe('dashboard cost queries exclude eval trials', () => {
  beforeAll(() => {
    insertFixtureRun(controlRunId, controlModel, 1.25)
    insertFixtureRun(evalRunId, evalModel, 99)
    db.run(
      `INSERT INTO eval_trials
        (run_id, eval_task_id, trial_index, batch_id, config_json, passed, created_at)
       VALUES (?, 'fixture-eval', 1, ?, '{}', 1, ?)`,
      [evalRunId, `batch-${suffix}`, now],
    )
  })

  afterAll(() => {
    db.run('DELETE FROM eval_trials WHERE run_id = ?', [evalRunId])
    db.run('DELETE FROM runs WHERE id IN (?, ?)', [controlRunId, evalRunId])
  })

  test('GET /api/usage includes ordinary runs and excludes eval runs', async () => {
    const response = await handleApiUsage()
    const body = (await response.json()) as {
      byDayModel: Array<{ model: string; usd: number; runs: number }>
    }

    expect(body.byDayModel.find((row) => row.model === controlModel)).toMatchObject({
      usd: 1.25,
      runs: 1,
    })
    expect(body.byDayModel.some((row) => row.model === evalModel)).toBe(false)
  })

  test('GET /api/health costLast7d uses the same non-eval total', async () => {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const expected =
      db
        .query<{ total: number }, string>(
          `SELECT COALESCE(SUM(runs.usd_cost), 0) AS total
         FROM runs
         LEFT JOIN eval_trials ON eval_trials.run_id = runs.id
         WHERE runs.created_at >= ? AND eval_trials.run_id IS NULL`,
        )
        .get(cutoff)?.total ?? 0

    const response = handleApiHealth(process.cwd())
    const body = (await response.json()) as { costLast7d: number }
    expect(body.costLast7d).toBe(expected)
  })
})
