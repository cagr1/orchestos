import type { FileDiffEntry, RunItem } from '../types/orchestos';

interface RunRow {
  id: string;
  taskId: string | null;
  status: RunItem['status'];
  qaVerdict: RunItem['qaVerdict'];
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number | null;
  elapsedMs: number;
  engine: RunItem['engine'] | null;
  iterations: number | null;
  fileDiffs: FileDiffEntry[];
  costBreakdown: RunItem['costBreakdown'];
  contextWarnings: RunItem['contextWarnings'];
  createdAt: string;
}

async function listRunRows(projectId: string): Promise<RunRow[]> {
  const response = await fetch('/api/runs', { headers: { 'x-orchestos-project-id': projectId } });
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json() as Promise<RunRow[]>;
}

export function mapRunRow(row: RunRow): RunItem {
  return {
    id: row.id,
    taskId: row.taskId || '',
    taskDescription: row.taskId || '',
    status: row.status,
    qaVerdict: row.qaVerdict,
    model: row.model,
    provider: row.provider,
    inputTokens: row.inputTokens,
    outputTokens: row.outputTokens,
    tokensUsed: row.inputTokens + row.outputTokens,
    costUsd: row.costUsd ?? 0,
    elapsedMs: row.elapsedMs,
    engine: row.engine || 'single-shot',
    iterations: row.iterations || 1,
    deterministicChecks: [],
    qaEvaluation: [],
    filesAttempted: [],
    filesAuthorized: [],
    filesBlocked: [],
    fileDiffs: row.fileDiffs,
    outputSlice: [],
    costBreakdown: row.costBreakdown,
    contextWarnings: row.contextWarnings,
    createdAt: row.createdAt,
  };
}

export async function listRuns(projectId: string): Promise<RunItem[]> {
  return (await listRunRows(projectId)).map(mapRunRow);
}
