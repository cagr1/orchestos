import { db } from '../../db/sqlite.ts'
import { jsonResponse } from '../http.ts'

type UsageRow = {
  date: string
  model: string
  usd: number | null
  runs: number | null
  inputTokens: number | null
  outputTokens: number | null
}

export async function handleApiUsage(): Promise<Response> {
  try {
    const rows = db
      .query<UsageRow, []>(
        `SELECT strftime('%Y-%m-%d', runs.created_at) AS date, runs.model, SUM(runs.usd_cost) AS usd, COUNT(*) AS runs, SUM(runs.input_tokens) AS inputTokens, SUM(runs.output_tokens) AS outputTokens
       FROM runs
       LEFT JOIN eval_trials ON eval_trials.run_id = runs.id
       WHERE runs.created_at >= datetime('now', '-400 days')
         AND eval_trials.run_id IS NULL
       GROUP BY date, model
       ORDER BY date ASC`,
      )
      .all()

    const byDayModel = rows.map((row) => ({
      date: row.date,
      model: row.model,
      usd: row.usd ?? 0,
      runs: row.runs ?? 0,
      inputTokens: row.inputTokens ?? 0,
      outputTokens: row.outputTokens ?? 0,
    }))

    return jsonResponse({
      byDayModel,
      totalUsd: byDayModel.reduce((total, row) => total + row.usd, 0),
      totalRuns: byDayModel.reduce((total, row) => total + row.runs, 0),
    })
  } catch {
    return jsonResponse({ byDayModel: [], totalUsd: 0, totalRuns: 0 })
  }
}
