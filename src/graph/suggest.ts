/**
 * src/graph/suggest.ts
 *
 * suggestContext(projectId, taskText, opts) → ranked list of file paths relevant to the task.
 *
 * S24.4 — Semantic re-ranking with embeddings (two-path design):
 *
 * EMBEDDING PATH  (when opts.taskEmbedding is provided)
 *   For each file:
 *     embed_score  = cosine(taskEmbedding, file.embedding)  [0 if no embedding stored]
 *     keyword_score = raw token hits / max_token_hits  →  [0, 1]
 *     final_score  = embed_score × EMBED_WEIGHT(0.6) + keyword_score × KEYWORD_WEIGHT(0.4)
 *   Include file if keyword_score > 0 OR embed_score > EMBED_THRESHOLD(0.1).
 *   reason = 'embedding' when file was found only via cosine (keyword_score == 0).
 *
 * KEYWORD PATH  (legacy, when opts.taskEmbedding is absent)
 *   Unchanged from S12: integer scores, token match + 1-hop expansion.
 *   reason = 'direct' | 'neighbor'
 *
 * Both paths run 1-hop graph expansion on their seed set.
 * CLI interface is identical — taskEmbedding is optional.
 *
 * Why two paths: embedding API may not be configured; keyword path must remain
 * reliable without any external call at suggest-time.
 */

import { db } from '../db/sqlite.ts'
import { cosine } from '../providers/embeddings.ts'

// ── weights ──────────────────────────────────────────────────────────────────

const TOKEN_WEIGHT    = 3    // keyword path: score per token hit
const HOP_WEIGHT      = 1    // keyword path: bonus for 1-hop neighbor
const DEFAULT_TOP     = 10

// S24.4 embedding path weights (plan spec: embed × 0.6 + keyword × 0.4)
const EMBED_WEIGHT    = 0.6
const KEYWORD_WEIGHT  = 0.4
/** Min cosine similarity to include a file found only via embedding (no keyword match). */
const EMBED_THRESHOLD = 0.10

// ── stop-words ───────────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'this', 'that', 'from', 'into', 'using',
  'add', 'use', 'get', 'set', 'new', 'all', 'its', 'has', 'are', 'not',
  'can', 'will', 'should', 'must', 'make', 'create', 'update', 'delete',
  'file', 'files', 'code', 'task', 'test', 'run', 'src', 'lib',
])

// ── public interface ─────────────────────────────────────────────────────────

export interface SuggestOpts {
  /** Max files to return (default 10) */
  topN?: number
  /** Include 1-hop neighbors (default true) */
  expand?: boolean
  /**
   * S24.4 — Task embedding vector from EmbeddingProvider.
   * When provided, cosine similarity is combined with keyword scoring.
   * Omit to use the legacy keyword-only path (backward compatible).
   */
  taskEmbedding?: number[]
}

export interface SuggestResult {
  path: string
  score: number
  /**
   * 'direct'    = matched by keyword token in path
   * 'neighbor'  = reached via 1-hop graph edge (keyword path)
   * 'embedding' = found by cosine similarity only (no keyword match)
   */
  reason: 'direct' | 'neighbor' | 'embedding'
  /**
   * S24.5 — cosine similarity to the task embedding.
   * Only set when opts.taskEmbedding was provided.
   */
  embedScore?: number
}

export function suggestContext(
  projectId: string,
  taskText: string,
  opts: SuggestOpts = {},
): SuggestResult[] {
  const topN      = opts.topN   ?? DEFAULT_TOP
  const expand    = opts.expand ?? true
  const taskEmb   = opts.taskEmbedding

  const tokens = tokenize(taskText)

  // Nothing to score if there are no tokens and no embedding
  if (tokens.length === 0 && !taskEmb) return []

  if (taskEmb) {
    return suggestWithEmbedding(projectId, tokens, taskEmb, topN, expand)
  }
  return suggestKeywordOnly(projectId, tokens, topN, expand)
}

// ── embedding path (S24.4) ────────────────────────────────────────────────────

