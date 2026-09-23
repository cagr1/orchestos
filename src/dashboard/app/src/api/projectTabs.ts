import type { InstinctItem, MemoryItem, SkillItem, SpecItem, TaskItem } from '../types/orchestos'

async function request<T>(path: string, projectId: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { ...(init?.headers ?? {}), 'x-orchestos-project-id': projectId },
  })
  const body = (await response.json().catch(() => null)) as { error?: string } | T | null
  if (!response.ok)
    throw new Error(
      (body as { error?: string } | null)?.error ?? `Request failed (${response.status})`,
    )
  return body as T
}

export async function listMemory(projectId: string): Promise<MemoryItem[]> {
  const [rows, conflicts] = await Promise.all([
    request<
      Array<{
        id: string
        topicKey: string
        scope: MemoryItem['scope']
        content: string
        updatedAt: string
      }>
    >('/api/memory', projectId),
    request<Array<{ id: string; entry_a_id: string; entry_b_id: string }>>(
      `/api/memory/conflicts?project=${encodeURIComponent(projectId)}`,
      projectId,
    ),
  ])
  return rows.map((row) => {
    const conflict = conflicts.find(
      (item) => item.entry_a_id === row.id || item.entry_b_id === row.id,
    )
    const other =
      conflict &&
      rows.find(
        (item) =>
          item.id === (conflict.entry_a_id === row.id ? conflict.entry_b_id : conflict.entry_a_id),
      )
    return {
      ...row,
      ...(conflict
        ? {
            hasConflict: true,
            conflictDetails: {
              conflictId: conflict.id,
              conflictingContent: other?.content ?? '',
              detectedFromRun: conflict.id,
            },
          }
        : {}),
    }
  })
}

export async function resolveMemoryConflict(
  projectId: string,
  id: string,
  content: string,
): Promise<void> {
  await request(`/api/memory/conflicts/${encodeURIComponent(id)}/resolve`, projectId, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  })
}

export async function listSpecs(projectId: string): Promise<SpecItem[]> {
  const rows = await request<
    Array<{
      id: string
      taskId: string
      title: string
      status: SpecItem['status']
      clarify: SpecItem['clarify']
      lintStatus: SpecItem['lintStatus']
      lintFindings: number
      deltaIssues: number
      criteria: SpecItem['criteria']
      createdAt: string
    }>
  >('/api/specs', projectId)
  return rows
}

export async function approveSpec(projectId: string, id: string): Promise<void> {
  await request(`/api/specs/${encodeURIComponent(id)}/approve`, projectId, { method: 'POST' })
}
export async function lintSpec(projectId: string, id: string): Promise<void> {
  await request(`/api/specs/${encodeURIComponent(id)}/lint`, projectId)
}
export async function draftSpec(
  projectId: string,
  taskId: string,
  description: string,
): Promise<void> {
  await request('/api/specs/draft', projectId, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ taskId, description }),
  })
}

export async function listSkills(projectId: string): Promise<SkillItem[]> {
  const rows = await request<Array<SkillItem>>('/api/skills', projectId)
  return rows.map((row) => ({ ...row, usageRuns: row.usageRuns ?? 0 }))
}
export async function compileSkill(projectId: string, id: string): Promise<{ paths: string[] }> {
  return request(`/api/skills/${encodeURIComponent(id)}/build`, projectId, { method: 'POST' })
}

export async function listInstincts(projectId: string): Promise<InstinctItem[]> {
  const rows = await request<Array<InstinctItem & { createdAt: string }>>(
    '/api/instincts',
    projectId,
  )
  return rows.map((row) => ({ ...row, usagesCount: row.usagesCount ?? 0 }))
}
export async function approveInstinct(projectId: string, id: string): Promise<void> {
  await request(`/api/instincts/${encodeURIComponent(id)}/approve`, projectId, { method: 'POST' })
}
export async function rejectInstinct(projectId: string, id: string): Promise<void> {
  await request(`/api/instincts/${encodeURIComponent(id)}/reject`, projectId, { method: 'POST' })
}
export async function addInstinct(
  projectId: string,
  trigger: string,
  action: string,
): Promise<void> {
  await request('/api/instincts', projectId, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trigger, action }),
  })
}

export async function explainTask(
  projectId: string,
  taskId: string,
): Promise<Record<string, unknown>> {
  const result = await request<Record<string, unknown>>(
    `/api/tasks/${encodeURIComponent(taskId)}/explain`,
    projectId,
  )
  return result
}

export type { TaskItem }
