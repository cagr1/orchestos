import { resolve, join, extname, sep } from 'path'
import { existsSync, readFileSync, writeFileSync, realpathSync, mkdirSync } from 'fs'
import { homedir } from 'os'
import { chat as openrouterChat } from '../providers/openrouter.ts'
import { loadContext } from '../context/load.ts'
import { getProject } from '../db/projects.ts'
import { db } from '../db/sqlite.ts'
import { listRuns, getRun, type RunRecord } from '../db/runs.ts'
import { loadTasks, saveTasks } from '../tasks/loader.ts'
import { listInstincts, approveInstinct, deleteInstinct, insertInstinct } from '../instincts/store.ts'
import { listSpecs } from '../spec/store.ts'
import { lintSpec } from '../spec/lint.ts'
import { parseCostBreakdownJson } from '../run/transcript-parser.ts'
import type { MemoryEntry } from '../db/memory.ts'
import {
  type RunRow,
  type TaskRow,
  type InstinctRow,
  type SpecRow,
  type SpecLintStatus,
  type MutationResult,
  type CostBreakdownEntry,
  type ContextWarningEntry,
  type MemoryRow,
  type SetupItem,
  type SetupResponse,
  STATIC_DIR,
  DEFAULT_PORT,
} from './types.ts'

// ── Settings helpers ────────────────────────────────────────────────────────

const ENV_FILE = join(homedir(), '.orchestos', '.env')
const SETTINGS_KEYS = ['OPENROUTER_API_KEY', 'ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'OLLAMA_HOST'] as const

function parseEnvFile(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const line of text.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq < 1) continue
    out[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
  }
  return out
}

function maskKey(v: string): string {
  if (!v) return ''
  if (v.length <= 8) return '••••••••'
  return v.slice(0, 6) + '••••' + v.slice(-4)
}

function readEnv(): Record<string, string> {
  try {
    if (existsSync(ENV_FILE)) return parseEnvFile(readFileSync(ENV_FILE, 'utf-8'))
  } catch {}
  return {}
}

function writeEnv(data: Record<string, string>): void {
  mkdirSync(join(homedir(), '.orchestos'), { recursive: true })
  const content = Object.entries(data).map(([k, v]) => `${k}=${v}`).join('\n') + '\n'
  writeFileSync(ENV_FILE, content, 'utf-8')
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png':  'image/png',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
}

function mimeType(path: string): string {
  return MIME[extname(path)] ?? 'application/octet-stream'
}

// Resolved once at startup — safe base for containment checks
let STATIC_BASE_REAL: string
try { STATIC_BASE_REAL = realpathSync(STATIC_DIR) } catch { STATIC_BASE_REAL = STATIC_DIR }

