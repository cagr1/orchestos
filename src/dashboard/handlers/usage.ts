import { catalogModelIdFor } from '../../../scripts/context-budget.ts'
import { listProjects } from '../../db/projects.ts'
import { db } from '../../db/sqlite.ts'
import { knownCostWithCache } from '../../router/pricing.ts'
import { readCliTranscriptUsage } from '../../usage/cli-transcripts.ts'
import type { UsageRow as DayUsageRow, UsageHourRow } from '../app/src/api/settings.ts'
import { jsonResponse } from '../http.ts'

type UsageRow = {
  date: string
  hour: string
  activeMs: number | null
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

export function agentOf(provider: string, _source: 'orchestos' | 'cli'): string {
  switch (provider) {
    case 'claude':
    case 'claude-plain':
      return 'Claude Code'
    case 'codex':
    case 'role:codex':
      return 'Codex'
    case 'opencode':
      return 'OpenCode'
    case 'openrouter':
      return 'OpenRouter'
    default:
      return provider
  }
}

function addUsage(target: DayUsageRow, row: DayUsageRow): void {
  target.runs += row.runs
  target.inputTokens += row.inputTokens
  target.outputTokens += row.outputTokens
  target.cacheReadTokens = (target.cacheReadTokens ?? 0) + (row.cacheReadTokens ?? 0)
  target.cacheWriteTokens = (target.cacheWriteTokens ?? 0) + (row.cacheWriteTokens ?? 0)
  target.usd = target.usd === null || row.usd === null ? null : target.usd + row.usd
  target.priced = target.priced && row.priced
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
        `SELECT strftime('%Y-%m-%d', runs.created_at, 'localtime') AS date, strftime('%H', runs.created_at, 'localtime') AS hour, SUM(runs.elapsed_ms) AS activeMs, runs.model, runs.provider, SUM(runs.usd_cost) AS usd, COUNT(*) AS runs, SUM(runs.input_tokens) AS inputTokens, SUM(runs.output_tokens) AS outputTokens, SUM(runs.cache_read_tokens) AS cacheReadTokens, SUM(runs.cache_write_tokens) AS cacheWriteTokens, 'orchestos' AS source
       FROM runs
       LEFT JOIN eval_trials ON eval_trials.run_id = runs.id
       WHERE runs.created_at >= datetime('now', '-400 days')
         AND eval_trials.run_id IS NULL
         AND runs.provider != 'fixture'
       GROUP BY date, hour, model, provider
       ORDER BY date ASC, hour ASC`,
      )
      .all()

    const orchestosHours: UsageHourRow[] = rows.map((row) => ({
      date: row.date,
      hour: Number(row.hour),
      agent: agentOf(row.provider, 'orchestos'),
      turns: row.runs ?? 0,
      activeMs: row.activeMs ?? 0,
      priced: true,
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

    const countedSessionDays = new Set<string>()
    const cliHours = new Map<string, UsageHourRow>()
    const cliRowsWithCost = await Promise.all(
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
            hour: row.hour,
            agent: agentOf(row.provider, 'cli'),
            turns: row.turns,
            activeMs: row.activeMs,
            sessionId: row.sessionId,
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
    for (const { sessionId, ...row } of cliRowsWithCost.sort((a, b) => a.hour - b.hour)) {
      const sessionDay = `${row.date}\u0000${row.provider}\u0000${sessionId}`
      row.runs = countedSessionDays.has(sessionDay) ? 0 : 1
      countedSessionDays.add(sessionDay)
      const key = `${row.date}\u0000${row.hour}\u0000${row.provider}\u0000${row.model}`
      const current = cliHours.get(key)
      if (!current) cliHours.set(key, row)
      else {
        addUsage(current, row)
        current.turns += row.turns
        current.activeMs += row.activeMs
      }
    }
    const byHour = [...orchestosHours, ...cliHours.values()]
    const days = new Map<string, DayUsageRow>()
    for (const {
      hour: _hour,
      agent: _agent,
      turns: _turns,
      activeMs: _activeMs,
      ...row
    } of byHour) {
      const key = `${row.date}\u0000${row.provider}\u0000${row.model}\u0000${row.source}`
      const current = days.get(key)
      if (!current) days.set(key, { ...row })
      else addUsage(current, row)
    }
    const byDayModel = [...days.values()]
    const orchestosRows = byDayModel.filter((row) => row.source === 'orchestos')
    const cliRows = byDayModel.filter((row) => row.source === 'cli')

    return jsonResponse({
      byDayModel,
      byHour,
      totalUsd: byDayModel.reduce((total, row) => total + (row.usd ?? 0), 0),
      totalRuns: byDayModel.reduce((total, row) => total + row.runs, 0),
      totals: {
        orchestos: {
          usd: orchestosRows.reduce((total, row) => total + (row.usd ?? 0), 0),
          runs: orchestosRows.reduce((total, row) => total + row.runs, 0),
          tokens: orchestosRows.reduce(
            (total, row) =>
              total +
              row.inputTokens +
              row.outputTokens +
              (row.cacheReadTokens ?? 0) +
              (row.cacheWriteTokens ?? 0),
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
              (row.cacheReadTokens ?? 0) +
              (row.cacheWriteTokens ?? 0),
            0,
          ),
          unpricedSessions: cliRows.filter((row) => !row.priced).length,
        },
      },
    })
  } catch {
    return jsonResponse({ byHour: [], byDayModel: [], totalUsd: 0, totalRuns: 0 })
  }
}
