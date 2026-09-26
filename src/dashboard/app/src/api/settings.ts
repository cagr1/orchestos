import type { ChatModelOption } from './chat'

export interface SettingsKeyInfo {
  set: boolean
  masked: string
}

export type SettingsResponse = Record<string, SettingsKeyInfo>

export interface SetupItem {
  id: string
  label: string
  ok: boolean
  critical: boolean
  kind: string
  hint: string
  actionLabel?: string
  action?: string
}

export interface SetupResponse {
  ready: boolean
  criticalMissing: boolean
  envFile: string
  cwd: string
  items: SetupItem[]
}

export interface HealthResponse {
  system: SetupResponse
  blockedTasks: Array<{ id: string; description: string; retryCount: number }>
  pendingApproval: { unverifiedInstincts: number; draftSpecs: number }
  costLast7d: number
  recentLearnings: Array<{ id: string; trigger: string; action: string; createdAt: string }>
  attentionCount: number
}

export interface LocalProviderResponse {
  available: boolean
  models: Array<{ id: string; size: string }>
}

export interface ExecutorMode {
  id: string
  detected: boolean
  path: string | null
}

export interface ExecutorModesResponse {
  modes: ExecutorMode[]
  selected: string | null
}

export interface UsageRow {
  date: string
  model: string
  provider?: string
  usd: number
  runs: number
  inputTokens: number
  outputTokens: number
}

export interface UsageResponse {
  byDayModel: UsageRow[]
  totalUsd: number
  totalRuns: number
}

export interface ConfigResponse {
  source: string | null
  configFound: boolean
  roles: {
    planner: string
    executor_heavy: string
    executor_light: string
    default: string
    qa: string | null
  }
  pendingRouting: Array<{ id: string; model: string; executor: string }>
  apiMode: 'single-shot' | 'agentic'
  agent: string | null
  agenticMaxIterations: number
  externalTimeoutMinutes: number
  claudeCliDetected: boolean
  roleAssignments?: Record<string, { agent: string; model: string; effort?: string } | null>
}

const CONFIG_ROLE_KEYS = ['planner', 'executor_heavy', 'executor_light', 'default', 'qa'] as const

export function stripOpenrouterPrefix(value: string): string {
  return value.replace(/^openrouter\//, '')
}

export function mapConfigResponse(response: ConfigResponse): ConfigResponse {
  return {
    ...response,
    roles: {
      ...response.roles,
      ...Object.fromEntries(
        CONFIG_ROLE_KEYS.filter((key) => response.roles[key] !== null).map((key) => [
          key,
          response.roles[key] === null ? null : stripOpenrouterPrefix(response.roles[key]),
        ]),
      ),
    },
  } as ConfigResponse
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init)
  const body = (await response.json().catch(() => null)) as { error?: string } | T | null
  if (!response.ok) {
    const message =
      body && typeof body === 'object' && body && 'error' in body ? body.error : undefined
    throw new Error(message || `Request failed (${response.status})`)
  }
  return body as T
}

function jsonInit(method: string, body: unknown): RequestInit {
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
}

export function mapSettingsKeys(response: SettingsResponse) {
  return {
    openrouter: response.OPENROUTER_API_KEY ?? { set: false, masked: '' },
    anthropic: response.ANTHROPIC_API_KEY ?? { set: false, masked: '' },
    openai: response.OPENAI_API_KEY ?? { set: false, masked: '' },
    ollama: response._ollama ?? { set: false, masked: '' },
  }
}

export function mapUsageByModel(response: UsageResponse) {
  const rows = new Map<
    string,
    { model: string; provider?: string; runs: number; tokens: number; spend: number }
  >()
  for (const item of response.byDayModel) {
    const key = `${item.provider ?? ''}\u0000${item.model}`
    const row = rows.get(key) ?? {
      model: item.model,
      ...(item.provider ? { provider: item.provider } : {}),
      runs: 0,
      tokens: 0,
      spend: 0,
    }
    row.runs += item.runs
    row.tokens += item.inputTokens + item.outputTokens
    row.spend += item.usd
    rows.set(key, row)
  }
  return [...rows.values()].sort((a, b) => b.spend - a.spend)
}

export async function getSettings(): Promise<SettingsResponse> {
  return request('/api/settings')
}
export async function getSetup(): Promise<SetupResponse> {
  return request('/api/setup')
}
export async function getHealth(): Promise<HealthResponse> {
  return request('/api/health')
}
export async function getLocalProvider(): Promise<LocalProviderResponse> {
  return request('/api/providers/local')
}
export async function getExecutorModes(): Promise<ExecutorModesResponse> {
  return request('/api/system/executor-modes')
}
export async function getUsage(): Promise<UsageResponse> {
  return request('/api/usage')
}
export async function getConfig(projectId?: string, signal?: AbortSignal): Promise<ConfigResponse> {
  return mapConfigResponse(
    await request<ConfigResponse>('/api/config', {
      ...(projectId ? { headers: { 'x-orchestos-project-id': projectId } } : {}),
      signal,
    }),
  )
}
export async function getModels(): Promise<ChatModelOption[]> {
  return request('/api/chat/models')
}

export async function saveSettings(values: Record<string, string>): Promise<void> {
  await request('/api/settings', jsonInit('POST', values))
}

export async function saveApiKey(
  provider: 'openrouter' | 'anthropic' | 'openai',
  key: string,
): Promise<void> {
  const result = await request<{ valid: boolean; error?: string }>(
    '/api/setup/api-key',
    jsonInit('POST', { provider, key }),
  )
  if (!result.valid) throw new Error(result.error || 'The provider rejected the key')
}

export async function saveConfig(body: Record<string, unknown>, projectId?: string): Promise<void> {
  // Roles ya vienen sin el `openrouter/` del GET (getConfig) y los del catálogo son ids tal cual
  // (`openrouter/auto` incluido): el server antepone el provider, así que se envían sin tocar.
  const init = jsonInit('PUT', body)
  if (projectId) init.headers = { ...init.headers, 'x-orchestos-project-id': projectId }
  await request('/api/config', init)
}

export async function resetSystem(): Promise<void> {
  await request('/api/system/reset', jsonInit('POST', { confirm: true }))
}
