import {
  deleteRun,
  getRun,
  listRunsByProjectId,
  listRunsWithoutProjectId,
  markRunReverted,
  type RunRecord,
} from '../../db/runs.ts'
import {
  approvalEvents,
  getApprovalRun,
  pendingApprovals,
  resolveApproval,
} from '../../run/approvals.ts'
import { withGitLock } from '../../run/git-lock.ts'
import { parseReadAudit } from '../../run/read-audit.ts'
import { git } from '../../run/sandbox.ts'
import { listDirtyFiles } from '../../run/sandbox-policy.ts'
import { type CostBreakdownEntry, parseCostBreakdownJson } from '../../run/transcript-parser.ts'
import { errorResponse, jsonResponse } from '../http.ts'
import type {
  ContextWarningEntry,
  FileDiffEntry,
  MutationResult,
  RunRow,
  SkillGateEntry,
} from '../types.ts'

function parseContextWarnings(raw: string | null | undefined): ContextWarningEntry[] {
  if (!raw) return []
  try {
    return JSON.parse(raw) as ContextWarningEntry[]
  } catch {
    return []
  }
}

function parseFileDiffs(raw: string | null | undefined): FileDiffEntry[] {
  if (!raw) return []
  try {
    const entries = JSON.parse(raw) as Array<Omit<FileDiffEntry, 'additions' | 'deletions'>>
    return entries.map((entry) => {
      let additions = 0
      let deletions = 0
      for (const line of entry.diff.split('\n')) {
        if (line.startsWith('+++') || line.startsWith('---')) continue
        if (line.startsWith('+')) additions++
        else if (line.startsWith('-')) deletions++
      }
      return { ...entry, additions, deletions }
    })
  } catch {
    return []
  }
}

function parseSkillGates(raw: string | null | undefined): SkillGateEntry[] | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as SkillGateEntry[]
  } catch {
    return null
  }
}

function parseJsonArray<T>(raw: string | null | undefined): T[] {
  if (!raw) return []
  try {
    const value: unknown = JSON.parse(raw)
    return Array.isArray(value) ? (value as T[]) : []
  } catch {
    return []
  }
}

// G.4 / B.2 — deriva engine + iteraciones del primer label de costBreakdown.
// Label canónico: "single-shot" (1 vuelta) | "agentic (N rounds)" (N vueltas) | "external (claude-code, N turn[s])" (B.2)
// | "opencode (N step[s])" (G.5) | "codex (exec)" (G.4.2b, siempre 1 — sin conteo de turnos).
// Si el breakdown está vacío (run legacy pre-G.4 o path sin outcome), devuelve null/null.
function deriveEngineFromBreakdown(breakdown: CostBreakdownEntry[]): {
  engine: 'single-shot' | 'agentic' | (string & {}) | null
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
  // G.5 — opencode.ts escribe "opencode (N step[s])".
  const o = label.match(/^opencode \((\d+) steps?\)$/)
  if (o) return { engine: 'opencode', iterations: parseInt(o[1]!, 10) }
  // G.4.2b — codex.ts escribe "codex (exec)" (label fijo, sin N — codex exec no expone conteo de turnos).
  if (label === 'codex (exec)') return { engine: 'codex', iterations: 1 }
  return { engine: null, iterations: null }
}

