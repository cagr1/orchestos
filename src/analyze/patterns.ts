/**
 * src/analyze/patterns.ts — S30
 *
 * Analyzes completed runs to detect recurring failure patterns and suggest improvements.
 * Designed to be called after `task run` completes or via `orchestos runs analyze`.
 *
 * Two layers:
 *   groupRunsByOutcome(runs)       — pure aggregation, no LLM (testable)
 *   analyzeRunPatterns(groups, …)  — LLM call (Haiku) to generate PatternSuggestion[]
 *
 * PatternSuggestion is intentionally advisory — it never modifies anything.
 */

import { chat } from '../providers/openrouter.ts'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface PatternSuggestion {
  pattern: string
  frequency: number
  fix_hint: string
  confidence: 'high' | 'medium' | 'low'
}

export interface RunOutcomeGroups {
  qaPass: number
  qaFail: number
  blocked: number
  parseError: number
  total: number
  failReasons: string[]
  topModels: Record<string, number>
  avgCostUsd: number
  avgElapsedMs: number
}

// Minimal shape of what we need from a RunRecord
export interface RunSummary {
  status: string
  qa_verdict: string | null
  qa_reason: string | null
  model: string
  usd_cost: number
  elapsed_ms: number
  result: string | null
}

// ---------------------------------------------------------------------------
// S30.1 — pure aggregation (no LLM, fully testable)
// ---------------------------------------------------------------------------

export function groupRunsByOutcome(runs: RunSummary[]): RunOutcomeGroups {
  let qaPass = 0
  let qaFail = 0
  let blocked = 0
  let parseError = 0
  const failReasons: string[] = []
  const modelCounts: Record<string, number> = {}
  let totalCost = 0
  let totalElapsed = 0

  for (const r of runs) {
    totalCost    += r.usd_cost ?? 0
    totalElapsed += r.elapsed_ms ?? 0

    const model = r.model ?? 'unknown'
    modelCounts[model] = (modelCounts[model] ?? 0) + 1

    if (r.status === 'blocked') {
      blocked++
    } else if (r.result?.startsWith('parse error')) {
      parseError++
    } else if (r.qa_verdict === 'pass') {
      qaPass++
    } else if (r.qa_verdict === 'fail') {
      qaFail++
      if (r.qa_reason) failReasons.push(r.qa_reason)
    }
  }

  const n = runs.length || 1
  return {
    qaPass,
    qaFail,
    blocked,
    parseError,
    total: runs.length,
    failReasons,
    topModels: modelCounts,
    avgCostUsd: totalCost / n,
    avgElapsedMs: totalElapsed / n,
  }
}

// ---------------------------------------------------------------------------
// S30.2 — LLM pattern analysis
// ---------------------------------------------------------------------------

const ANALYZE_SYSTEM = `You are a continuous-learning assistant for an AI task runner.
Analyze the run history provided and identify recurring patterns that lead to failures or inefficiencies.
For each pattern, suggest a concrete fix the user can apply to their tasks.yaml or spec.
Output ONLY a JSON array of PatternSuggestion objects — no prose, no markdown fences:
[{ "pattern": "short name", "frequency": <int>, "fix_hint": "one concrete action", "confidence": "high|medium|low" }]
Return an empty array [] if fewer than 3 runs or no clear patterns exist.`

function buildAnalyzePrompt(groups: RunOutcomeGroups): string {
  const failBlock = groups.failReasons.length > 0
    ? `QA failure reasons (sample):\n${groups.failReasons.slice(0, 5).map(r => `  - ${r}`).join('\n')}`
    : 'QA failure reasons: (none)'

  const modelBlock = Object.entries(groups.topModels)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([m, n]) => `  ${m}: ${n} runs`)
    .join('\n')

  return `Run history summary (last ${groups.total} runs):
  pass: ${groups.qaPass}  fail: ${groups.qaFail}  blocked: ${groups.blocked}  parse_error: ${groups.parseError}
  avg_cost: $${groups.avgCostUsd.toFixed(4)}  avg_elapsed: ${Math.round(groups.avgElapsedMs / 1000)}s

${failBlock}

Top models used:
${modelBlock}

Identify patterns and suggest fixes. Focus on actionable improvements to task definitions.`
}

export async function analyzeRunPatterns(
  groups: RunOutcomeGroups,
  modelOverride?: string,
): Promise<PatternSuggestion[]> {
  if (groups.total < 3) return []

  const model = modelOverride ?? 'anthropic/claude-haiku-4-5-20251001'
  const prompt = buildAnalyzePrompt(groups)

  let text: string
  try {
    const resp = await chat({
      model,
      system: ANALYZE_SYSTEM,
      messages: [{ role: 'user', content: prompt }],
    })
    text = resp.text
  } catch {
    return []
  }

  return parsePatternSuggestions(text)
}

// ---------------------------------------------------------------------------
// S30.5 — Parser (pure, testable without LLM)
// ---------------------------------------------------------------------------

export function parsePatternSuggestions(raw: string): PatternSuggestion[] {
  const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) ?? raw.match(/(\[[\s\S]*\])/)
  const jsonStr = jsonMatch?.[1] ?? raw.trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonStr)
  } catch {
    return []
  }

  if (!Array.isArray(parsed)) return []

  const results: PatternSuggestion[] = []
  for (const item of parsed) {
    const i = item as Record<string, unknown>
    if (typeof i.pattern !== 'string' || typeof i.fix_hint !== 'string') continue
    results.push({
      pattern:    i.pattern,
      frequency:  typeof i.frequency === 'number' ? i.frequency : 0,
      fix_hint:   i.fix_hint,
      confidence: ['high', 'medium', 'low'].includes(i.confidence as string)
        ? i.confidence as 'high' | 'medium' | 'low'
        : 'low',
    })
  }
  return results
}
