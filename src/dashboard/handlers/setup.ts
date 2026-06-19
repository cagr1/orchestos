import { resolve, join } from 'path'
import { existsSync } from 'fs'
import { homedir } from 'os'
import { getProject } from '../../db/projects.ts'
import { db } from '../../db/sqlite.ts'
import { listInstincts } from '../../instincts/store.ts'
import { listSpecs } from '../../spec/store.ts'
import { loadTasks } from '../../tasks/loader.ts'
import type { SetupItem, SetupResponse, LocalProviderResponse, ApiKeyValidationResponse, HealthResponse, HealthBlockedTask, HealthRecentLearning } from '../types.ts'
import { ENV_FILE, SETTINGS_KEYS, readEnv, writeEnv, maskKey } from '../settings-store.ts'
import { jsonResponse, errorResponse } from '../http.ts'

async function handleApiSettingsGet(): Promise<Response> {
  const parsed = readEnv()
  const result: Record<string, { set: boolean; masked: string }> = {}
  for (const k of SETTINGS_KEYS) {
    const v = parsed[k] ?? process.env[k] ?? ''
    result[k] = { set: !!v, masked: v ? maskKey(v) : '' }
  }
  result['_envFile'] = { set: existsSync(ENV_FILE), masked: ENV_FILE }
  result['_cwd'] = { set: true, masked: process.cwd() }

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 1000)
    const res = await fetch('http://localhost:11434/api/tags', { signal: controller.signal })
    clearTimeout(timer)
    if (res.ok) {
      const data = await res.json() as { models?: { name: string }[] }
      const count = (data.models || []).length
      result['_ollama'] = { set: true, masked: `localhost:11434 — ${count} model${count !== 1 ? 's' : ''} detected` }
    } else {
      result['_ollama'] = { set: false, masked: '' }
    }
  } catch {
    result['_ollama'] = { set: false, masked: '' }
  }

  return jsonResponse(result)
}

