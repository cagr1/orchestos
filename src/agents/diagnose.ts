/**
 * src/agents/diagnose.ts
 *
 * S25.1 — Agente de diagnóstico de fallos.
 * Lee los últimos 3 runs de un task fallido, consulta a Haiku (barato) para
 * detectar el patrón de fallo, y devuelve una sugerencia estructurada.
 * NO ejecuta nada — solo sugiere. El usuario aplica la sugerencia.
 *
 * S25.2 — Output estructurado: patrón + sugerencia concreta.
 */

import { loadTasks as realLoadTasks } from '../tasks/loader.ts'
import { listRunsByTaskId as realListRunsByTaskId, type RunRecord } from '../db/runs.ts'
import { chat } from '../providers/openrouter.ts'
import { getProvider } from '../providers/index.ts'
import { calcCost } from '../router/pricing.ts'

type LoadTasksFn = (root: string) => { tasks: Array<{ id: string; description: string; retry_reason?: string }> }
type ListRunsByTaskIdFn = (taskId: string) => RunRecord[]

export type FailurePattern =
  | 'deterministic_check'
  | 'qa_specific_criterion'
  | 'parse_error'
  | 'rate_limit'
  | 'scope_creep'
  | 'unknown'

export interface DiagnoseResult {
  taskId: string
  pattern: FailurePattern
  confidence: 'high' | 'medium' | 'low'
  suggestion: string
  details: string
  /** Costo real USD de la llamada de diagnóstico — AR.3: el caller (graph-runner) lo necesita para no subcontar el circuit breaker. */
  usdCost: number
  /** result crudo (sin truncar) del run fallido más reciente — el motivo real del fallo, no el resumen del LLM diagnóstico */
  lastErrorResult?: string
}

const PATTERNS_DESCRIPTION = `
- deterministic_check: A check (shell command) failed repeatedly. The task output doesn't meet a deterministic condition.
- qa_specific_criterion: The LLM's output failed a specific acceptance criterion in QA review, not a general issue.
- parse_error: The LLM response could not be parsed as valid JSON. The model may be returning markdown, prose, or malformed JSON.
- rate_limit: The LLM provider returned a rate limit error, 429 status, or token quota exceeded.
- scope_creep: The task is too large — too many files, too much code, or vague description that causes the LLM to produce partial/broken output.
- unknown: None of the above patterns clearly match.
`

function buildDiagnosePrompt(taskId: string, description: string, runs: RunRecord[]): string {
  const runsBlock = runs.map((r, i) => {
    const checks = parseJson<Array<{ cmd: string; exitCode: number; elapsedMs: number; timedOut?: boolean }>>(r.checks_json, [])
    const checksStr = checks.length > 0
      ? checks.map(c =>
          `  - cmd: ${c.cmd}  exit: ${c.exitCode}  elapsed: ${c.elapsedMs}ms${c.timedOut ? ' TIMED_OUT' : ''}`
        ).join('\n')
      : '  (none)'

    return `### Run ${i + 1} (${r.created_at})
status:     ${r.status}
model:      ${r.model}
provider:   ${r.provider}
tokens:     ${r.input_tokens} in / ${r.output_tokens} out
cost:       $${r.usd_cost.toFixed(6)}
elapsed:    ${r.elapsed_ms}ms
qa_verdict: ${r.qa_verdict ?? 'N/A'}
qa_reason:  ${r.qa_reason ?? 'N/A'}
result:     ${r.result ?? 'N/A'}
files_attempted: ${r.files_attempted ?? 'N/A'}
files_blocked:   ${r.files_blocked ?? 'N/A'}
checks:
${checksStr}
`
  }).join('\n')

  return `You are a failure diagnosis assistant. Analyze the following task and its last 3 runs to identify WHY the task failed permanently.

TASK ID: ${taskId}
DESCRIPTION: ${description}

AVAILABLE PROVIDERS: openrouter, anthropic, openai, codex

FAILURE PATTERNS:
${PATTERNS_DESCRIPTION}

RUNS (most recent first):
${runsBlock}

Respond with ONLY a JSON object — no markdown fences, no prose, no explanation:
{
  "pattern": "<one of the patterns above>",
  "confidence": "high|medium|low",
  "suggestion": "one or two sentences suggesting how to modify the task definition to fix this failure",
  "details": "one sentence explaining the evidence that led to this conclusion"
}`
}

function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback
  try { return JSON.parse(raw) as T } catch { return fallback }
}

