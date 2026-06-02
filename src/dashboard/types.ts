/**
 * src/dashboard/types.ts — S36.1
 *
 * API contract for the OrchestOS local dashboard.
 *
 * Route map:
 *   GET  /                          → index.html  (static)
 *   GET  /dashboard.js              → dashboard.js (static)
 *   GET  /api/runs                  → RunRow[]
 *   GET  /api/tasks                 → TaskRow[]
 *   GET  /api/instincts             → InstinctRow[]
 *   POST /api/instincts/:id/approve → MutationResult
 *   POST /api/instincts/:id/reject  → MutationResult
 *   GET  /api/specs                 → SpecRow[]
 *   GET  /api/memory                → MemoryRow[]
 *
 * All GET endpoints return JSON arrays sorted by most-recent first.
 * All POST endpoints return MutationResult.
 * Errors return { error: string } with a 4xx/5xx status.
 *
 * Design rules:
 *   - No authentication (local-only tool)
 *   - No pagination on first version (dashboard reads full tables; YAGNI)
 *   - JSON columns (cost_breakdown_json, context_warnings_json) are parsed
 *     server-side so the client receives structured data, not raw strings
 *   - instinct.verified is stored as INTEGER 0/1 in SQLite;
 *     the API always returns it as boolean
 */

// ── /api/runs ─────────────────────────────────────────────────────────────────

export interface CostBreakdownEntry {
  label: string
  model: string
  inputTokens: number
  outputTokens: number
  costUsd: number
}

export interface ContextWarningEntry {
  code: string
  severity: 'warning' | 'critical' | 'notice'
  message: string
}

export interface RunRow {
  id: string
  taskId: string | null
  status: 'done' | 'blocked' | 'failed'
  qaVerdict: 'pass' | 'fail' | null
  model: string
  provider: string
  skillId: string | null
  inputTokens: number
  outputTokens: number
  costUsd: number
  elapsedMs: number
  costBreakdown: CostBreakdownEntry[]   // parsed from cost_breakdown_json
  contextWarnings: ContextWarningEntry[] // parsed from context_warnings_json
  createdAt: string
}

// ── /api/tasks ────────────────────────────────────────────────────────────────

export interface TaskRow {
  id: string
  description: string
  status: string           // 'pending' | 'running' | 'done' | 'failed' | 'failed_permanent' | 'blocked'
  skill: string | null
  executor: string
  retryCount: number
  qaVerdict: 'pass' | 'fail' | null
  runId: string | null     // link to latest run in /api/runs
}

// ── /api/instincts ────────────────────────────────────────────────────────────

export interface InstinctRow {
  id: string
  trigger: string
  action: string
  confidence: number
  source: 'manual' | 'auto'
  verified: boolean
  createdAt: string
}

// ── /api/specs ────────────────────────────────────────────────────────────────

export type SpecLintStatus = 'pass' | 'fail' | 'unknown'

export interface SpecRow {
  id: string
  status: 'draft' | 'approved' | 'archived'
  clarify: 'pending' | 'resolved' | 'none'
  lintStatus: SpecLintStatus    // 'fail' if any findings; 'pass' if 0; 'unknown' if lint errors
  lintFindings: number          // count of lint findings (0 = pass)
  deltaIssues: number           // S32 delta header issues
  hasCapabilities: boolean      // true if capabilities field is set
  createdAt: string
}

// ── /api/memory ───────────────────────────────────────────────────────────────

export interface MemoryRow {
  id: string
  projectId: string
  topicKey: string
  scope: 'session' | 'project' | 'global'
  content: string
  updatedAt: string
}

// ── mutations ─────────────────────────────────────────────────────────────────

export interface MutationResult {
  ok: boolean
  error?: string
}

// ── server config ─────────────────────────────────────────────────────────────

export const DEFAULT_PORT = 4242

// import.meta.url on Windows produces a /E:/... path that fs functions reject.
// fileURLToPath() normalises it to a proper Windows path (E:\...).
import { fileURLToPath } from 'url'
export const STATIC_DIR = fileURLToPath(new URL('./public', import.meta.url))
