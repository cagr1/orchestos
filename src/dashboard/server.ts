import { resolve, join, extname, sep } from 'path'
import { existsSync, readFileSync, writeFileSync, realpathSync, mkdirSync } from 'fs'
import { homedir } from 'os'
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

async function handleApiTasksCreate(req: Request): Promise<Response> {
  let body: { id: string; description: string; output: string[]; executor?: string }
  try { body = (await req.json()) as { id: string; description: string; output: string[]; executor?: string } } catch { return errorResponse('Invalid JSON', 400) }
  const { id, description, output, executor } = body
  if (!id?.trim() || !description?.trim() || !Array.isArray(output) || output.length === 0) {
    return errorResponse('id, description and output[] are required', 400)
  }
  const root = resolve('.')
  if (!existsSync(join(root, 'tasks.yaml'))) {
    return errorResponse('tasks.yaml not found — run: orchestos task init', 404)
  }
  try {
    const file = loadTasks(root)
    if (file.tasks.find((t: any) => t.id === id.trim())) {
      return errorResponse(`Task "${id.trim()}" already exists`, 409)
    }
    ;(file.tasks as any[]).push({
      id: id.trim(),
      description: description.trim(),
      output: output.map((f: string) => f.trim()).filter(Boolean),
      executor: executor || 'openrouter',
      status: 'pending',
      retry_count: 0,
    })
    saveTasks(root, file)
    return jsonResponse({ ok: true })
  } catch (e: any) {
    return errorResponse(e.message, 500)
  }
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
  if (method === 'GET' && url.pathname === '/api/specs') {
    return handleApiSpecs()
  }
  if (method === 'GET' && url.pathname === '/api/memory') {
    return handleApiMemory()
  }
  if (method === 'GET' && url.pathname === '/api/settings') {
    return handleApiSettingsGet()
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