function serveStatic(url: string): Response {
  // url is always an absolute path like '/' or '/runs' or '/runs.html'
  // Strip the leading slash to get a relative path safe for join()
  const rel = url === '/' ? 'index.html' : url.replace(/^\//, '')
  let candidate = join(STATIC_DIR, rel)

  if (!existsSync(candidate) && !extname(rel)) {
    candidate = join(STATIC_DIR, rel + '.html')
  }
  if (!existsSync(candidate)) {
    return new Response('Not found', { status: 404 })
  }

  let real: string
  try { real = realpathSync(candidate) } catch {
    return new Response('Not found', { status: 404 })
  }
  if (real !== STATIC_BASE_REAL && !real.startsWith(STATIC_BASE_REAL + sep)) {
    return new Response('Forbidden', { status: 403 })
  }

  const content = readFileSync(real)
  return new Response(content, {
    headers: { 'Content-Type': mimeType(real) },
  })
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function errorResponse(msg: string, status: number): Response {
  return jsonResponse({ error: msg }, status)
}

// ── Route handlers ──────────────────────────────────────────────────────────

function parseContextWarnings(raw: string | null | undefined): ContextWarningEntry[] {
  if (!raw) return []
  try {
    return JSON.parse(raw) as ContextWarningEntry[]
  } catch {
    return []
  }
}

function runRecordToRow(r: RunRecord): RunRow {
  return {
    id: r.id,
    taskId: r.task_id,
    status: r.status,
    qaVerdict: r.qa_verdict as 'pass' | 'fail' | null,
    model: r.model,
    provider: r.provider,
    skillId: r.skill_id,
    inputTokens: r.input_tokens,
    outputTokens: r.output_tokens,
    costUsd: r.usd_cost,
    costBreakdown: parseCostBreakdownJson(r.cost_breakdown_json),
    contextWarnings: parseContextWarnings(r.context_warnings_json),
    elapsedMs: r.elapsed_ms,
    createdAt: r.created_at,
  }
}

function handleApiRuns(url: URL): Response {
  if (url.pathname.startsWith('/api/runs/')) {
    const id = url.pathname.slice('/api/runs/'.length)
    if (!id) return errorResponse('Missing run id', 400)
    const r = getRun(id)
    if (!r) return errorResponse('Run not found', 404)
    return jsonResponse(runRecordToRow(r))
  }
  const limit = url.searchParams.get('limit')
  const rows = listRuns(limit ? parseInt(limit) : 50)
  return jsonResponse(rows.map(runRecordToRow))
}

function handleApiTasks(): Response {
  const root = resolve('.')
  if (!existsSync(join(root, 'tasks.yaml'))) {
    return jsonResponse([] as TaskRow[])
  }
  try {
    const file = loadTasks(root)
    const rows: TaskRow[] = file.tasks.map(t => ({
      id: t.id,
      description: t.description,
      status: t.status,
      skill: t.skill ?? null,
      executor: t.executor,
      retryCount: t.retry_count,
      qaVerdict: t.qa_verdict ?? null,
      runId: t.run_id ?? null,
    }))
    return jsonResponse(rows)
  } catch {
    return jsonResponse([] as TaskRow[])
  }
}

function handleApiInstincts(): Response {
  const all = listInstincts()
  const rows: InstinctRow[] = all.map(i => ({
    id: i.id,
    trigger: i.trigger,
    action: i.action,
    confidence: i.confidence,
    source: i.source,
    verified: i.verified,
    createdAt: i.created_at,
  }))
  return jsonResponse(rows)
}

function handleApiInstinctsApprove(url: URL): Response {
  const parts = url.pathname.split('/')
  const id = parts[3]
  if (!id) return errorResponse('Missing instinct id', 400)
  const ok = approveInstinct(id)
  const result: MutationResult = ok ? { ok: true } : { ok: false, error: 'Instinct not found' }
  return jsonResponse(result, ok ? 200 : 404)
}

function handleApiInstinctsReject(url: URL): Response {
  const parts = url.pathname.split('/')
  const id = parts[3]
  if (!id) return errorResponse('Missing instinct id', 400)
  const ok = deleteInstinct(id)
  const result: MutationResult = ok ? { ok: true } : { ok: false, error: 'Instinct not found' }
  return jsonResponse(result, ok ? 200 : 404)
}

const TASK_ID_RE = /^[A-Za-z0-9_.-]{1,64}$/

function validateTaskId(id: string): string | null {
  const t = id.trim()
  if (!t || !TASK_ID_RE.test(t) || t.startsWith('-')) return null
  return t
}

async function handleApiSpecsDraft(req: Request): Promise<Response> {
  let body: { taskId: string; description: string }
  try { body = (await req.json()) as { taskId: string; description: string } } catch { return errorResponse('Invalid JSON', 400) }
  const taskId = validateTaskId(body.taskId ?? '')
  if (!taskId || !body.description?.trim()) {
    return errorResponse('taskId (alphanumeric/hyphen/dot, max 64) and description are required', 400)
  }
  const root = resolve('.')
  Bun.spawn(
    [process.execPath, 'run', join(root, 'src/cli.ts'), 'spec', 'draft',
     '--description', body.description.trim(), '--', taskId],
    { cwd: root, stdout: 'inherit', stderr: 'inherit' }
  )
  return jsonResponse({ ok: true, taskId })
}

async function handleApiChatModels(): Promise<Response> {
  const apiKey = (() => {
    try { return readEnv()['OPENROUTER_API_KEY'] || process.env.OPENROUTER_API_KEY || '' } catch { return '' }
  })()
  if (!apiKey) return errorResponse('OPENROUTER_API_KEY not set', 400)

  try {
    const res = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    })
    if (!res.ok) return errorResponse(`OpenRouter error ${res.status}`, 502)
    const data = await res.json() as { data: { id: string; name: string; context_length: number; pricing: { prompt: string } }[] }
    const models = (data.data || [])
      .filter(m => m.pricing?.prompt !== undefined)
      .sort((a, b) => Number(a.pricing.prompt) - Number(b.pricing.prompt))
      .map(m => ({
        id: m.id,
        name: m.name,
        contextK: Math.round((m.context_length || 0) / 1000),
        priceIn: Number(m.pricing.prompt) * 1_000_000,
      }))
    return jsonResponse(models)
  } catch (e: any) {
    return errorResponse(`Failed to fetch models: ${e.message}`, 502)
  }
}