/**
 * Diagnose why a task failed permanently by analyzing its last 3 runs.
 * @param taskId The task ID from tasks.yaml
 * @param root Project root directory
 * @param modelOverride Optional model override (default: haiku via openrouter)
 */
export async function diagnoseTask(
  taskId: string,
  root: string,
  modelOverride?: string,
  loadTasksFn?: LoadTasksFn,
  listRunsByTaskIdFn?: ListRunsByTaskIdFn,
): Promise<DiagnoseResult> {
  const loadTasks_ = loadTasksFn ?? realLoadTasks
  const listRuns_ = listRunsByTaskIdFn ?? realListRunsByTaskId
  const file = loadTasks_(root)
  const task = file.tasks.find((t: { id: string }) => t.id === taskId)
  if (!task) throw new Error(`Task "${taskId}" not found in tasks.yaml`)

  const runs = listRuns_(taskId).slice(0, 3)
  if (runs.length === 0) {
    // Bug real (2026-07-16): un fallo en mergeWorktreeBack() DESPUÉS de que
    // QA ya pasó (harness.ts, camino de éxito) lanza antes de insertRun() —
    // el intento cuesta dinero real pero no deja fila en `runs`. Antes esto
    // hacía throw() → 404 → el front descartaba el error en silencio y el
    // panel de diagnosis nunca se abría (ver PLAN.md Bloque F.4). Con
    // retry_reason presente (tasks.yaml sí lo tiene siempre) se sintetiza un
    // diagnóstico sin gastar una llamada a Haiku — el motivo real YA está
    // en el mensaje de error del harness.
    if (task.retry_reason) {
      return {
        taskId,
        pattern: 'unknown',
        confidence: 'high',
        suggestion: 'Failure happened after QA passed (worktree merge-back), not during generation — no LLM run was recorded. See the exact error and manual-fix commands below.',
        details: task.retry_reason,
        usdCost: 0,
        lastErrorResult: task.retry_reason,
      }
    }
    throw new Error(`No runs found for task "${taskId}"`)
  }

  const lastErrorResult = runs.find(r => r.status === 'failed' || r.status === 'blocked')?.result ?? undefined

  const model = modelOverride ?? 'anthropic/claude-haiku-4-5'

  let resp
  try {
    resp = await chat({
      model,
      system: 'You are a diagnostic assistant that outputs only JSON.',
      messages: [{ role: 'user', content: buildDiagnosePrompt(taskId, task.description, runs) }],
    })
  } catch {
    const provider = getProvider('openrouter')
    resp = await provider.chat({
      model,
      system: 'You are a diagnostic assistant that outputs only JSON.',
      messages: [{ role: 'user', content: buildDiagnosePrompt(taskId, task.description, runs) }],
    })
  }

  const usdCost = calcCost(resp.model, resp.inputTokens, resp.outputTokens)

  const jsonMatch = resp.text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return {
      taskId,
      pattern: 'unknown',
      confidence: 'low',
      suggestion: 'Could not parse LLM diagnostic response. Read the run details manually with: orchestos runs --detail <run-id>',
      details: `LLM returned unparseable response: ${resp.text.slice(0, 200)}`,
      usdCost,
      lastErrorResult,
    }
  }

  try {
    const obj = JSON.parse(jsonMatch[0])
    const validPatterns: FailurePattern[] = [
      'deterministic_check', 'qa_specific_criterion', 'parse_error', 'rate_limit', 'scope_creep', 'unknown',
    ]
    const pattern = validPatterns.includes(obj.pattern) ? obj.pattern as FailurePattern : 'unknown'
    const confidence = ['high', 'medium', 'low'].includes(obj.confidence)
      ? obj.confidence as 'high' | 'medium' | 'low'
      : 'low'
    return {
      taskId,
      pattern,
      confidence,
      suggestion: typeof obj.suggestion === 'string' ? obj.suggestion : 'No suggestion provided.',
      details: typeof obj.details === 'string' ? obj.details : 'No details provided.',
      usdCost,
      lastErrorResult,
    }
  } catch {
    return {
      taskId,
      pattern: 'unknown',
      confidence: 'low',
      suggestion: 'Could not parse LLM diagnostic response. Read the run details manually with: orchestos runs --detail <run-id>',
      details: `JSON parse error on: ${jsonMatch[0].slice(0, 200)}`,
      usdCost,
      lastErrorResult,
    }
  }
}