function handleApiSetup(): Response {
  const root = resolve('.')
  const dbPath = join(homedir(), '.orchestos', 'db.sqlite')
  const env = readEnv()
  const items: SetupItem[] = []

  const bunVersion = (globalThis as any).Bun?.version ?? ''
  items.push({
    id: 'bun',
    label: bunVersion ? `Bun ${bunVersion}` : 'Bun not found',
    ok: !!bunVersion,
    critical: true,
    kind: 'runtime',
    hint: bunVersion ? 'Runtime is available.' : 'Install Bun, then reopen this dashboard.',
    action: bunVersion ? undefined : 'copy-command',
    actionLabel: bunVersion ? undefined : 'Copy install command',
    command: bunVersion ? undefined : 'powershell -c "irm bun.sh/install.ps1 | iex"',
  })

  const hasLock = existsSync(join(root, 'bun.lock')) || existsSync(join(root, 'bun.lockb'))
  const hasMods = existsSync(join(root, 'node_modules'))
  items.push({
    id: 'dependencies',
    label: hasLock && hasMods ? 'Dependencies installed' : hasLock ? 'node_modules missing' : 'bun.lock missing',
    ok: hasLock && hasMods,
    critical: false,
    kind: 'dependency',
    hint: hasLock
      ? (hasMods ? 'Project dependencies are installed.' : 'Run bun install in the project directory.')
      : `Current directory may be wrong: ${root}`,
    action: hasLock && hasMods ? undefined : 'copy-command',
    actionLabel: hasLock && hasMods ? undefined : 'Copy command',
    command: hasLock ? 'bun install' : undefined,
  })

  const openRouter = env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY || ''
  items.push({
    id: 'openrouter-key',
    label: openRouter ? 'OPENROUTER_API_KEY configured' : 'OPENROUTER_API_KEY missing',
    ok: !!openRouter,
    critical: true,
    kind: 'credential',
    hint: openRouter ? 'The primary LLM gateway is ready.' : 'Add an OpenRouter key to start using the agent.',
    action: openRouter ? undefined : 'open-wizard',
    actionLabel: openRouter ? undefined : 'Configure now',
  })

  const anthropic = env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY || ''
  items.push({
    id: 'anthropic-key',
    label: anthropic ? 'ANTHROPIC_API_KEY configured' : 'ANTHROPIC_API_KEY optional',
    ok: !!anthropic,
    critical: false,
    kind: 'credential',
    hint: anthropic ? 'Direct Claude executor is available.' : 'Optional. Add it if you want direct Anthropic executor support.',
    action: anthropic ? undefined : 'save-settings',
    actionLabel: anthropic ? undefined : 'Add optional key',
  })

  const openai = env.OPENAI_API_KEY || process.env.OPENAI_API_KEY || ''
  items.push({
    id: 'openai-key',
    label: openai ? 'OPENAI_API_KEY configured' : 'OPENAI_API_KEY optional',
    ok: !!openai,
    critical: false,
    kind: 'credential',
    hint: openai ? 'OpenAI embeddings are available.' : 'Optional. Add it if you want OpenAI embeddings.',
    action: openai ? undefined : 'save-settings',
    actionLabel: openai ? undefined : 'Add optional key',
  })

  const hasTasks = existsSync(join(root, 'tasks.yaml'))
  items.push({
    id: 'tasks-yaml',
    label: hasTasks ? 'tasks.yaml found' : 'tasks.yaml missing',
    ok: hasTasks,
    critical: true,
    kind: 'project',
    hint: hasTasks ? 'The project task file is ready.' : 'Create the task file in this project directory.',
    action: hasTasks ? undefined : 'copy-command',
    actionLabel: hasTasks ? undefined : 'Copy command',
    command: hasTasks ? undefined : 'orchestos task init',
  })

  const hasDb = existsSync(dbPath)
  items.push({
    id: 'db',
    label: hasDb ? 'SQLite database initialized' : 'SQLite database not initialized',
    ok: hasDb,
    critical: false,
    kind: 'database',
    hint: hasDb ? 'Local persistence is available.' : 'It is created automatically when OrchestOS runs.',
  })

  let indexed = false
  try { indexed = !!getProject(root) } catch {}
  items.push({
    id: 'code-graph',
    label: indexed ? 'Project indexed in code graph' : 'Project not indexed',
    ok: indexed,
    critical: false,
    kind: 'index',
    hint: indexed ? 'Context suggestions can use the code graph.' : 'Index the project for better context suggestions.',
    action: indexed ? undefined : 'copy-command',
    actionLabel: indexed ? undefined : 'Copy command',
    command: indexed ? undefined : `orchestos index "${root}"`,
  })

  const criticalMissing = items.some(i => i.critical && !i.ok)
  const result: SetupResponse = {
    ready: !criticalMissing,
    criticalMissing,
    envFile: ENV_FILE,
    cwd: root,
    items,
  }
  return jsonResponse(result)
}

async function handleApiSettingsPost(req: Request): Promise<Response> {
  let body: Record<string, string>
  try { body = (await req.json()) as Record<string, string> } catch { return errorResponse('Invalid JSON', 400) }
  const current = readEnv()
  for (const k of SETTINGS_KEYS) {
    const v = body[k]
    if (v !== undefined && v !== '' && !v.includes('••')) {
      current[k] = v
    } else if (v === '' && current[k]) {
      delete current[k]
    }
  }
  try {
    writeEnv(current)
    return jsonResponse({ ok: true })
  } catch (e: any) {
    return errorResponse(`Failed to write settings: ${e.message}`, 500)
  }
}

