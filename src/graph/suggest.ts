/**
 * src/graph/suggest.ts
 *
 * suggestContext(projectId, taskText, opts) → ranked list of file paths relevant to the task.
 *
 * Algorithm (two passes):
 *
 * Pass 1 — direct token match
 *   Tokenize taskText into lowercase words (3+ chars, skip stopwords).
 *   For each indexed file, score += TOKEN_WEIGHT (3) per token that appears as
 *   a substring of the normalized path (slashes → spaces).
 *
 * Pass 2 — 1-hop neighbor expansion
 *   For every seed file (score > 0), fetch its direct imports AND files that
 *   import it from code_edges. Each neighbor gets HOP_WEIGHT (1) added if not
 *   already a seed.
 *
 * Final output: top-N unique paths sorted by score desc, path asc (stable tie-break).
 *
 * Why SQLite queries instead of loading all edges into memory: the graph can be
 * large (10K+ edges in a real repo). We only pull the rows we actually need.
 */

import { db } from '../db/sqlite.ts'

// ── weights ──────────────────────────────────────────────────────────────────

const TOKEN_WEIGHT = 3
const HOP_WEIGHT   = 1
const DEFAULT_TOP  = 10

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
}

export interface SuggestResult {
  path: string
  score: number
  /** 'direct' = matched tokens in path; 'neighbor' = only reached via edge */
  reason: 'direct' | 'neighbor'
}

export function suggestContext(
  projectId: string,
  taskText: string,
  opts: SuggestOpts = {},
): SuggestResult[] {
  const topN   = opts.topN   ?? DEFAULT_TOP
  const expand = opts.expand ?? true

  const tokens = tokenize(taskText)
  if (tokens.length === 0) return []

  // ── pass 1: token match ───────────────────────────────────────────────────

  const scores = new Map<number, { path: string; score: number; reason: 'direct' | 'neighbor' }>()

  const allFiles = db.query<{ id: number; path: string }, string>(
    'SELECT id, path FROM files WHERE project_id = ?'
  ).all(projectId)

  for (const file of allFiles) {
    const normalizedPath = file.path.replace(/[\\/._-]/g, ' ').toLowerCase()
    let fileScore = 0
    for (const token of tokens) {
      if (normalizedPath.includes(token)) {
        fileScore += TOKEN_WEIGHT
      }
    }
    if (fileScore > 0) {
      scores.set(file.id, { path: file.path, score: fileScore, reason: 'direct' })
    }
  }

  // ── pass 2: 1-hop expansion ───────────────────────────────────────────────

  if (expand && scores.size > 0) {
    const seedIds = Array.from(scores.keys())

    // files that seeds import (outgoing edges)
    const outgoing = db.query<{ id: number; path: string }, string[]>(
      `SELECT DISTINCT f.id, f.path
       FROM code_edges e
       JOIN files f ON f.id = e.to_file_id
       WHERE e.from_file_id IN (${placeholders(seedIds.length)})
         AND e.to_file_id IS NOT NULL`
    ).all(...seedIds.map(String))

    // files that import the seeds (incoming edges)
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
        // neighbor is already a seed — boost by hop weight (it's doubly relevant)
        scores.get(neighbor.id)!.score += HOP_WEIGHT
      }
    }
  }

  // ── sort and return top-N ─────────────────────────────────────────────────

  return Array.from(scores.values())
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
    .slice(0, topN)
}

// ── helpers ───────────────────────────────────────────────────────────────────

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(t => t.length >= 3 && !STOP_WORDS.has(t))
    .filter((t, i, arr) => arr.indexOf(t) === i) // deduplicate
}

function placeholders(n: number): string {
  return Array.from({ length: n }, () => '?').join(', ')
}
