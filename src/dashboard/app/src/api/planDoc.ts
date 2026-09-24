export interface PlanDocItem {
  checked: boolean
  text: string
  depth: number
}

export interface PlanDocSection {
  title: string
  level: number
  items: PlanDocItem[]
  text: string
}

export interface PlanDocResponse {
  exists: boolean
  sections: PlanDocSection[]
}

export async function getPlanDoc(projectId: string): Promise<PlanDocResponse> {
  const response = await fetch('/api/plan/doc', {
    headers: { 'x-orchestos-project-id': projectId },
  })
  const body = (await response.json().catch(() => null)) as
    | PlanDocResponse
    | { error?: string }
    | null
  if (!response.ok)
    throw new Error(
      (body as { error?: string } | null)?.error ?? `Request failed (${response.status})`,
    )
  return body as PlanDocResponse
}
