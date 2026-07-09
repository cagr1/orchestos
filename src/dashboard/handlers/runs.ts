import { listRuns, getRun, deleteRun, type RunRecord } from '../../db/runs.ts'
import type { MutationResult } from '../types.ts'
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

// G.4 / B.2 — deriva engine + iteraciones del primer label de costBreakdown.
// Label canónico: "single-shot" (1 vuelta) | "agentic (N rounds)" (N vueltas) | "external (claude-code, N turn[s])" (B.2).
// Si el breakdown está vacío (run legacy pre-G.4 o path sin outcome), devuelve null/null.
function deriveEngineFromBreakdown(breakdown: CostBreakdownEntry[]): {
  engine: 'single-shot' | 'agentic' | 'external' | null
  iterations: number | null
} {
  const label = breakdown[0]?.label
  if (!label) return { engine: null, iterations: null }
  if (label === 'single-shot') return { engine: 'single-shot', iterations: 1 }
  const m = label.match(/^agentic \((\d+) rounds?\)$/)
  if (m) return { engine: 'agentic', iterations: parseInt(m[1]!, 10) }
  // B.2 — external.ts escribe "external (claude-code, N turn[s])" (1 o N turnos, según num_turns de Claude Code).
  const e = label.match(/^external \(claude-code, (\d+) turns?\)$/)
  if (e) return { engine: 'external', iterations: parseInt(e[1]!, 10) }
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

// Bloque E (Mes 18, ex-IDEAS #9b) — `orchestos runs --analyze` solo se disparaba
// automático vía hook post-completion; sin botón manual en el dashboard. Mismo
// llamado LLM real que la CLI (S30) — no es gratis, se dispara solo bajo pedido.
async function handleApiRunsAnalyze(req: Request): Promise<Response> {
  let body: { last?: number } = {}
  try { body = (await req.json()) as { last?: number } } catch { /* body opcional */ }
  const n = body.last && body.last > 0 ? body.last : 20

  const { groupRunsByOutcome, analyzeRunPatterns } = await import('../../analyze/patterns.ts')
  const { proposeInstinctsFromPatterns } = await import('../../analyze/propose.ts')

  const rows = listRuns(n)
  if (rows.length < 3) {
    return jsonResponse({ suggestions: [], proposals: [], message: 'Not enough runs to analyze (need at least 3).' })
  }
  const groups = groupRunsByOutcome(rows)
  try {
    const suggestions = await analyzeRunPatterns(groups)
    const proposals = suggestions.length > 0 ? proposeInstinctsFromPatterns(suggestions) : []
    return jsonResponse({ suggestions, proposals })
  } catch (e: any) {
    return errorResponse(`Analysis failed: ${e.message}`, 502)
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

// I.8 (Mes 18) — Runs no tenía forma de borrar registros viejos desde el dashboard.
function handleApiRunsDelete(url: URL): Response {
  const id = url.pathname.slice('/api/runs/'.length)
  if (!id) return errorResponse('Missing run id', 400)
  const ok = deleteRun(id)
  const result: MutationResult = ok ? { ok: true } : { ok: false, error: 'Run not found' }
  return jsonResponse(result, ok ? 200 : 404)
}

export { handleApiRuns, handleApiRunsAnalyze, handleApiRunsDelete }