function suggestWithEmbedding(
  projectId: string,
  tokens: string[],
  taskEmb: number[],
  topN: number,
  expand: boolean,
): SuggestResult[] {
  // Load files with their stored embeddings (NULL if not yet indexed with --embed)
  const allFiles = db.query<{ id: number; path: string; embedding: string | null }, string>(
    'SELECT id, path, embedding FROM files WHERE project_id = ?'
  ).all(projectId)

  if (allFiles.length === 0) return []

  // ── keyword scores (raw, per file) ────────────────────────────────────────
  const rawKw = new Map<number, number>()
  for (const file of allFiles) {
    const norm = file.path.replace(/[\\/._-]/g, ' ').toLowerCase()
    let s = 0
    for (const t of tokens) if (norm.includes(t)) s += TOKEN_WEIGHT
    rawKw.set(file.id, s)
  }
  // Normalise to [0, 1]; guard against all-zero
  const maxKw = Math.max(...rawKw.values(), 1)

  // ── embedding scores (cosine, per file) ───────────────────────────────────
  const embScores = new Map<number, number>()
  for (const file of allFiles) {
    if (!file.embedding) { embScores.set(file.id, 0); continue }
    try {
      const fileEmb = JSON.parse(file.embedding) as number[]
      embScores.set(file.id, Math.max(0, cosine(taskEmb, fileEmb))) // clamp neg to 0
    } catch {
      embScores.set(file.id, 0)
    }
  }

  // ── combine ───────────────────────────────────────────────────────────────
  const scores = new Map<number, { path: string; score: number; embedScore: number; reason: 'direct' | 'embedding' }>()

  for (const file of allFiles) {
    const kwNorm  = (rawKw.get(file.id) ?? 0) / maxKw
    const embNorm = embScores.get(file.id) ?? 0

    const hasKeyword = kwNorm > 0
    const hasEmbed   = embNorm > EMBED_THRESHOLD

    if (!hasKeyword && !hasEmbed) continue

    const finalScore = embNorm * EMBED_WEIGHT + kwNorm * KEYWORD_WEIGHT
    const reason: 'direct' | 'embedding' = hasKeyword ? 'direct' : 'embedding'
    scores.set(file.id, { path: file.path, score: finalScore, embedScore: embNorm, reason })
  }

  // ── 1-hop expansion ───────────────────────────────────────────────────────
  if (expand && scores.size > 0) {
    expandNeighbors(scores, projectId)
  }

  return Array.from(scores.values())
    .map(v => ({
      path:       v.path,
      score:      v.score,
      reason:     v.reason as SuggestResult['reason'],
      embedScore: v.embedScore,
    }))
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
    .slice(0, topN)
}

// ── keyword-only path (S12 legacy, unchanged) ─────────────────────────────────

function suggestKeywordOnly(
  projectId: string,
  tokens: string[],
  topN: number,
  expand: boolean,
): SuggestResult[] {
  const scores = new Map<number, { path: string; score: number; reason: 'direct' | 'neighbor' }>()

  const allFiles = db.query<{ id: number; path: string }, string>(
    'SELECT id, path FROM files WHERE project_id = ?'
  ).all(projectId)

  for (const file of allFiles) {
    const norm = file.path.replace(/[\\/._-]/g, ' ').toLowerCase()
    let s = 0
    for (const token of tokens) if (norm.includes(token)) s += TOKEN_WEIGHT
    if (s > 0) scores.set(file.id, { path: file.path, score: s, reason: 'direct' })
  }

  if (expand && scores.size > 0) {
    const seedIds = Array.from(scores.keys())

    const outgoing = db.query<{ id: number; path: string }, string[]>(
      `SELECT DISTINCT f.id, f.path
       FROM code_edges e
       JOIN files f ON f.id = e.to_file_id
       WHERE e.from_file_id IN (${placeholders(seedIds.length)})
         AND e.to_file_id IS NOT NULL`
    ).all(...seedIds.map(String))

    const incoming = db.query<{ id: number; path: string }, string[]>(
      `SELECT DISTINCT f.id, f.path
       FROM code_edges e
       JOIN files f ON f.id = e.from_file_id
       WHERE e.to_file_id IN (${placeholders(seedIds.length)})`
    ).all(...seedIds.map(String))

    for (const neighbor of [...outgoing, ...incoming]) {
      if (!scores.has(neighbor.id)) {
        scores.set(neighbor.id, { path: neighbor.path, score: HOP_WEIGHT, reason: 'neighbor' })
      } else {
        scores.get(neighbor.id)!.score += HOP_WEIGHT
      }
    }
  }

  return Array.from(scores.values())
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
    .slice(0, topN)
}

// ── shared 1-hop expansion for embedding path ─────────────────────────────────

/**
 * Adds neighbors of seed files to the scores map with a small hop bonus.
 * Seeds = all files currently in scores. Neighbors not in scores get the
 * minimum combined score (EMBED_WEIGHT × 0 + KEYWORD_WEIGHT × 0 + hop bonus).
 */
function expandNeighbors(
  scores: Map<number, { path: string; score: number; embedScore: number; reason: 'direct' | 'embedding' }>,
  _projectId: string,
): void {
  const seedIds = Array.from(scores.keys())
  const HOP_BONUS = EMBED_THRESHOLD / 2  // small boost, below standalone EMBED_THRESHOLD

  const outgoing = db.query<{ id: number; path: string }, string[]>(
    `SELECT DISTINCT f.id, f.path
     FROM code_edges e
     JOIN files f ON f.id = e.to_file_id
     WHERE e.from_file_id IN (${placeholders(seedIds.length)})
       AND e.to_file_id IS NOT NULL`
  ).all(...seedIds.map(String))

  const incoming = db.query<{ id: number; path: string }, string[]>(
    `SELECT DISTINCT f.id, f.path
     FROM code_edges e
     JOIN files f ON f.id = e.from_file_id
     WHERE e.to_file_id IN (${placeholders(seedIds.length)})`
  ).all(...seedIds.map(String))

  for (const nb of [...outgoing, ...incoming]) {
    if (!scores.has(nb.id)) {
      scores.set(nb.id, { path: nb.path, score: HOP_BONUS, embedScore: 0, reason: 'neighbor' as 'direct' })
    }
    // Already-scored seeds: don't modify — embedding score already captures relevance
  }
}

// ── helpers ───────────────────────────────────────────────────────────────────

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(t => t.length >= 3 && !STOP_WORDS.has(t))
    .filter((t, i, arr) => arr.indexOf(t) === i)
}

function placeholders(n: number): string {
  return Array.from({ length: n }, () => '?').join(', ')
}
