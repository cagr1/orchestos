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
    const rows = db.query<UsageRow, []>(
      `SELECT strftime('%Y-%m-%d', created_at) AS date, model, SUM(usd_cost) AS usd, COUNT(*) AS runs, SUM(input_tokens) AS inputTokens, SUM(output_tokens) AS outputTokens
       FROM runs
       WHERE created_at >= datetime('now', '-400 days')
       GROUP BY date, model
       ORDER BY date ASC`
    ).all()

    const byDayModel = rows.map(row => ({
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