function handleApiHealth(): Response {
  const root = resolve('.')

  const system = (() => {
    const dbPath = join(homedir(), '.orchestos', 'db.sqlite')
    const env = readEnv()
    const items: SetupItem[] = []
    const bunVersion = (globalThis as any).Bun?.version ?? ''
    items.push({ id: 'bun', label: bunVersion ? `Bun ${bunVersion}` : 'Bun not found', ok: !!bunVersion, critical: true, kind: 'runtime', hint: bunVersion ? 'Runtime is available.' : 'Install Bun.' })
    const hasLock = existsSync(join(root, 'bun.lock')) || existsSync(join(root, 'bun.lockb'))
    const hasMods = existsSync(join(root, 'node_modules'))
    items.push({ id: 'dependencies', label: hasLock && hasMods ? 'Dependencies installed' : 'Dependencies missing', ok: hasLock && hasMods, critical: false, kind: 'dependency', hint: hasLock && hasMods ? 'OK' : 'Run bun install.' })
    const openRouter = env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY || ''
    items.push({ id: 'openrouter-key', label: openRouter ? 'OPENROUTER_API_KEY configured' : 'OPENROUTER_API_KEY missing', ok: !!openRouter, critical: true, kind: 'credential', hint: openRouter ? 'OK' : 'Add an API key in Settings.' })
    const hasTasks = existsSync(join(root, 'tasks.yaml'))
    items.push({ id: 'tasks-yaml', label: hasTasks ? 'tasks.yaml found' : 'tasks.yaml missing', ok: hasTasks, critical: true, kind: 'project', hint: hasTasks ? 'OK' : 'Run: orchestos task init' })
    const hasDb = existsSync(dbPath)
    items.push({ id: 'db', label: hasDb ? 'SQLite initialized' : 'SQLite not initialized', ok: hasDb, critical: false, kind: 'database', hint: hasDb ? 'OK' : 'Created automatically on first run.' })
    const criticalMissing = items.some(i => i.critical && !i.ok)
    return { ready: !criticalMissing, criticalMissing, envFile: ENV_FILE, cwd: root, items }
  })()

  const blockedTasks: HealthBlockedTask[] = []
  try {
    if (existsSync(join(root, 'tasks.yaml'))) {
      const file = loadTasks(root)
      for (const t of file.tasks as any[]) {
        if (t.status === 'failed_permanent') {
          blockedTasks.push({ id: t.id, description: t.description, retryCount: t.retry_count ?? 0 })
        }
      }
    }
  } catch {}

  const unverifiedInstincts = listInstincts({ verified: false }).length
  let draftSpecs = 0
  try {
    draftSpecs = listSpecs(root, false).filter(s => s.frontmatter.status === 'draft').length
  } catch {}

  let costLast7d = 0
  try {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const row = db.query<{ total: number }, string>(
      "SELECT COALESCE(SUM(usd_cost), 0) AS total FROM runs WHERE created_at >= ?"
    ).get(cutoff)
    costLast7d = row?.total ?? 0
  } catch {}

  const recentLearnings: HealthRecentLearning[] = listInstincts({ source: 'auto', verified: true })
    .slice(0, 3)
    .map(i => ({ id: i.id, trigger: i.trigger, action: i.action, createdAt: i.created_at }))

  const attentionCount = blockedTasks.length + unverifiedInstincts + draftSpecs

  const body: HealthResponse = {
    system,
    blockedTasks,
    pendingApproval: { unverifiedInstincts, draftSpecs },
    costLast7d,
    recentLearnings,
    attentionCount,
  }
  return jsonResponse(body)
}

