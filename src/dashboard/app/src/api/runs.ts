import type { FileDiffEntry, RunItem } from '../types/orchestos'

interface RunRow {
  id: string
  taskId: string | null
  prompt?: string
  allowedOutputs?: string[]
  filesAttempted?: string[]
  filesAuthorized?: string[]
  filesBlocked?: string[]
  checks?: Array<{ cmd: string; exitCode: number; elapsedMs: number; timedOut?: boolean }>
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
  const qaEvaluation = [
    row.qaVerdict
      ? {
          criterion: `QA verdict: ${row.qaVerdict}`,
          passed: row.qaVerdict === 'pass',
          rationale: row.qaReason || 'No reason recorded',
        }
      : null,
    ...(row.qaCriteria || []).map((c) => ({
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
    ...(row.status !== 'done' && row.result ? { failureReason: row.result } : {}),
    ...(row.executorReply ? { executorReply: row.executorReply } : {}),
    model: row.model,
    agentModel: row.model,
    provider: row.provider,
    inputTokens: row.inputTokens,
    outputTokens: row.outputTokens,
    tokensUsed: row.inputTokens + row.outputTokens,
    costUsd: row.costUsd ?? 0,
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
  } | null
  if (!response.ok) {
    const error = new Error(body?.error || `Request failed (${response.status})`) as Error & {
      status?: number
      dirtyFiles?: string[]
      conflictFiles?: string[]
    }
    error.status = response.status
    error.dirtyFiles = body?.dirtyFiles
    error.conflictFiles = body?.conflictFiles
    throw error
  }
  if (!body?.revertedSha) throw new Error('Revert response did not include revertedSha')
  return { ok: true, revertedSha: body.revertedSha }
}
