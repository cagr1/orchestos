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
  qaModel?: string | null
  adversarialVerdict?: string | null
  adversarialReason?: string | null
  refuterVerdict?: string | null
  refuterReason?: string | null
  model: string
  provider: string
  inputTokens: number
  outputTokens: number
  costUsd: number | null
  elapsedMs: number
  engine: RunItem['engine'] | null
  iterations: number | null
  fileDiffs: FileDiffEntry[]
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
    row.adversarialVerdict
      ? {
          criterion: `Adversarial verdict: ${row.adversarialVerdict}`,
          passed: row.adversarialVerdict.toUpperCase() === 'PASS',
          rationale: row.adversarialReason || 'No reason recorded',
        }
      : null,
    row.refuterVerdict
      ? {
          criterion: `Refuter verdict: ${row.refuterVerdict}`,
          passed: row.refuterVerdict.toUpperCase() === 'CONFIRMED',
          rationale: row.refuterReason || 'No reason recorded',
        }
      : null,
  ].filter((item): item is NonNullable<typeof item> => item !== null)
  return {
    id: row.id,
    taskId: row.taskId || '',
    taskDescription: row.prompt?.split(/\r?\n/, 1)[0] || row.taskId || '—',
    status: row.status,
    qaVerdict: row.qaVerdict,
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
    outputSlice: row.allowedOutputs || [],
    costBreakdown: row.costBreakdown,
    contextWarnings: row.contextWarnings,
    createdAt: row.createdAt,
  }
}

export async function listRuns(projectId: string): Promise<RunItem[]> {
  return (await listRunRows(projectId)).map(mapRunRow)
}