const PROVIDER_CONFIGS: Record<string, {
  envKey: string
  testUrl: string
  headers: (key: string) => Record<string, string>
  body: string
}> = {
  openrouter: {
    envKey: 'OPENROUTER_API_KEY',
    testUrl: 'https://openrouter.ai/api/v1/chat/completions',
    headers: (key) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
      'HTTP-Referer': 'https://github.com/cagr1/orchestos',
      'X-Title': 'orchestos',
    }),
    body: JSON.stringify({ model: 'deepseek/deepseek-v4-flash', messages: [{ role: 'user', content: 'ping' }], max_tokens: 1 }),
  },
  anthropic: {
    envKey: 'ANTHROPIC_API_KEY',
    testUrl: 'https://api.anthropic.com/v1/messages',
    headers: (key) => ({
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    }),
    body: JSON.stringify({ model: 'claude-haiku-4-5', max_tokens: 1, messages: [{ role: 'user', content: 'ping' }] }),
  },
  openai: {
    envKey: 'OPENAI_API_KEY',
    testUrl: 'https://api.openai.com/v1/chat/completions',
    headers: (key) => ({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    }),
    body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'ping' }], max_tokens: 1 }),
  },
}

function humanizeKeyError(status: number, body: string): string {
  if (status === 401) return 'La clave no es válida. Cópiala de nuevo desde el sitio.'
  if (status === 402 || body.includes('insufficient') || body.includes('credit'))
    return 'La clave es válida pero no tiene crédito. Recarga tu cuenta.'
  if (status >= 500) return 'El servicio no responde en este momento. Espera unos minutos.'
  return `Error del proveedor (${status}). Verifica que la clave sea correcta.`
}

async function handleApiSetupApiKey(req: Request): Promise<Response> {
  let body: { provider?: string; key?: string }
  try { body = (await req.json()) as { provider?: string; key?: string } } catch {
    return errorResponse('Invalid JSON', 400)
  }

  const provider = (body.provider || '').trim().toLowerCase()
  const key = (body.key || '').trim()

  if (!key) return errorResponse('key is required', 400)
  const cfg = PROVIDER_CONFIGS[provider]
  if (!cfg) {
    return errorResponse(`Unknown provider "${provider}". Use: openrouter, anthropic, openai`, 400)
  }

  const current = readEnv()
  current[cfg.envKey] = key
  writeEnv(current)

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15_000)
    const res = await fetch(cfg.testUrl, {
      method: 'POST',
      headers: cfg.headers(key),
      body: cfg.body,
      signal: controller.signal,
    })
    clearTimeout(timer)

    if (res.ok || res.status === 400) {
      return jsonResponse({ valid: true } satisfies ApiKeyValidationResponse)
    }

    const errBody = await res.text().catch(() => '')
    const errMsg = humanizeKeyError(res.status, errBody)

    if (res.status === 401) {
      delete current[cfg.envKey]
      writeEnv(current)
    }

    return jsonResponse({ valid: false, error: errMsg } satisfies ApiKeyValidationResponse)
  } catch (e: any) {
    const isTimeout = e?.name === 'AbortError' || e?.message?.includes('abort')
    const errMsg = isTimeout
      ? 'No hubo respuesta. Verifica tu conexión e inténtalo de nuevo.'
      : 'No se pudo conectar con el proveedor. Verifica tu conexión.'
    return jsonResponse({ valid: false, error: errMsg } satisfies ApiKeyValidationResponse)
  }
}

async function handleApiProvidersLocal(): Promise<Response> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 1000)
    const res = await fetch('http://localhost:11434/api/tags', {
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (!res.ok) {
      return jsonResponse({ available: false, models: [] } satisfies LocalProviderResponse)
    }
    const data = await res.json() as { models?: { name: string; size?: number }[] }
    const models = (data.models || []).map(m => ({
      id: `ollama/${m.name}`,
      size: m.size != null ? formatSize(m.size) : 'unknown',
    }))
    return jsonResponse({ available: models.length > 0, models } satisfies LocalProviderResponse)
  } catch {
    return jsonResponse({ available: false, models: [] } satisfies LocalProviderResponse)
  }
}

function formatSize(bytes: number): string {
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(0)} MB`
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`
}

export { handleApiSettingsGet, handleApiSetup, handleApiSettingsPost, handleApiHealth, handleApiSetupApiKey, handleApiProvidersLocal }
