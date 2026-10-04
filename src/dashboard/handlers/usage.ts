import { catalogModelIdFor } from '../../../scripts/context-budget.ts'
import { listProjects } from '../../db/projects.ts'
import { db } from '../../db/sqlite.ts'
import { knownCostWithCache } from '../../router/pricing.ts'
import { readCliTranscriptUsage } from '../../usage/cli-transcripts.ts'
import { jsonResponse } from '../http.ts'

type UsageRow = {
  date: string
  model: string
  provider: string
  usd: number | null
  runs: number | null
  inputTokens: number | null
  outputTokens: number | null
  cacheReadTokens: number | null
  cacheWriteTokens: number | null
  source: 'orchestos'
}

export async function handleApiUsage(agentHome?: string): Promise<Response> {
  try {
    const projects = listProjects()
    const roots = projects.map((project) => project.path)
    const transcriptRows = await readCliTranscriptUsage(roots, agentHome)
    const usedSessions = new Set(
      db
        .query<{ cli_session_id: string }, []>(
          'SELECT DISTINCT cli_session_id FROM runs WHERE cli_session_id IS NOT NULL',
        )
        .all()
        .map((row) => row.cli_session_id),
    )
    const rows = db
      .query<UsageRow, []>(
        `SELECT strftime('%Y-%m-%d', runs.created_at) AS date, runs.model, runs.provider, SUM(runs.usd_cost) AS usd, COUNT(*) AS runs, SUM(runs.input_tokens) AS inputTokens, SUM(runs.output_tokens) AS outputTokens, SUM(runs.cache_read_tokens) AS cacheReadTokens, SUM(runs.cache_write_tokens) AS cacheWriteTokens, 'orchestos' AS source
       FROM runs
       LEFT JOIN eval_trials ON eval_trials.run_id = runs.id
       WHERE runs.created_at >= datetime('now', '-400 days')
         AND eval_trials.run_id IS NULL
       GROUP BY date, model, provider
       ORDER BY date ASC`,
      )
      .all()

    const orchestosRows = rows.map((row) => ({
      date: row.date,
      model: row.model,
      provider: row.provider,
      usd: row.usd ?? 0,
      runs: row.runs ?? 0,
      inputTokens: row.inputTokens ?? 0,
      outputTokens: row.outputTokens ?? 0,
      cacheReadTokens: row.cacheReadTokens ?? 0,
      cacheWriteTokens: row.cacheWriteTokens ?? 0,
      source: 'orchestos' as const,
    }))

    const cliRows = await Promise.all(
      transcriptRows
        .filter((row) => !usedSessions.has(row.sessionId))
        .map(async (row) => {
          const catalogId = await catalogModelIdFor(row.model)
          const usd = catalogId
            ? knownCostWithCache(catalogId, {
                input: row.inputTokens,
                output: row.outputTokens,
                cacheRead: row.cacheReadTokens,
                cacheWrite: row.cacheWriteTokens,
                cacheWrite1h: row.cacheWrite1hTokens,
              })
            : null
          return {
            date: row.date,
            model: row.model,
            provider: row.provider,
            source: 'cli' as const,
            usd,
            priced: usd !== null,
            runs: 1,
            inputTokens: row.inputTokens,
            outputTokens: row.outputTokens,
            cacheReadTokens: row.cacheReadTokens,
            cacheWriteTokens: row.cacheWriteTokens,
          }
        }),
    )
    const byDayModel = [...orchestosRows.map((row) => ({ ...row, priced: true })), ...cliRows]

    return jsonResponse({
      byDayModel,
      totalUsd: byDayModel.reduce((total, row) => total + (row.usd ?? 0), 0),
      totalRuns: byDayModel.reduce((total, row) => total + row.runs, 0),
      totals: {
        orchestos: {
          usd: orchestosRows.reduce((total, row) => total + row.usd, 0),
          runs: orchestosRows.reduce((total, row) => total + row.runs, 0),
          tokens: orchestosRows.reduce(
            (total, row) =>
              total +
              row.inputTokens +
              row.outputTokens +
              row.cacheReadTokens +
              row.cacheWriteTokens,
            0,
          ),
        },
        cli: {
          usd: cliRows.reduce((total, row) => total + (row.usd ?? 0), 0),
          sessions: new Set(
            transcriptRows
              .filter((row) => !usedSessions.has(row.sessionId))
              .map((row) => row.sessionId),
          ).size,
          tokens: cliRows.reduce(
            (total, row) =>
              total +
              row.inputTokens +
              row.outputTokens +
              row.cacheReadTokens +
              row.cacheWriteTokens,
            0,
          ),
          unpricedSessions: cliRows.filter((row) => !row.priced).length,
        },
      },
    })
  } catch {
    return jsonResponse({ byDayModel: [], totalUsd: 0, totalRuns: 0 })
  }
}
