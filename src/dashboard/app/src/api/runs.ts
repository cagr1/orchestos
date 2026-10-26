import type { FileDiffEntry, QaEvaluationItem, RunItem } from '../types/orchestos'

interface RunRow {
  id: string
  taskId: string | null
  prompt?: string
  allowedOutputs?: string[]
  filesAttempted?: string[]
  filesAuthorized?: string[]
  filesBlocked?: string[]
  checks?: Array<{
    cmd: string
    exitCode: number
    elapsedMs: number
    timedOut?: boolean
    stderr?: string
    stdout?: string
  }>
  status: RunItem['status']
  qaVerdict: RunItem['qaVerdict']
  qaReason?: string | null
  result?: string | null
  executorReply?: string | null
  qaModel?: string | null
  qaCriteria?: Array<{ text: string; pass: boolean; evidence?: { file: string; excerpt: string } }>
  model: string
  provider: string
  inputTokens: number
  outputTokens: number
  costUsd: number | null
  elapsedMs: number
  engine: RunItem['engine'] | null
  iterations: number | null
  fileDiffs: FileDiffEntry[]
  commitSha?: string | null
  revertedSha?: string | null
  revertedAt?: string | null
  costBreakdown: RunItem['costBreakdown']
  contextWarnings: RunItem['contextWarnings']
  createdAt: string
}

async function listRunRows(projectId: string): Promise<RunRow[]> {
  const response = await fetch('/api/runs', { headers: { 'x-orchestos-project-id': projectId } })
  if (!response.ok) throw new Error(`Request failed (${response.status})`)
  return response.json() as Promise<RunRow[]>
}

export function mapRunRow(row: RunRow): RunItem {
  const duration = row.elapsedMs > 0 ? `${Math.max(1, Math.round(row.elapsedMs / 60000))}m` : '—'
  const qaEvaluation: QaEvaluationItem[] = [
    row.qaVerdict && (row.qaVerdict === 'skipped' || row.qaModel)
      ? {
          kind: row.qaVerdict === 'skipped' ? ('skipped' as const) : ('judge' as const),
          criterion: row.qaVerdict === 'skipped' ? 'QA: no corrió' : `QA verdict: ${row.qaVerdict}`,
          passed: row.qaVerdict === 'pass',
          rationale: row.qaReason || 'No reason recorded',
        }
      : null,
    ...(row.qaCriteria || []).map((c) => ({
      kind: 'criterion' as const,
      criterion: c.text,
      passed: c.pass,
      rationale: c.evidence
        ? `${c.evidence.file}: ${c.evidence.excerpt}`
        : 'no evidence in written files',
    })),
  ].filter((item): item is NonNullable<typeof item> => item !== null)
  return {
    id: row.id,
    taskId: row.taskId || '',
    taskDescription: row.prompt?.split(/\r?\n/, 1)[0] || row.taskId || '—',
    status: row.status,
    qaVerdict: row.qaVerdict,
    qaModel: row.qaModel ?? null,
    ...(row.status !== 'done' && row.result ? { failureReason: row.result } : {}),
    ...(row.executorReply ? { executorReply: row.executorReply } : {}),
    model: row.model,
    agentModel:
      row.engine?.startsWith('cli:') && row.model === 'default'
        ? `${row.provider} · default`
        : row.model,
    provider: row.provider,
    inputTokens: row.inputTokens,
    outputTokens: row.outputTokens,
    tokensUsed: row.inputTokens + row.outputTokens,
    costUsd: row.costUsd,
    elapsedMs: row.elapsedMs,
    duration,
    engine: row.engine || 'single-shot',
    iterations: row.iterations || 1,
    deterministicChecks: (row.checks || []).map((check) => ({
      name: check.cmd,
      command: check.cmd,
      passed: check.exitCode === 0 && !check.timedOut,
      durationMs: check.elapsedMs,
      exitCode: check.exitCode,
      output: [check.stderr, check.stdout].filter(Boolean).join('\n'),
    })),
    qaEvaluation,
    filesAttempted: row.filesAttempted || [],
    filesAuthorized: row.filesAuthorized || [],
    filesBlocked: row.filesBlocked || [],
    fileDiffs: row.fileDiffs,
    commitSha: row.commitSha,
    revertedSha: row.revertedSha,
    revertedAt: row.revertedAt,
    outputSlice: row.allowedOutputs || [],
    costBreakdown: row.costBreakdown,
    contextWarnings: row.contextWarnings,
    createdAt: row.createdAt,
  }
}

export async function listRuns(projectId: string): Promise<RunItem[]> {
  return (await listRunRows(projectId)).map(mapRunRow)
}

export async function getRun(runId: string, projectId: string): Promise<RunItem> {
  const response = await fetch(`/api/runs/${encodeURIComponent(runId)}`, {
    headers: { 'x-orchestos-project-id': projectId },
  })
  const body = (await response.json().catch(() => null)) as (RunRow & { error?: string }) | null
  if (!response.ok) throw new Error(body?.error || `Request failed (${response.status})`)
  if (!body) throw new Error('Run response was empty')
  return mapRunRow(body)
}

export async function revertRun(
  runId: string,
  projectId: string,
): Promise<{ ok: true; revertedSha: string }> {
  const response = await fetch(`/api/runs/${encodeURIComponent(runId)}/revert`, {
    method: 'POST',
    headers: { 'x-orchestos-project-id': projectId },
  })
  const body = (await response.json().catch(() => null)) as {
    ok?: true
    revertedSha?: string
    error?: string
    dirtyFiles?: string[]
    conflictFiles?: string[]
    residualFiles?: string[]
  } | null
  if (!response.ok) {
    const error = new Error(body?.error || `Request failed (${response.status})`) as Error & {
      status?: number
      dirtyFiles?: string[]
      conflictFiles?: string[]
      residualFiles?: string[]
    }
    error.status = response.status
    error.dirtyFiles = body?.dirtyFiles
    error.conflictFiles = body?.conflictFiles
    error.residualFiles = body?.residualFiles
    throw error
  }
  if (!body?.revertedSha) throw new Error('Revert response did not include revertedSha')
  return { ok: true, revertedSha: body.revertedSha }
}

export interface PendingApproval {
  runId: string
  approvalId: string
  kind: 'command' | 'edit'
  detail: { command?: string; cwd?: string; diff?: string; files?: string[] }
}
export type ApprovalDecision = 'approve' | 'reject' | 'approve-always'

export async function getRunApprovals(
  runId: string,
  projectId: string,
): Promise<PendingApproval[]> {
  const response = await fetch(`/api/runs/${encodeURIComponent(runId)}/approval`, {
    headers: { 'x-orchestos-project-id': projectId },
  })
  const body = (await response.json().catch(() => null)) as {
    pending?: PendingApproval[]
    error?: string
  } | null
  if (!response.ok) throw new Error(body?.error || `Request failed (${response.status})`)
  if (!body?.pending) throw new Error('Approval response was empty')
  return body.pending
}

export async function resolveRunApproval(
  runId: string,
  projectId: string,
  approvalId: string,
  decision: ApprovalDecision,
): Promise<void> {
  const response = await fetch(`/api/runs/${encodeURIComponent(runId)}/approval`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-orchestos-project-id': projectId },
    body: JSON.stringify({ approvalId, decision }),
  })
  const body = (await response.json().catch(() => null)) as { error?: string } | null
  if (!response.ok) throw new Error(body?.error || `Request failed (${response.status})`)
}
