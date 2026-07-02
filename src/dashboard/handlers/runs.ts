import { listRuns, getRun, type RunRecord } from '../../db/runs.ts'
import { parseCostBreakdownJson, type CostBreakdownEntry } from '../../run/transcript-parser.ts'
import type { ContextWarningEntry, RunRow } from '../types.ts'
import { jsonResponse, errorResponse } from '../http.ts'

function parseContextWarnings(raw: string | null | undefined): ContextWarningEntry[] {
  if (!raw) return []
  try {
    return JSON.parse(raw) as ContextWarningEntry[]
  } catch {
    return []
  }
}

// G.4 — deriva engine + iteraciones del primer label de costBreakdown.
// Label canónico: "single-shot" (1 vuelta) o "agentic (N rounds)" (N vueltas).
// Si el breakdown está vacío (run legacy pre-G.4 o path sin outcome), devuelve null/null.
function deriveEngineFromBreakdown(breakdown: CostBreakdownEntry[]): {
  engine: 'single-shot' | 'agentic' | null
  iterations: number | null
} {
  const label = breakdown[0]?.label
  if (!label) return { engine: null, iterations: null }
  if (label === 'single-shot') return { engine: 'single-shot', iterations: 1 }
  const m = label.match(/^agentic \((\d+) rounds?\)$/)
  if (m) return { engine: 'agentic', iterations: parseInt(m[1]!, 10) }
  return { engine: null, iterations: null }
}

function runRecordToRow(r: RunRecord): RunRow {
  const breakdown = parseCostBreakdownJson(r.cost_breakdown_json)
  const { engine, iterations } = deriveEngineFromBreakdown(breakdown)
  return {
    id: r.id,
    taskId: r.task_id,
    status: r.status,
    qaVerdict: r.qa_verdict as 'pass' | 'fail' | null,
    model: r.model,
    provider: r.provider,
    skillId: r.skill_id,
    inputTokens: r.input_tokens,
    outputTokens: r.output_tokens,
    costUsd: r.usd_cost,
    costBreakdown: breakdown,
    contextWarnings: parseContextWarnings(r.context_warnings_json),
    engine,
    iterations,
    elapsedMs: r.elapsed_ms,
    createdAt: r.created_at,
  }
}

function handleApiRuns(url: URL): Response {
  if (url.pathname.startsWith('/api/runs/')) {
    const id = url.pathname.slice('/api/runs/'.length)
    if (!id) return errorResponse('Missing run id', 400)
    const r = getRun(id)
    if (!r) return errorResponse('Run not found', 404)
    return jsonResponse(runRecordToRow(r))
  }
  const limit = url.searchParams.get('limit')
  const rows = listRuns(limit ? parseInt(limit) : 50)
  return jsonResponse(rows.map(runRecordToRow))
}

export { handleApiRuns }