async function handleApiChat(req: Request): Promise<Response> {
  let body: { history: { role: string; content: string }[]; message: string }
  try { body = (await req.json()) as { history: { role: string; content: string }[]; message: string } } catch { return errorResponse('Invalid JSON', 400) }
  const message = body.message?.trim()
  if (!message) return errorResponse('message is required', 400)

  const history = Array.isArray(body.history) ? body.history.slice(-10) : []

  const root = resolve('.')
  const lines: string[] = []

  try {
    const file = loadTasks(root)
    const counts: Record<string, number> = { pending: 0, running: 0, done: 0, failed: 0 }
    for (const task of file.tasks as any[]) {
      const k = task.status === 'failed_permanent' ? 'failed' : task.status
      if (k in counts) { counts[k as string] = (counts[k as string] ?? 0) + 1 }
    }
    lines.push(`Tasks (${file.tasks.length} total — ${counts.pending} pending, ${counts.running} running, ${counts.done} done, ${counts.failed} failed):`)
    for (const task of file.tasks as any[]) {
      const qa = task.qa_verdict ? ` [qa:${task.qa_verdict}]` : ''
      const retries = task.retry_count > 0 ? ` [retries:${task.retry_count}]` : ''
      lines.push(`  - ${task.id} [${task.status}]${qa}${retries}: ${task.description}`)
    }
  } catch { /* no tasks.yaml */ }

  try {
    const recentRuns = listRuns(10)
    if (recentRuns.length > 0) {
      const totalCost = recentRuns.reduce((s, r) => s + Number(r.usd_cost), 0)
      lines.push(`\nRecent runs (last ${recentRuns.length}, total cost $${totalCost.toFixed(4)}):`)
      for (const r of recentRuns) {
        const qa = r.qa_verdict ? ` qa:${r.qa_verdict}` : ''
        lines.push(`  - ${r.task_id || r.id} | ${r.status}${qa} | ${r.model} | $${Number(r.usd_cost).toFixed(4)} | ${(r.created_at || '').slice(0, 16)}`)
      }
    }
  } catch { /* db not ready */ }

  try {
    const memRows = db.query<MemoryEntry, []>(
      'SELECT topic_key, scope, content FROM memory_entries ORDER BY updated_at DESC LIMIT 20'
    ).all()
    if (memRows.length > 0) {
      lines.push(`\nMemory (${memRows.length} entries):`)
      for (const m of memRows) {
        lines.push(`  - [${m.scope}] ${m.topic_key}: ${m.content.slice(0, 120)}`)
      }
    }
  } catch { /* memory not ready */ }

  try {
    const specs = listSpecs(root, true)
    if (specs.length > 0) {
      lines.push(`\nSpecs (${specs.length}):`)
      for (const s of specs) {
        lines.push(`  - ${s.frontmatter.id} [${s.frontmatter.status}]`)
      }
    }
  } catch { /* no specs */ }

  const projectCtx = loadContext(root)

  const ctx = lines.length ? `\nProject state:\n${lines.join('\n')}\n` : ''
  const projBlock = projectCtx ? `\nProject context:\n${projectCtx}\n` : ''
  const model = (body as any).model?.trim() || 'deepseek/deepseek-v4-flash'

  const systemPrompt = `You are the assistant of OrchestOS, an AI agent orchestrator. Answer questions about the project state, tasks, runs, memory, specs, and the system. Be concise and direct. If the user writes in Spanish, respond in Spanish.

You are running as model: ${model} via OpenRouter.

Important: you cannot modify files or run code directly from this chat. However, OrchestOS CAN improve itself — the user can create a Task describing the improvement, and the agent executor will modify the codebase autonomously. That is the correct way to self-improve: Tasks → agent runs → code changes.${ctx}${projBlock}`

  const messages = history
    .filter(h => h.role === 'user' || h.role === 'assistant')
    .map(h => ({ role: h.role as 'user' | 'assistant', content: String(h.content) }))
  messages.push({ role: 'user', content: message })

  try {
    const resp = await openrouterChat({
      model,
      system: systemPrompt,
      messages,
    })
    return jsonResponse({ text: resp.text, model: resp.model })
  } catch (e: any) {
    return errorResponse(`Chat failed: ${e.message}`, 502)
  }
}

