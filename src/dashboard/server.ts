import { resolve, join, extname, sep } from 'path'
import { existsSync, readFileSync, realpathSync } from 'fs'
import { db } from '../db/sqlite.ts'
import { listRuns, getRun, type RunRecord } from '../db/runs.ts'
import { loadTasks } from '../tasks/loader.ts'
import { listInstincts, approveInstinct, deleteInstinct } from '../instincts/store.ts'
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

function route(req: Request, port: number): Response {
  const url = new URL(req.url)
  const method = req.method

  // CSRF guard: reject cross-origin POSTs
  if (method === 'POST' && !isSameOrigin(req, port)) {
    return errorResponse('Forbidden', 403)
  }

  if (method === 'GET' && (url.pathname === '/api/runs' || url.pathname.startsWith('/api/runs/'))) {
    return handleApiRuns(url)
  }
  if (method === 'GET' && url.pathname === '/api/tasks') {
    return handleApiTasks()
  }
  if (method === 'GET' && url.pathname === '/api/instincts') {
    return handleApiInstincts()
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
