import { resolve, join, extname, sep } from 'path'
import { diagnoseTask } from '../agents/diagnose.ts'
import { existsSync, readFileSync, writeFileSync, realpathSync, mkdirSync, unlinkSync } from 'fs'
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
import { loadSkill, listSkillFiles, validateSkill, getSkillPath, type SkillDef } from '../skills/registry.ts'
import { compileSkill } from '../skills/compile.ts'
import { stringify } from 'yaml'
import {
  type ChatUploadResponse,
  type ChatFileType,
  type RunRow,
  type TaskRow,
  type InstinctRow,
  type SpecRow,
  type SpecLintStatus,
  type DiagnoseRow,
  type HealthResponse,
  type HealthBlockedTask,
  type HealthRecentLearning,
  type SkillRow,
  type SkillBuildResponse,
  type SkillCurateResponse,
  type MutationResult,
  type CostBreakdownEntry,
  type ContextWarningEntry,
  type MemoryRow,
  type SetupItem,
  type SetupResponse,
  type LocalProviderResponse,
  type ApiKeyValidationResponse,
  STATIC_DIR,
  DEFAULT_PORT,
} from './types.ts'

// ── In-memory file store (chat attachments) ─────────────────────────────────

const MAX_FILE_BYTES = 10 * 1024 * 1024  // 10 MB
const FILE_TTL_MS    = 30 * 60 * 1000    // 30 min

interface FileEntry {
  type: ChatFileType
  mimeType: string
  filename: string
  /** base64 data URI for images; plain text for text/pdf */
  content: string
  preview: string
  expiresAt: number
}

const fileStore = new Map<string, FileEntry>()

function pruneExpiredFiles(): void {
  const now = Date.now()
  for (const [id, entry] of fileStore) {
    if (entry.expiresAt < now) fileStore.delete(id)
  }
}

function randomId(): string {
  return crypto.randomUUID()
}

/** Extract readable text from a PDF buffer using regex (best-effort, no deps). */
function extractPdfText(buf: Buffer): string {
  const raw = buf.toString('latin1')
  const parts: string[] = []

  // Collect Tj strings: (text) Tj
  for (const m of raw.matchAll(/\(([^)\\]*(?:\\.[^)\\]*)*)\)\s*(?:Tj|'|")/g)) {
    const raw1 = m[1] ?? ''
    const s = raw1.replace(/\\n/g, '\n').replace(/\\r/g, '').replace(/\\\\/g, '\\').replace(/\\([()])/g, '$1')
    if (s.trim()) parts.push(s)
  }

  // Collect TJ arrays: [(text) -number (text)] TJ
  for (const m of raw.matchAll(/\[([^\]]+)\]\s*TJ/g)) {
    for (const sm of (m[1] ?? '').matchAll(/\(([^)\\]*(?:\\.[^)\\]*)*)\)/g)) {
      const raw1 = sm[1] ?? ''
      const s = raw1.replace(/\\n/g, '\n').replace(/\\\\/g, '\\').replace(/\\([()])/g, '$1')
      if (s.trim()) parts.push(s)
    }
  }

  const text = parts.join(' ').replace(/\s{2,}/g, ' ').trim()
  // Filter out non-printable / mostly-binary segments (font streams leak in)
  return text.replace(/[^\x09\x0A\x0D\x20-\x7E -￿]/g, '').trim()
}

