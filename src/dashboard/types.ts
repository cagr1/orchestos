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
 *   GET  /api/tasks/:id/diagnose   → DiagnoseRow
 *   GET  /api/health               → HealthResponse
 *   GET  /api/providers/local      → LocalProviderResponse
 *   POST /api/chat/upload          → ChatUploadResponse
 *   POST /api/setup/api-key        → ApiKeyValidationResponse
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

// ── /api/tasks/:id/diagnose ───────────────────────────────────────────────────

export type FailurePatternLabel =
  | 'deterministic_check'
  | 'qa_specific_criterion'
  | 'parse_error'
  | 'rate_limit'
  | 'scope_creep'
  | 'unknown'

export interface DiagnoseRow {
  taskId: string
  pattern: FailurePatternLabel
  confidence: 'high' | 'medium' | 'low'
  suggestion: string
  details: string
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

// ── /api/settings ─────────────────────────────────────────────────────────────

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
  kind: 'runtime' | 'dependency' | 'credential' | 'project' | 'database' | 'index'
  hint: string
  actionLabel?: string
  action?: 'save-settings' | 'copy-command' | 'open-wizard'
  command?: string
}

export interface SetupResponse {
  ready: boolean
  criticalMissing: boolean
  envFile: string
  cwd: string
  items: SetupItem[]
}

// ── /api/providers/local ─────────────────────────────────────────────────────

export interface LocalProviderModel {
  id: string
  size: string
}

export interface LocalProviderResponse {
  available: boolean
  models: LocalProviderModel[]
}

// ── /api/chat/upload ─────────────────────────────────────────────────────────

export type ChatFileType = 'image' | 'text'

export interface ChatUploadResponse {
  fileId: string       // UUID, valid until server restart or 30-min TTL
  type: ChatFileType
  preview: string      // first 200 chars of text, or 'image/png' mime label for images
  filename: string
}

// ── /api/health ───────────────────────────────────────────────────────────────
// Single endpoint, 5 sections — one round-trip for the Control Center.

export interface HealthBlockedTask {
  id: string
  description: string
  retryCount: number
}

export interface HealthPendingApproval {
  unverifiedInstincts: number  // instincts where verified=false
  draftSpecs: number           // specs where status='draft'
}

export interface HealthRecentLearning {
  id: string
  trigger: string
  action: string
  createdAt: string
}

export interface HealthResponse {
  /** Section 1 — system prerequisites (reuses SetupResponse structure) */
  system: SetupResponse
  /** Section 2 — tasks with status failed_permanent */
  blockedTasks: HealthBlockedTask[]
  /** Section 3 — items waiting for human approval */
  pendingApproval: HealthPendingApproval
  /** Section 4 — sum of run costs over the last 7 days (USD) */
  costLast7d: number
  /** Section 5 — last 3 auto-learned instincts that were approved */
  recentLearnings: HealthRecentLearning[]
  /**
   * Derived attention count used by C4 for home-screen routing.
   * = blockedTasks.length + pendingApproval.unverifiedInstincts + pendingApproval.draftSpecs
   */
  attentionCount: number
}

// ── /api/setup/api-key ───────────────────────────────────────────────────────

export type ApiKeyProvider = 'openrouter' | 'anthropic' | 'openai'

export interface ApiKeyValidationResponse {
  valid: boolean
  error?: string  // human-readable, shown directly in the wizard UI
}

// ── /api/skills ────────────────────────────────────────────────────────────────

export interface SkillRow {
  id: string
  name: string
  description: string
  version: string
  targets: string[]
  instructionSummary: string
}

export interface SkillBuildResponse {
  ok: boolean
  paths: string[]
  skillId: string
}

// ── /api/skills/pro ──────────────────────────────────────────────────────────

export interface SkillProRow {
  id: string
  name: string
  description: string
  targets: string[]
  imported: boolean  // true if already present in skills/
}

// ── /api/skills/curate ────────────────────────────────────────────────────────

export interface SkillCurateResponse {
  ok: boolean
  skill?: Record<string, unknown>  // partial SkillDef — not yet saved
  error?: string
  iterations: number               // how many LLM calls were needed (1-3)
}

// ── /api/skills/import ────────────────────────────────────────────────────────

export interface SkillImportResponse {
  ok: boolean
  skill?: Record<string, unknown>  // validated/normalized SkillDef
  error?: string
  normalized: boolean              // true if AI curator fixed issues
  warnings: string[]               // normalization warnings
  iterations: number               // LLM calls needed (0 if no normalization)
}

// ── /api/skills/registry ─────────────────────────────────────────────────────

export interface RegistrySkillEntry {
  id: string
  name: string
  description: string
  source: string
  fileCount: number
  bundleHash: string
  reviewStatus: 'approved' | 'pending' | 'rejected'
}

export interface RegistrySkillDetail {
  id: string
  name: string
  description: string
  source: string
  skillPath: string
  files: string[]
  sha256: Record<string, string>
  bundleHash: string
}

export interface RegistryListResponse {
  ok: boolean
  skills: RegistrySkillEntry[]
  count: number
  generatedAt: string
}

export interface RegistryImportResponse {
  ok: boolean
  id?: string
  error?: string
  normalized: boolean
  warnings: string[]
}

// ── mutations ─────────────────────────────────────────────────────────────────

export interface MutationResult {
  ok: boolean
  error?: string
  id?: string
}

// ── server config ─────────────────────────────────────────────────────────────

export const DEFAULT_PORT = 4242

// import.meta.url on Windows produces a /E:/... path that fs functions reject.
// fileURLToPath() normalises it to a proper Windows path (E:\...).
import { fileURLToPath } from 'url'
export const STATIC_DIR = fileURLToPath(new URL('./public', import.meta.url))
