/**
 * S22.3 — Context isolation for sub-agents
 * S22.5a — Apply-progress merge (prior topic_key entry → explicit MERGE instruction)
 *
 * Each sub-agent receives an isolated context composed of three layers:
 *   (a) Slice of CONTEXT.md — only sections relevant to the sub-task's description
 *       and acceptance criteria. NEVER the full file.
 *   (b) Session memories — snapshot of memory_entries scope='session' filtered by
 *       topic_keys relevant to this sub-task (heuristic: prefix matches skill_id,
 *       plus entries from depends_on predecessors via their topic_keys).
 *   (c) Spec — the sub-task's own spec body if it exists.
 *
 * Apply-progress (S22.5a): if a prior memory_entry exists for the sub-task's own
 * topic_key, it is rendered with an explicit "MERGE — do not OVERWRITE" instruction
 * before the rest of the context. After a successful run, `commitTopicKey()` upserts
 * the result into memory_entries so the next sub-task in the chain can read it.
 *
 * Hard constraint: the rendered context must not exceed MAX_CONTEXT_CHARS.
 * Sub-agents get a focused slice, not the orchestrator-level full context.
 *
 * Patterns: DeerFlow (layered memory) + gentle-ai (pass paths, not full content)
 */

import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { listByScope, upsertMemory } from '../db/memory.ts'
import { loadSpec } from '../spec/store.ts'
import type { SubTask } from './sub-agent.ts'
import type { MemoryEntry, MemoryScope } from '../db/memory.ts'

// ---------------------------------------------------------------------------
// Limits
// ---------------------------------------------------------------------------

/** Max chars in the rendered context passed to a sub-agent LLM call. */
export const MAX_CONTEXT_CHARS = 8_000