async function handleApiNatural(req: Request): Promise<Response> {
  let body: { input: string }
  try { body = (await req.json()) as { input: string } } catch { return errorResponse('Invalid JSON', 400) }
  const input = body.input?.trim()
  if (!input) return errorResponse('input is required', 400)

  const root = resolve('.')
  const projectCtx = loadContext(root)
  let tasksSummary = ''
  try {
    const file = loadTasks(root)
    tasksSummary = (file.tasks as any[]).slice(0, 15)
      .map((t: any) => `- ${t.id}: ${t.description}`)
      .join('\n')
  } catch { /* no tasks.yaml yet */ }

  const systemPrompt = `Eres un asistente que convierte instrucciones en lenguaje natural en definiciones de tareas para el orquestador OrchestOS.

Dado lo que el usuario quiere hacer, devuelve ÚNICAMENTE un objeto JSON con exactamente estas claves:
- "id": slug kebab-case de 3-5 palabras que describe la tarea (sin números al final, sin caracteres especiales)
- "description": descripción clara de la tarea en 1-2 frases
- "output": array de rutas de archivos que probablemente se crearán o modificarán (puede estar vacío si no es claro)
- "executor": uno de "openrouter" (por defecto), "anthropic" (tareas complejas de código), "openai" (embeddings/análisis)

${projectCtx ? `Contexto del proyecto:\n${projectCtx}\n` : ''}
${tasksSummary ? `Tareas existentes (para evitar duplicados):\n${tasksSummary}\n` : ''}

Responde SOLO con el JSON, sin texto adicional ni bloques de código.`

  try {
    const resp = await openrouterChat({
      model: 'anthropic/claude-haiku-4-5',
      system: systemPrompt,
      messages: [{ role: 'user', content: input }],
    })
    // extract JSON — strip markdown code fences if present
    const raw = resp.text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    const draft = JSON.parse(raw) as { id: string; description: string; output: string[]; executor: string }
    // sanitise id
    draft.id = (draft.id || '').toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 64) || 'nueva-tarea'
    if (!Array.isArray(draft.output)) draft.output = []
    if (!['openrouter', 'anthropic', 'openai'].includes(draft.executor)) draft.executor = 'openrouter'
    return jsonResponse(draft)
  } catch (e: any) {
    return errorResponse(`LLM draft failed: ${e.message}`, 502)
  }
}

function handleApiSpecs(): Response {
  const root = resolve('.')
  try {
    const specs = listSpecs(root, true)
    const rows: SpecRow[] = specs.map(s => {
      const caps = s.frontmatter.capabilities
      const lint = lintSpec(s)
      const lintStatus: SpecLintStatus = lint.findings.length === 0 ? 'pass' : 'fail'
      return {
        id: s.frontmatter.id,
        status: s.frontmatter.status,
        clarify: s.frontmatter.clarify,
        lintStatus,
        lintFindings: lint.freeFormCount,
        deltaIssues: lint.deltaIssuesCount,
        hasCapabilities: !!caps && (caps.added.length > 0 || caps.modified.length > 0 || caps.removed.length > 0),
        createdAt: s.frontmatter.createdAt,
      }
    })
    return jsonResponse(rows)
  } catch {
    return jsonResponse([] as SpecRow[])
  }
}