export function runRecordToRow(r: RunRecord): RunRow {
  const breakdown = parseCostBreakdownJson(r.cost_breakdown_json)
  const costSource = breakdown[0]?.source ?? 'estimated'
  const { engine, iterations } = deriveEngineFromBreakdown(breakdown)
  return {
    id: r.id,
    projectId: r.project_id,
    taskId: r.task_id,
    prompt: r.prompt,
    allowedOutputs: parseJsonArray<string>(r.allowed_outputs),
    filesAttempted: parseJsonArray<string>(r.files_attempted),
    filesAuthorized: parseJsonArray<string>(r.files_authorized),
    filesBlocked: parseJsonArray<string>(r.files_blocked),
    checks: parseJsonArray<{
      cmd: string
      exitCode: number
      elapsedMs: number
      timedOut?: boolean
    }>(r.checks_json),
    status: r.status,
    qaVerdict: r.qa_verdict as 'pass' | 'fail' | null,
    qaReason: r.qa_reason,
    result: r.result,
    executorReply: r.executor_reply ?? null,
    qaModel: r.qa_model,
    qaCriteria: parseJsonArray<{
      text: string
      pass: boolean
      evidence?: { file: string; excerpt: string }
    }>(r.qa_criteria_json),
    model: r.model,
    provider: r.provider,
    readAudit: parseReadAudit(r.read_audit_json),
    skillId: r.skill_id,
    inputTokens: r.input_tokens,
    outputTokens: r.output_tokens,
    costUsd: costSource === 'unknown' ? null : r.usd_cost,
    costSource,
    costBreakdown: breakdown,
    contextWarnings: parseContextWarnings(r.context_warnings_json),
    engine,
    iterations,
    fileDiffs: parseFileDiffs(r.file_diffs),
    commitSha: r.commit_sha ?? null,
    revertedSha: r.reverted_sha ?? null,
    revertedAt: r.reverted_at ?? null,
    skillGates: parseSkillGates(r.skill_gates_json),
    elapsedMs: r.elapsed_ms,
    createdAt: r.created_at,
  }
}

// Bloque E (Mes 18, ex-IDEAS #9b) — `orchestos runs --analyze` solo se disparaba
// automático vía hook post-completion; sin botón manual en el dashboard. Mismo
// llamado LLM real que la CLI (S30) — no es gratis, se dispara solo bajo pedido.
async function handleApiRunsAnalyze(
  req: Request,
  projectId: string | null = null,
): Promise<Response> {
  let body: { last?: number } = {}
  try {
    body = (await req.json()) as { last?: number }
  } catch {
    /* body opcional */
  }
  const n =
    typeof body.last === 'number' && Number.isFinite(body.last) && body.last > 0
      ? Math.min(Math.floor(body.last), 200)
      : 20

  const { groupRunsByOutcome, analyzeRunPatterns } = await import('../../analyze/patterns.ts')
  const { proposeInstinctsFromPatterns } = await import('../../analyze/propose.ts')

  const rows = projectId ? listRunsByProjectId(projectId, n) : listRunsWithoutProjectId(n)
  if (rows.length < 3) {
    return jsonResponse({
      suggestions: [],
      proposals: [],
      message: 'Not enough runs to analyze (need at least 3).',
    })
  }
  const groups = groupRunsByOutcome(rows)
  try {
    const suggestions = await analyzeRunPatterns(groups)
    const proposals =
      suggestions.length > 0 ? proposeInstinctsFromPatterns(suggestions, projectId) : []
    return jsonResponse({ suggestions, proposals })
  } catch (e: any) {
    return errorResponse(`Analysis failed: ${e.message}`, 502)
  }
}

function handleApiRuns(url: URL, projectId: string | null): Response {
  if (url.pathname.startsWith('/api/runs/')) {
    const id = url.pathname.slice('/api/runs/'.length)
    if (!id) return errorResponse('Missing run id', 400)
    const r = getRun(id)
    if (!r || r.project_id !== projectId) return errorResponse('Run not found', 404)
    return jsonResponse(runRecordToRow(r))
  }
  const rawLimit = url.searchParams.get('limit')
  const parsedLimit = rawLimit === null ? 50 : Number(rawLimit)
  const limit = Number.isInteger(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 200) : 50
  const rows = projectId ? listRunsByProjectId(projectId, limit) : listRunsWithoutProjectId(limit)
  return jsonResponse(rows.map(runRecordToRow))
}

// I.8 (Mes 18) — Runs no tenía forma de borrar registros viejos desde el dashboard.
function handleApiRunsDelete(url: URL, projectId?: string | null): Response {
  const id = url.pathname.slice('/api/runs/'.length)
  if (!id) return errorResponse('Missing run id', 400)
  const row = getRun(id)
  const ok = !!row && (projectId === undefined || row.project_id === projectId) && deleteRun(id)
  const result: MutationResult = ok ? { ok: true } : { ok: false, error: 'Run not found' }
  return jsonResponse(result, ok ? 200 : 404)
}