/** Max memory entries included in one sub-agent context. */
export const MAX_MEMORY_ENTRIES = 10

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface IsolatedContext {
  /** Slice of CONTEXT.md relevant to this sub-task (never full file). */
  contextSlice: string
  /** Session memory entries selected as relevant to this sub-task (excluding priorTopicKeyEntry). */
  memories: MemoryEntry[]
  /**
   * Prior memory entry for the sub-task's own topic_key, if one exists.
   * Rendered with an explicit MERGE instruction (S22.5a apply-progress continuity).
   * Also used by the orchestrator to decide whether to pass merge context to the LLM.
   */
  priorTopicKeyEntry?: MemoryEntry
  /** Spec body for this sub-task id, if it exists and is approved. */
  spec?: string
  /** Rendered string — ready to pass to buildPrompt / harness. */
  rendered: string
  /** Estimated token count of `rendered`. */
  tokenEstimate: number
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Builds an isolated context for a single sub-task.
 *
 * @param subTask  — the sub-task about to be executed
 * @param projectRoot — absolute path to the project being modified
 * @param projectId   — SQLite project id (for memory_entries queries)
 */
export function buildIsolatedContext(
  subTask: SubTask,
  projectRoot: string,
  projectId: string,
): IsolatedContext {
  // (a) Context slice ─────────────────────────────────────────────────────────
  const contextRaw = readContextFile(projectRoot)
  const keywords   = extractKeywords(subTask)
  const contextSlice = contextRaw
    ? sliceContext(contextRaw, keywords, MAX_CONTEXT_CHARS * 0.6)  // 60% budget
    : ''

  // (b) Session memories ──────────────────────────────────────────────────────
  const allSession = listByScope(projectId, 'session')
  const { prior, others } = selectMemories(subTask, allSession)

  // (c) Spec ──────────────────────────────────────────────────────────────────
  let spec: string | undefined
  try {
    const loaded = loadSpec(projectRoot, subTask.id)
    if (loaded) spec = loaded.body.trim() || undefined
  } catch {
    // spec missing or malformed — proceed without it
  }

  const rendered      = renderContext({ contextSlice, memories: others, priorTopicKeyEntry: prior, spec, subTask })
  const tokenEstimate = Math.round(rendered.length / 4)

  return { contextSlice, memories: others, priorTopicKeyEntry: prior, spec, rendered, tokenEstimate }
}

// ---------------------------------------------------------------------------
// (a) Context slice
// ---------------------------------------------------------------------------

/**
 * Splits CONTEXT.md into sections at `## ` headings, scores each section
 * by keyword overlap with the sub-task keywords, and returns the top sections
 * concatenated up to `maxChars`.
 *
 * The preamble (text before the first heading) is always included.
 */
export function sliceContext(text: string, keywords: string[], maxChars: number): string {
  if (!text.trim()) return ''
  if (keywords.length === 0) {
    // No keywords — include preamble and first section only
    return text.slice(0, maxChars)
  }

  const sections = splitIntoSections(text)
  if (sections.length === 0) return text.slice(0, maxChars)

  // Always include preamble (index 0)
  const preamble = sections[0] ?? ''
  const rest     = sections.slice(1)

  // Score remaining sections by keyword overlap
  const scored = rest.map(s => ({
    text: s,
    score: scoreSection(s, keywords),
  }))

  // Sort by score desc; stable — preserve original order for equal scores
  const sorted = scored
    .map((s, i) => ({ ...s, origIndex: i }))
    .sort((a, b) => b.score - a.score || a.origIndex - b.origIndex)

  // Build output up to maxChars
  const preambleChunk = preamble.slice(0, Math.round(maxChars * 0.3))
  const parts: string[] = [preambleChunk]
  let remaining = maxChars - preambleChunk.length

  for (const s of sorted) {
    if (remaining <= 0) break
    if (s.score === 0 && parts.length > 2) break  // skip zero-score sections once we have some content
    const chunk = s.text.slice(0, remaining)
    parts.push(chunk)
    remaining -= chunk.length
  }

  return parts.join('\n').trimEnd()
}

// ---------------------------------------------------------------------------
// (b) Memory selection
// ---------------------------------------------------------------------------

export interface SelectedMemories {
  /** Prior entry for the sub-task's own topic_key — rendered with MERGE instruction (S22.5a). */
  prior?: MemoryEntry
  /** Other relevant session entries (skill prefix + depends_on predecessors). */
  others: MemoryEntry[]
}

/**
 * Selects relevant memory entries from all session entries for this sub-task.
 *
 * The sub-task's own topic_key entry (if any) is returned separately as `prior`
 * so the renderer can emit an explicit MERGE instruction around it (S22.5a).
 *
 * `others` contains entries matched by skill prefix or depends_on predecessor topic_keys,
 * capped at MAX_MEMORY_ENTRIES, sorted by priority then updated_at desc.
 */
export function selectMemories(subTask: SubTask, allSession: MemoryEntry[]): SelectedMemories {
  if (allSession.length === 0) return { others: [] }

  const skillPrefix = subTask.skill ?? null
  const ownKey      = subTask.topic_key ?? null
  const depIds      = new Set(subTask.depends_on)

  let prior: MemoryEntry | undefined
  type Scored = { entry: MemoryEntry; priority: number }
  const scored: Scored[] = []

  for (const entry of allSession) {
    // Own topic_key — separated out for MERGE instruction (S22.5a)
    if (ownKey && entry.topic_key === ownKey) {
      prior = entry
      continue
    }
    // Skill prefix match (e.g., skill='tdd-enforcer' matches 'tdd-enforcer-auth')
    if (skillPrefix && entry.topic_key.startsWith(skillPrefix)) {
      scored.push({ entry, priority: 2 })
      continue
    }
    // Predecessor output this sub-task depends on
    if (depIds.has(entry.topic_key)) {
      scored.push({ entry, priority: 1 })
    }
  }

  scored.sort((a, b) =>
    b.priority - a.priority ||
    b.entry.updated_at.localeCompare(a.entry.updated_at)
  )

  return { prior, others: scored.slice(0, MAX_MEMORY_ENTRIES).map(s => s.entry) }
}

// ---------------------------------------------------------------------------
// Renderer
// ---------------------------------------------------------------------------

interface RenderOpts {
  contextSlice: string
  memories: MemoryEntry[]
  priorTopicKeyEntry?: MemoryEntry
  spec?: string
  subTask: SubTask
}

function renderContext(opts: RenderOpts): string {
  const { contextSlice, memories, priorTopicKeyEntry, spec, subTask } = opts
  const parts: string[] = []

  // Sub-task identity header
  parts.push(`## Sub-task: ${subTask.id}`)
  parts.push(`**Description**: ${subTask.description}`)
  if (subTask.acceptance.length > 0) {
    parts.push('\n**Acceptance criteria**:')
    for (const a of subTask.acceptance) parts.push(`- ${a}`)
  }
  if (subTask.allowed_tools.length > 0) {
    parts.push(`\n**Allowed tools**: ${subTask.allowed_tools.join(', ')}`)
  }
  parts.push('')

  // S22.5a — apply-progress MERGE instruction (rendered FIRST, highest priority)
  if (priorTopicKeyEntry) {
    parts.push(`## ⚠️ MERGE REQUIRED — topic_key: ${priorTopicKeyEntry.topic_key}`)
    parts.push('This sub-task was previously executed. A prior result exists in memory.')
    parts.push('**You MUST incorporate and extend the prior result below — do NOT overwrite or discard it.**')
    parts.push('Your output must represent the combined state of the prior result and your new work.')
    parts.push('')
    parts.push('### Prior result')
    parts.push(priorTopicKeyEntry.content.trim())
    parts.push('')
  }

  // (a) Context slice
  if (contextSlice.trim()) {
    parts.push('## Project context (excerpt)')
    parts.push(contextSlice.trim())
    parts.push('')
  }

  // (b) Other session memories (predecessor outputs, skill-related)
  if (memories.length > 0) {
    parts.push('## Session memory')
    for (const m of memories) {
      parts.push(`### ${m.topic_key}`)
      parts.push(m.content.trim())
      parts.push('')
    }
  }

  // (c) Spec
  if (spec) {
    parts.push('## Spec')
    parts.push(spec)
    parts.push('')
  }

  const rendered = parts.join('\n').trimEnd()

  // Hard truncation at MAX_CONTEXT_CHARS — should rarely trigger if sliceContext
  // and memory limits are set correctly, but enforced as a safety net.
  return rendered.length > MAX_CONTEXT_CHARS
    ? rendered.slice(0, MAX_CONTEXT_CHARS) + '\n[…context truncated]'
    : rendered
}

// ---------------------------------------------------------------------------
// Keyword extraction
// ---------------------------------------------------------------------------

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'this', 'that', 'from', 'into', 'using',
  'add', 'use', 'get', 'set', 'new', 'all', 'its', 'has', 'are', 'not',
  'can', 'will', 'should', 'must', 'make', 'create', 'update', 'delete',
  'file', 'files', 'code', 'task', 'test', 'run', 'src', 'lib', 'each',
  'sub', 'task', 'every', 'when', 'than', 'also', 'only', 'just', 'any',
])