function handleApiSettingsGet(): Response {
  const parsed = readEnv()
  const result: Record<string, { set: boolean; masked: string }> = {}
  for (const k of SETTINGS_KEYS) {
    const v = parsed[k] ?? process.env[k] ?? ''
    result[k] = { set: !!v, masked: v ? maskKey(v) : '' }
  }
  result['_envFile'] = { set: existsSync(ENV_FILE), masked: ENV_FILE }
  result['_cwd'] = { set: true, masked: process.cwd() }
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
    hint: openRouter ? 'The primary LLM gateway is ready.' : `Paste an OpenRouter API key below. It will be stored in ${ENV_FILE}.`,
    action: openRouter ? undefined : 'save-settings',
    actionLabel: openRouter ? undefined : 'Save key',
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

async function handleApiInstinctsCreate(req: Request): Promise<Response> {
  let body: { trigger: string; action: string }
  try { body = (await req.json()) as { trigger: string; action: string } } catch { return errorResponse('Invalid JSON', 400) }
  if (!body.trigger?.trim() || !body.action?.trim()) {
    return errorResponse('trigger and action are required', 400)
  }
  try {
    const instinct = insertInstinct({
      trigger: body.trigger.trim().slice(0, 500),
      action: body.action.trim().slice(0, 500),
      confidence: 0.5,
      source: 'manual',
      verified: false,
    })
    return jsonResponse({ ok: true, id: instinct.id })
  } catch (e: any) {
    return errorResponse(e.message, 400)
  }
}

function descToTaskId(desc: string): string {
  return desc.trim().toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim().split(/\s+/).slice(0, 5).join('-') || 'task'
}

function inferExecutorFromModel(modelId: string | undefined): string {
  if (!modelId) return 'openrouter'
  if (/^claude-/.test(modelId)) return 'anthropic'
  if (/^(gpt-|o1-|o3-|text-)/.test(modelId)) return 'openai'
  return 'openrouter'
}

async function handleApiTasksCreate(req: Request): Promise<Response> {
  let body: { id?: string; description: string; output?: string[]; executor?: string; executor_model?: string }
  try { body = (await req.json()) as { id?: string; description: string; output?: string[]; executor?: string; executor_model?: string } } catch { return errorResponse('Invalid JSON', 400) }
  if (!body.description?.trim()) {
    return errorResponse('description is required', 400)
  }
  const description = body.description.trim()
  const id = body.id?.trim() || descToTaskId(description)
  const output = Array.isArray(body.output) ? body.output : []
  const executorModel = body.executor_model?.trim() || undefined
  const executor = body.executor || inferExecutorFromModel(executorModel)
  const root = resolve('.')
  if (!existsSync(join(root, 'tasks.yaml'))) {
    return errorResponse('tasks.yaml not found — run: orchestos task init', 404)
  }
  try {
    const file = loadTasks(root)
    let finalId = id
    if (file.tasks.find((t: any) => t.id === finalId)) {
      finalId = `${finalId}-${Date.now().toString(36)}`
    }
    const newTask: Record<string, unknown> = {
      id: finalId,
      description,
      output: output.map((f: string) => f.trim()).filter(Boolean),
      executor: executor || 'openrouter',
      status: 'pending',
      retry_count: 0,
    }
    if (executorModel) newTask.executor_model = executorModel
    ;(file.tasks as any[]).push(newTask)
    saveTasks(root, file)
    return jsonResponse({ ok: true, id: finalId })
  } catch (e: any) {
    return errorResponse(e.message, 500)
  }
}

function handleApiTasksRun(url: URL): Response {
  const raw = decodeURIComponent(url.pathname.split('/')[3] ?? '')
  const id = validateTaskId(raw)
  if (!id) return errorResponse('Missing or invalid task id', 400)
  const root = resolve('.')
  if (!existsSync(join(root, 'tasks.yaml'))) return errorResponse('tasks.yaml not found', 404)
  const file = loadTasks(root)
  const task = file.tasks.find((t: any) => t.id === id)
  if (!task) return errorResponse('Task not found', 404)
  Bun.spawn([process.execPath, 'run', join(root, 'src/cli.ts'), 'task', 'run', '--id', id], {
    cwd: root,
    stdout: 'inherit',
    stderr: 'inherit',
  })
  return jsonResponse({ ok: true, id })
}

function handleApiTasksDelete(url: URL): Response {
  const id = decodeURIComponent(url.pathname.split('/')[3] ?? '')
  if (!id) return errorResponse('Missing task id', 400)
  const root = resolve('.')
  if (!existsSync(join(root, 'tasks.yaml'))) return errorResponse('tasks.yaml not found', 404)
  try {
    const file = loadTasks(root)
    const before = file.tasks.length
    ;(file as any).tasks = file.tasks.filter((t: any) => t.id !== id)
    if (file.tasks.length === before) return errorResponse('Task not found', 404)
    saveTasks(root, file)
    return jsonResponse({ ok: true })
  } catch (e: any) {
    return errorResponse(e.message, 500)
  }
}

function handleApiMemory(): Response {
  try {
    const rows = db.query<MemoryEntry, []>(
      'SELECT id, project_id, topic_key, scope, content, created_at, updated_at FROM memory_entries ORDER BY updated_at DESC LIMIT 200'
    ).all()
    const result: MemoryRow[] = rows.map(m => ({
      id: m.id,
      projectId: m.project_id,
      topicKey: m.topic_key,
      scope: m.scope as MemoryRow['scope'],
      content: m.content,
      updatedAt: m.updated_at,
    }))
    return jsonResponse(result)
  } catch {
    return jsonResponse([] as MemoryRow[])
  }
}

// ── Router ──────────────────────────────────────────────────────────────────

function isSameOrigin(req: Request, port: number): boolean {
  const origin = req.headers.get('origin')
  if (!origin) return true  // same-origin requests (non-cross-origin) omit Origin
  try {
    const o = new URL(origin)
    return o.hostname === 'localhost' || o.hostname === '127.0.0.1'
  } catch {
    return false
  }
}

async function route(req: Request, port: number): Promise<Response> {
  const url = new URL(req.url)
  const method = req.method

  // CSRF guard: reject cross-origin POSTs/DELETEs
  if ((method === 'POST' || method === 'DELETE') && !isSameOrigin(req, port)) {
    return errorResponse('Forbidden', 403)
  }

  if (method === 'GET' && (url.pathname === '/api/runs' || url.pathname.startsWith('/api/runs/'))) {
    return handleApiRuns(url)
  }
  if (method === 'GET' && url.pathname === '/api/tasks') {
    return handleApiTasks()
  }
  if (method === 'POST' && url.pathname === '/api/tasks') {
    return handleApiTasksCreate(req)
  }
  if (method === 'POST' && url.pathname.match(/^\/api\/tasks\/[^/]+\/run$/)) {
    return handleApiTasksRun(url)
  }
  if (method === 'DELETE' && url.pathname.match(/^\/api\/tasks\/[^/]+$/)) {
    return handleApiTasksDelete(url)
  }
  if (method === 'GET' && url.pathname === '/api/instincts') {
    return handleApiInstincts()
  }
  if (method === 'POST' && url.pathname === '/api/instincts') {
    return handleApiInstinctsCreate(req)
  }
  if (method === 'POST' && url.pathname.match(/^\/api\/instincts\/([^/]+)\/approve$/)) {
    return handleApiInstinctsApprove(url)
  }
  if (method === 'POST' && url.pathname.match(/^\/api\/instincts\/([^/]+)\/reject$/)) {
    return handleApiInstinctsReject(url)
  }
  if (method === 'POST' && url.pathname === '/api/natural') {
    return handleApiNatural(req)
  }
  if (method === 'GET' && url.pathname === '/api/chat/models') {
    return handleApiChatModels()
  }
  if (method === 'POST' && url.pathname === '/api/chat') {
    return handleApiChat(req)
  }
  if (method === 'GET' && url.pathname === '/api/specs') {
    return handleApiSpecs()
  }
  if (method === 'POST' && url.pathname === '/api/specs/draft') {
    return handleApiSpecsDraft(req)
  }
  if (method === 'GET' && url.pathname === '/api/memory') {
    return handleApiMemory()
  }
  if (method === 'GET' && url.pathname === '/api/settings') {
    return handleApiSettingsGet()
  }
  if (method === 'GET' && url.pathname === '/api/setup') {
    return handleApiSetup()
  }
  if (method === 'POST' && url.pathname === '/api/settings') {
    return handleApiSettingsPost(req)
  }

  // Static files
  if (method === 'GET') {
    return serveStatic(url.pathname)
  }

  return errorResponse('Method not allowed', 405)
}

// ── Start server ────────────────────────────────────────────────────────────

export function startServer(port = DEFAULT_PORT): { server: any; url: string } {
  const server = Bun.serve({
    port,
    hostname: '127.0.0.1',   // refuse connections from other LAN hosts
    fetch: (req) => route(req, port),
  })
  const url = `http://localhost:${server.port}`
  console.log(`[dashboard] Server running at ${url}`)
  return { server, url }
}

// Allow direct execution: bun run src/dashboard/server.ts
if (import.meta.main) {
  const port = parseInt(process.env.PORT ?? String(DEFAULT_PORT))
  startServer(port)
}