// v0.12 Bloque A — borrado en lote, reusa deleteRun() por id (mismo camino
// que el delete individual, sin motor nuevo). `deleted` cuenta solo los ids
// que existían de verdad — un id ya borrado no cuenta como fallo.
async function handleApiRunsBulkDelete(req: Request, projectId: string | null): Promise<Response> {
  let body: { ids?: unknown }
  try {
    body = (await req.json()) as { ids?: unknown }
  } catch {
    return errorResponse('Invalid JSON', 400)
  }
  if (!Array.isArray(body.ids) || body.ids.length === 0)
    return errorResponse('ids must be a non-empty array', 400)
  const ids = body.ids.filter((id): id is string => typeof id === 'string')
  let deleted = 0
  for (const id of ids) if (getRun(id)?.project_id === projectId && deleteRun(id)) deleted++
  return jsonResponse({ ok: true, deleted })
}

// ERP.7.2a — deshace una tarea aplicada con un commit nuevo (`git revert`), nunca reescribe historia.
function handleApiRunsRevert(url: URL, project: { id: string | null; root: string }): Response {
  const id = url.pathname.slice('/api/runs/'.length, -'/revert'.length)
  const run = id ? getRun(id) : null
  if (!run || run.project_id !== project.id) return errorResponse('Run not found', 404)
  if (run.status !== 'done') return errorResponse('Run did not succeed; nothing to undo', 409)
  if (!run.commit_sha) return errorResponse('Run has no recorded commit', 409)
  if (run.reverted_sha) return errorResponse('Run was already undone', 409)
  const sha = run.commit_sha
  const root = project.root

  return withGitLock(root, () => {
    if (git(['merge-base', '--is-ancestor', sha, 'HEAD'], root).exitCode !== 0)
      return errorResponse('Run commit is not in the current branch history', 409)
    const dirtyFiles = listDirtyFiles(root)
    if (dirtyFiles.length > 0) {
      return jsonResponse({ error: 'Uncommitted changes in the project', dirtyFiles }, 409)
    }
    const revert = git(['revert', '--no-commit', sha], root)
    if (revert.exitCode !== 0) {
      const conflictFiles = git(['diff', '--name-only', '--diff-filter=U'], root)
        .stdout.split('\n')
        .filter(Boolean)
      git(['revert', '--abort'], root)
      return jsonResponse(
        { error: 'Undo conflicts with later changes', conflictFiles, detail: revert.stderr },
        409,
      )
    }
    const commit = git(['commit', '-m', `orchestos(${run.task_id ?? id}): deshacer`], root)
    if (commit.exitCode !== 0) {
      git(['revert', '--abort'], root)
      return errorResponse(`Could not commit the undo: ${commit.stderr}`, 500)
    }
    const revertedSha = git(['rev-parse', 'HEAD'], root).stdout
    markRunReverted(run.id, revertedSha)
    return jsonResponse({ ok: true, revertedSha })
  })
}

export {
  handleApiRuns,
  handleApiRunsAnalyze,
  handleApiRunsBulkDelete,
  handleApiRunsDelete,
  handleApiRunsRevert,
}

export async function handleApiRunApproval(
  req: Request,
  url: URL,
  projectId: string | null,
): Promise<Response> {
  const id = url.pathname.slice('/api/runs/'.length, -'/approval'.length)
  const session = getApprovalRun(id)
  const run = getRun(id)
  if (
    (!session?.active || session.project_id !== projectId) &&
    (!run || run.project_id !== projectId)
  )
    return errorResponse('Run not found', 404)
  if (req.method === 'GET')
    return jsonResponse({ pending: pendingApprovals(id), events: approvalEvents(id) })
  let body: any
  try {
    body = await req.json()
  } catch {
    return errorResponse('Invalid JSON', 400)
  }
  if (
    !body ||
    typeof body.approvalId !== 'string' ||
    !body.approvalId ||
    !['approve', 'reject', 'approve-always'].includes(body.decision)
  )
    return errorResponse('Invalid approvalId or decision', 400)
  const result = resolveApproval(id, body.approvalId, body.decision)
  return result
    ? jsonResponse({ ok: true, ...result })
    : errorResponse('Approval is resolved or belongs to another run', 409)
}