/** Extracts unique lowercase keywords (≥3 chars) from the sub-task description and acceptance. */
export function extractKeywords(subTask: SubTask): string[] {
  const text = [
    subTask.description,
    ...subTask.acceptance,
    subTask.skill ?? '',
    subTask.topic_key ?? '',
  ].join(' ')

  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(t => t.length >= 3 && !STOP_WORDS.has(t))
    .filter((t, i, arr) => arr.indexOf(t) === i)
}

// ---------------------------------------------------------------------------
// Section splitting + scoring
// ---------------------------------------------------------------------------

/**
 * Splits markdown into sections at `## ` or `# ` headings.
 * First element is everything before the first heading (preamble).
 */
function splitIntoSections(text: string): string[] {
  const lines    = text.split('\n')
  const sections: string[] = []
  let current:   string[] = []

  for (const line of lines) {
    if (/^#{1,3} /.test(line) && current.length > 0) {
      sections.push(current.join('\n'))
      current = [line]
    } else {
      current.push(line)
    }
  }
  if (current.length > 0) sections.push(current.join('\n'))

  return sections
}

/** Returns how many keywords appear in the lowercased section text. */
function scoreSection(sectionText: string, keywords: string[]): number {
  const lower = sectionText.toLowerCase()
  let score = 0
  for (const kw of keywords) {
    if (lower.includes(kw)) score++
  }
  return score
}

// ---------------------------------------------------------------------------
// S22.5a — commitTopicKey (write side of apply-progress)
// ---------------------------------------------------------------------------

/**
 * Persists the sub-task result to `memory_entries` under the sub-task's `topic_key`.
 *
 * Called by the orchestrator/scheduler after a sub-task reaches status 'completed'.
 * Uses `upsertMemory()` so re-runs merge rather than insert duplicates.
 *
 * @param subTask    — the completed sub-task (must have topic_key set)
 * @param projectId  — SQLite project id
 * @param content    — result content to store (typically SubagentResult.result)
 * @param scope      — memory scope (default: 'session')
 * @returns the memory entry id, or null if the sub-task has no topic_key
 */
export function commitTopicKey(
  subTask: SubTask,
  projectId: string,
  content: string,
  scope: MemoryScope = 'session',
): string | null {
  if (!subTask.topic_key) return null
  return upsertMemory(projectId, subTask.topic_key, content, scope)
}

// ---------------------------------------------------------------------------
// File reader
// ---------------------------------------------------------------------------

/** Reads CONTEXT.md if present, falls back to AGENTS.md. Returns null if neither exists. */
function readContextFile(projectRoot: string): string | null {
  const contextMd = join(projectRoot, 'CONTEXT.md')
  if (existsSync(contextMd)) return readFileSync(contextMd, 'utf-8')

  const agentsMd = join(projectRoot, 'AGENTS.md')
  if (existsSync(agentsMd)) return readFileSync(agentsMd, 'utf-8')

  return null
}