async function handleApiChatUpload(req: Request): Promise<Response> {
  pruneExpiredFiles()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let formData: any
  try { formData = await req.formData() } catch { return errorResponse('Expected multipart/form-data', 400) }

  const file = formData.get('file') as File | null
  if (!file) return errorResponse('No file in form data', 400)
  if (file.size > MAX_FILE_BYTES) return errorResponse('File exceeds 10 MB limit', 413)

  const filename = file.name || 'upload'
  const mime = file.type || ''
  const buf = Buffer.from(await file.arrayBuffer())

  let type: ChatFileType
  let content: string
  let preview: string

  if (mime.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp)$/i.test(filename)) {
    type = 'image'
    content = `data:${mime || 'image/png'};base64,${buf.toString('base64')}`
    preview = mime || 'image'
  } else if (mime === 'application/pdf' || /\.pdf$/i.test(filename)) {
    type = 'text'
    const extracted = extractPdfText(buf)
    content = extracted.slice(0, 50_000)  // cap at 50K chars fed to LLM
    preview = content.slice(0, 200)
  } else {
    // plain text, markdown, etc.
    type = 'text'
    content = buf.toString('utf-8').slice(0, 50_000)
    preview = content.slice(0, 200)
  }

  const fileId = randomId()
  fileStore.set(fileId, { type, mimeType: mime, filename, content, preview, expiresAt: Date.now() + FILE_TTL_MS })

  const resp: ChatUploadResponse = { fileId, type, preview, filename }
  return jsonResponse(resp)
}

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
  let body: { history: { role: string; content: string }[]; message: string; fileId?: string }
  try { body = (await req.json()) as { history: { role: string; content: string }[]; message: string; fileId?: string } } catch { return errorResponse('Invalid JSON', 400) }
  const message = body.message?.trim()
  if (!message) return errorResponse('message is required', 400)

  const history = Array.isArray(body.history) ? body.history.slice(-10) : []

  // Resolve attached file (if any)
  let attachedFile: FileEntry | null = null
  if (body.fileId) {
    pruneExpiredFiles()
    attachedFile = fileStore.get(body.fileId) ?? null
  }

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
  const isOllama = /^ollama\//.test(model)
  const modelLabel = isOllama
    ? `${model.replace('ollama/', '')} vía Ollama (local) — modelo local, los resultados pueden variar`
    : `${model} via OpenRouter`

  const systemPrompt = `You are the assistant of OrchestOS, an AI agent orchestrator. Answer questions about the project state, tasks, runs, memory, specs, and the system. Be concise and direct. If the user writes in Spanish, respond in Spanish.

You are running as model: ${modelLabel}.

Important: you cannot modify files or run code directly from this chat. However, OrchestOS CAN improve itself — the user can create a Task describing the improvement, and the agent executor will modify the codebase autonomously. That is the correct way to self-improve: Tasks → agent runs → code changes.${ctx}${projBlock}`

  const messages: { role: 'user' | 'assistant'; content: any }[] = history
    .filter(h => h.role === 'user' || h.role === 'assistant')
    .map(h => ({ role: h.role as 'user' | 'assistant', content: String(h.content) }))

  // Build the user turn — with optional file attachment
  if (attachedFile) {
    if (attachedFile.type === 'image') {
      // Vision: multi-part content array [image, text]
      messages.push({
        role: 'user',
        content: [
          { type: 'image_url', image_url: { url: attachedFile.content } },
          { type: 'text', text: message },
        ],
      })
    } else {
      // Text/PDF: prepend extracted content as a labelled block
      const label = attachedFile.filename.toLowerCase().endsWith('.pdf') ? 'PDF' : 'File'
      const textBlock = `[${label}: ${attachedFile.filename}]\n${attachedFile.content}\n[End of ${label}]\n\n`
      messages.push({ role: 'user', content: textBlock + message })
    }
  } else {
    messages.push({ role: 'user', content: message })
  }

  try {
    if (isOllama) {
      const bareModel = model.replace('ollama/', '')
      const resp = await ollamaChat({ model: bareModel, system: systemPrompt, messages })
      return jsonResponse({ text: resp.text, model: resp.model })
    }
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

function handleApiProjectConstitutionGet(): Response {
  const root = resolve('.')
  const path = join(root, 'CONSTITUTION.md')
  const exists = existsSync(path)
  const content = exists ? readFileSync(path, 'utf-8') : ''
  return jsonResponse({ content, exists })
}

async function handleApiProjectConstitutionPut(req: Request): Promise<Response> {
  let body: { content: string }
  try { body = (await req.json()) as { content: string } } catch { return errorResponse('Invalid JSON', 400) }
  if (typeof body.content !== 'string') return errorResponse('content must be a string', 400)
  const root = resolve('.')
  writeFileSync(join(root, 'CONSTITUTION.md'), body.content, 'utf-8')
  return jsonResponse({ ok: true })
}

function handleApiProjectContextGet(): Response {
  const root = resolve('.')
  const path = join(root, 'CONTEXT.md')
  const exists = existsSync(path)
  const content = exists ? readFileSync(path, 'utf-8') : ''
  return jsonResponse({ content, exists })
}

function handleApiProjectContextRegenerate(): Response {
  const root = resolve('.')
  Bun.spawn([process.execPath, 'run', join(root, 'src/cli.ts'), 'context', 'compress'], {
    cwd: root, stdout: 'inherit', stderr: 'inherit',
  })
  return jsonResponse({ ok: true })
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

async function handleApiSettingsGet(): Promise<Response> {
  const parsed = readEnv()
  const result: Record<string, { set: boolean; masked: string }> = {}
  for (const k of SETTINGS_KEYS) {
    const v = parsed[k] ?? process.env[k] ?? ''
    result[k] = { set: !!v, masked: v ? maskKey(v) : '' }
  }
  result['_envFile'] = { set: existsSync(ENV_FILE), masked: ENV_FILE }
  result['_cwd'] = { set: true, masked: process.cwd() }

  // D0-ext-2: probe Ollama and report real detection state
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
  if (/^ollama\//.test(modelId)) return 'ollama'
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

function handleApiHealth(): Response {
  const root = resolve('.')

  // Section 1 — inline (mirrors /api/setup, trimmed to essential items)
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

  // Section 2 — blocked tasks (failed_permanent)
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
  } catch { /* no tasks.yaml */ }

  // Section 3 — pending approval
  const unverifiedInstincts = listInstincts({ verified: false }).length
  let draftSpecs = 0
  try {
    draftSpecs = listSpecs(root, false).filter(s => s.frontmatter.status === 'draft').length
  } catch { /* no specs dir */ }

  // Section 4 — cost last 7 days
  let costLast7d = 0
  try {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const row = db.query<{ total: number }, string>(
      "SELECT COALESCE(SUM(usd_cost), 0) AS total FROM runs WHERE created_at >= ?"
    ).get(cutoff)
    costLast7d = row?.total ?? 0
  } catch { /* db not ready */ }

  // Section 5 — recent auto-learned instincts (last 3 approved)
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

async function handleApiTasksDiagnose(url: URL): Promise<Response> {
  const raw = decodeURIComponent(url.pathname.split('/')[3] ?? '')
  const id = validateTaskId(raw)
  if (!id) return errorResponse('Missing or invalid task id', 400)
  const root = resolve('.')
  if (!existsSync(join(root, 'tasks.yaml'))) return errorResponse('tasks.yaml not found', 404)
  try {
    const result = await diagnoseTask(id, root)
    const row: DiagnoseRow = {
      taskId: result.taskId,
      pattern: result.pattern,
      confidence: result.confidence,
      suggestion: result.suggestion,
      details: result.details,
    }
    return jsonResponse(row)
  } catch (e: any) {
    return errorResponse(e.message, 404)
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

// ── D0-4: Ollama chat ─────────────────────────────────────────────────────────

async function ollamaChat(opts: {
  model: string   // bare model name, e.g. "qwen2.5-coder:7b"
  system: string
  messages: { role: 'user' | 'assistant'; content: any }[]
}): Promise<{ text: string; model: string }> {
  const body = {
    model: opts.model,
    messages: [
      { role: 'system', content: opts.system },
      ...opts.messages,
    ],
    stream: false,
  }
  const res = await fetch('http://localhost:11434/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ollama',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText)
    throw new Error(`Ollama error ${res.status}: ${err}`)
  }
  const data = await res.json() as { choices?: { message?: { content?: string } }[]; model?: string }
  const text = data.choices?.[0]?.message?.content ?? ''
  return { text, model: `ollama/${opts.model}` }
}

// ── E2: API key wizard — validate and persist ────────────────────────────────

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

  // 1. Persist key FIRST — so if validation is slow the user isn't blocked
  const current = readEnv()
  current[cfg.envKey] = key
  writeEnv(current)

  // 2. Validate with a minimal test call (key never appears in logs)
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
      // 400 can mean "model not found" but the key itself is valid
      return jsonResponse({ valid: true } satisfies ApiKeyValidationResponse)
    }

    const errBody = await res.text().catch(() => '')
    const errMsg = humanizeKeyError(res.status, errBody)

    // Rollback: remove the key we just wrote if it's clearly invalid
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
    // Don't rollback on network errors — key may still be valid
    return jsonResponse({ valid: false, error: errMsg } satisfies ApiKeyValidationResponse)
  }
}

// ── D0-2: Ollama local provider detection ────────────────────────────────────

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

// ── Skills API ─────────────────────────────────────────────────────────────────

function handleApiSkillsList(): Response {
  try {
    const files = listSkillFiles()
    const skills: SkillRow[] = []
    for (const f of files) {
      try {
        const s = loadSkill(f)
        skills.push({
          id: s.id,
          name: s.name,
          description: s.description,
          version: s.version,
          targets: [...s.targets],
          instructionSummary: s.instructions.length > 100
            ? s.instructions.slice(0, 100) + '...'
            : s.instructions,
        })
      } catch {
        // skip invalid skill files
      }
    }
    return jsonResponse(skills)
  } catch (e: any) {
    return errorResponse(e.message, 500)
  }
}

function handleApiSkillsGet(url: URL): Response {
  const m = url.pathname.match(/^\/api\/skills\/([^/]+)$/)
  if (!m || !m[1]) return errorResponse('Missing skill id', 400)
  const id: string = m[1]
  const path = getSkillPath(id)
  if (!existsSync(path)) return errorResponse('Skill not found', 404)
  try {
    const skill = loadSkill(path)
    return jsonResponse(skill)
  } catch (e: any) {
    return errorResponse(e.message, 500)
  }
}

async function handleApiSkillsCreate(req: Request): Promise<Response> {
  let body: Record<string, unknown>
  try { body = await req.json() as Record<string, unknown> } catch { return errorResponse('Invalid JSON', 400) }

  const id = body.id as string
  if (!id || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) {
    return errorResponse('Invalid id — must be kebab-case', 400)
  }

  const path = getSkillPath(id)
  if (existsSync(path)) return errorResponse('Skill already exists', 409)

  try {
    const validated = validateSkill(body, `api:${id}`)
    const yaml = stringify(validated, { lineWidth: 120 })
    writeFileSync(path, yaml, 'utf-8')
    return jsonResponse({ ok: true, id } satisfies MutationResult)
  } catch (e: any) {
    return errorResponse(e.message, 400)
  }
}

async function handleApiSkillsUpdate(req: Request, url: URL): Promise<Response> {
  const m = url.pathname.match(/^\/api\/skills\/([^/]+)$/)
  if (!m || !m[1]) return errorResponse('Missing skill id', 400)
  const id: string = m[1]
  const path = getSkillPath(id)
  if (!existsSync(path)) return errorResponse('Skill not found', 404)

  let body: Record<string, unknown>
  try { body = await req.json() as Record<string, unknown> } catch { return errorResponse('Invalid JSON', 400) }

  try {
    const validated = validateSkill(body, `api:${id}`)
    const yaml = stringify(validated, { lineWidth: 120 })
    writeFileSync(path, yaml, 'utf-8')
    return jsonResponse({ ok: true, id } satisfies MutationResult)
  } catch (e: any) {
    return errorResponse(e.message, 400)
  }
}

async function handleApiSkillsDelete(req: Request, url: URL): Promise<Response> {
  const m = url.pathname.match(/^\/api\/skills\/([^/]+)$/)
  if (!m || !m[1]) return errorResponse('Missing skill id', 400)
  const id: string = m[1]
  const path = getSkillPath(id)
  if (!existsSync(path)) return errorResponse('Skill not found', 404)

  let body: { confirm?: boolean }
  try { body = await req.json() as { confirm?: boolean } } catch { return errorResponse('Invalid JSON', 400) }
  if (body.confirm !== true) return errorResponse('Confirmation required — send { confirm: true }', 400)

  try {
    unlinkSync(path)
    return jsonResponse({ ok: true, id } satisfies MutationResult)
  } catch (e: any) {
    return errorResponse(e.message, 500)
  }
}

function handleApiSkillsBuild(url: URL): Response {
  const m = url.pathname.match(/^\/api\/skills\/([^/]+)\/build$/)
  if (!m || !m[1]) return errorResponse('Missing skill id', 400)
  const id: string = m[1]
  const path = getSkillPath(id)
  if (!existsSync(path)) return errorResponse('Skill not found', 404)

  try {
    const skill = loadSkill(path)
    const paths = compileSkill(skill)
    return jsonResponse({ ok: true, paths, skillId: id } satisfies SkillBuildResponse)
  } catch (e: any) {
    return jsonResponse({ ok: false, paths: [], skillId: id, error: e.message } as SkillBuildResponse & { error: string }, 500)
  }
}

// ── C1: Curator system prompt ────────────────────────────────────────────────

const CURATOR_SYSTEM = `You are a skill curator for OrchestOS, an AI agent orchestration system.

Given a natural language description, extract a SkillDef JSON object with exactly these fields:

REQUIRED:
- id: kebab-case identifier (e.g. "code-review", "write-tests") — only lowercase letters, numbers, hyphens
- version: always "1.0.0"
- name: short human-readable name (max 60 chars)
- description: one sentence explaining what the skill does (max 200 chars)
- instructions: detailed step-by-step instructions for the agent (max 4000 chars)
- targets: array — use ["claude", "cursor", "openai"] unless the description restricts targets

OPTIONAL (include only when relevant):
- when_to_use: array of trigger phrases describing when this skill should activate
- anti_patterns: array of things the agent must avoid
- verifiers: array of shell commands or steps to verify the work is correct
- inputs_required: array of inputs the agent needs before starting
- examples: array of {title: string, input: string, output: string} objects

Rules:
- Respond ONLY with a valid JSON object — no markdown fences, no extra text, no explanations
- If the description is in Spanish, write instructions and other text fields in Spanish
- id must be kebab-case: lowercase letters, numbers, and hyphens only — no leading/trailing hyphens
- description must not exceed 200 chars
- instructions must not exceed 4000 chars`

// ── C2-C3: Curator handler with retry gate ──────────────────────────────────

async function handleApiSkillsCurate(req: Request): Promise<Response> {
  let body: { text?: string }
  try { body = await req.json() as { text?: string } } catch { return errorResponse('Invalid JSON', 400) }
  const text = body.text?.trim()
  if (!text) return errorResponse('text is required', 400)

  const MAX_RETRIES = 2
  let lastError = ''

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const userMessage = attempt === 0
      ? text
      : `${text}\n\nPrevious attempt failed validation with this error: ${lastError}\nPlease fix the issue and return a corrected JSON.`

    let raw: string
    try {
      const resp = await openrouterChat({
        model: 'anthropic/claude-haiku-4-5',
        system: CURATOR_SYSTEM,
        messages: [{ role: 'user', content: userMessage }],
      })
      raw = resp.text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    } catch (e: any) {
      return errorResponse(`LLM call failed: ${e.message}`, 502)
    }

    let draft: Record<string, unknown>
    try {
      draft = JSON.parse(raw) as Record<string, unknown>
    } catch {
      lastError = 'Response was not valid JSON'
      continue
    }

    // Sanitise id to enforce kebab-case before validation
    if (typeof draft.id === 'string') {
      draft.id = draft.id.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
    }

    try {
      validateSkill(draft, 'curate')
      return jsonResponse({ ok: true, skill: draft, iterations: attempt + 1 } satisfies SkillCurateResponse)
    } catch (e: any) {
      lastError = e.message
    }
  }

  return jsonResponse(
    { ok: false, error: `Curator failed after ${MAX_RETRIES + 1} attempts: ${lastError}`, iterations: MAX_RETRIES + 1 } satisfies SkillCurateResponse,
    422
  )
}

async function route(req: Request, port: number): Promise<Response> {
  const url = new URL(req.url)
  const method = req.method

  // CSRF guard: reject cross-origin mutating requests
  if ((method === 'POST' || method === 'PUT' || method === 'DELETE') && !isSameOrigin(req, port)) {
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
  if (method === 'GET' && url.pathname.match(/^\/api\/tasks\/[^/]+\/diagnose$/)) {
    return handleApiTasksDiagnose(url)
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

  // ── Skills API ─────────────────────────────────────────────────────────────
  if (method === 'GET' && url.pathname === '/api/skills') {
    return handleApiSkillsList()
  }
  if (method === 'GET' && url.pathname.match(/^\/api\/skills\/([^/]+)$/)) {
    return handleApiSkillsGet(url)
  }
  if (method === 'POST' && url.pathname === '/api/skills') {
    return handleApiSkillsCreate(req)
  }
  if (method === 'PUT' && url.pathname.match(/^\/api\/skills\/([^/]+)$/)) {
    return handleApiSkillsUpdate(req, url)
  }
  if (method === 'DELETE' && url.pathname.match(/^\/api\/skills\/([^/]+)$/)) {
    return handleApiSkillsDelete(req, url)
  }
  if (method === 'POST' && url.pathname.match(/^\/api\/skills\/([^/]+)\/build$/)) {
    return handleApiSkillsBuild(url)
  }
  if (method === 'POST' && url.pathname === '/api/skills/curate') {
    return handleApiSkillsCurate(req)
  }

  if (method === 'GET' && url.pathname === '/api/project/constitution') {
    return handleApiProjectConstitutionGet()
  }
  if (method === 'PUT' && url.pathname === '/api/project/constitution') {
    return handleApiProjectConstitutionPut(req)
  }
  if (method === 'GET' && url.pathname === '/api/project/context') {
    return handleApiProjectContextGet()
  }
  if (method === 'POST' && url.pathname === '/api/project/context/regenerate') {
    return handleApiProjectContextRegenerate()
  }
  if (method === 'POST' && url.pathname === '/api/natural') {
    return handleApiNatural(req)
  }
  if (method === 'GET' && url.pathname === '/api/chat/models') {
    return handleApiChatModels()
  }
  if (method === 'POST' && url.pathname === '/api/chat/upload') {
    return handleApiChatUpload(req)
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
    return await handleApiSettingsGet()
  }
  if (method === 'GET' && url.pathname === '/api/setup') {
    return handleApiSetup()
  }
  if (method === 'GET' && url.pathname === '/api/health') {
    return handleApiHealth()
  }
  if (method === 'GET' && url.pathname === '/api/providers/local') {
    return handleApiProvidersLocal()
  }
  if (method === 'POST' && url.pathname === '/api/setup/api-key') {
    return await handleApiSetupApiKey(req)
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
