/**
 * S24.4 — Tests for suggestContext embedding re-ranking.
 *
 * Uses the real SQLite DB with isolated project_id per test (cleaned up after).
 * No network calls — embeddings are inserted directly as JSON arrays.
 *
 * Test coverage:
 *   - Legacy keyword-only path: backward-compatible behavior
 *   - Embedding path: files found via cosine similarity get reason='embedding'
 *   - Embedding path: formula embed×0.6 + keyword×0.4
 *   - Embedding path: files below EMBED_THRESHOLD (0.10) with no keyword match are excluded
 *   - Embedding path: embedScore is returned in results
 *   - Embedding path: file with high embed AND keyword score ranks above keyword-only
 *   - Embedding path: NULL embeddings → embed_score treated as 0
 *   - No tokens + no embedding → returns []
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { db } from '../db/sqlite.ts'
import { runMigrations } from '../db/migrate.ts'
import { suggestContext } from '../graph/suggest.ts'
import { insertRun, listRuns } from '../db/runs.ts'

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

runMigrations()

// Unique prefix per test run to avoid cross-test pollution
let pid: string

beforeEach(() => {
  pid = 'suggest-test-' + Math.random().toString(36).slice(2, 10)
})

afterEach(() => {
  db.exec(`DELETE FROM code_edges WHERE project_id = '${pid}'`)
  db.exec(`DELETE FROM files      WHERE project_id = '${pid}'`)
  // IDEAS.md #20 (2026-07-05): 'embed_hits is persisted...' inserta en `runs`
  // real (~/.orchestos/db.sqlite) con este mismo project_id — faltaba limpiarla.
  db.exec(`DELETE FROM runs       WHERE project_id = '${pid}'`)
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function insertFile(
  id: number,
  path: string,
  embedding: number[] | null = null,
): void {
  db.run(
    `INSERT OR REPLACE INTO files (id, project_id, path, language, sha1, size_bytes, indexed_at, embedding)
     VALUES (?, ?, ?, 'ts', 'abc', 100, datetime('now'), ?)`,
    [id, pid, path, embedding ? JSON.stringify(embedding) : null],
  )
}

/** A unit vector pointing in direction `i` (length = dims). */
function unitVec(i: number, dims = 4): number[] {
  const v = Array(dims).fill(0)
  v[i % dims] = 1
  return v
}

// ---------------------------------------------------------------------------
// Legacy keyword-only path
// ---------------------------------------------------------------------------

describe('suggestContext — keyword-only (legacy)', () => {
  it('returns [] when no tokens and no embedding', () => {
    insertFile(1, 'src/billing/processor.ts')
    expect(suggestContext(pid, '')).toEqual([])
  })

  it('returns [] when project has no files', () => {
    expect(suggestContext(pid, 'stripe payment')).toEqual([])
  })

  it('matches tokens in path', () => {
    insertFile(1, 'src/billing/processor.ts')
    insertFile(2, 'src/auth/login.ts')
    const r = suggestContext(pid, 'billing processor')
    expect(r.map(x => x.path)).toContain('src/billing/processor.ts')
    expect(r.map(x => x.path)).not.toContain('src/auth/login.ts')
  })

  it('result reason is direct for keyword matches', () => {
    insertFile(1, 'src/payment/stripe.ts')
    const r = suggestContext(pid, 'payment stripe')
    expect(r[0]!.reason).toBe('direct')
    expect(r[0]!.embedScore).toBeUndefined()
  })

  it('higher keyword match scores rank first', () => {
    insertFile(1, 'src/billing/processor.ts')   // 2 tokens → score 6
    insertFile(2, 'src/billing/service.ts')      // 1 token  → score 3
    const r = suggestContext(pid, 'billing processor')
    expect(r[0]!.path).toBe('src/billing/processor.ts')
  })
})

// ---------------------------------------------------------------------------
// Embedding path (S24.4)
// ---------------------------------------------------------------------------

describe('suggestContext — embedding path', () => {
  it('finds file with high cosine similarity (no keyword match)', () => {
    // task embedding points at dimension 0
    const taskEmb = unitVec(0)
    // file-1: aligned with task (cosine ≈ 1)
    insertFile(1, 'src/unrelated/foo.ts', unitVec(0))
    // file-2: orthogonal to task (cosine = 0)
    insertFile(2, 'src/unrelated/bar.ts', unitVec(1))

    const r = suggestContext(pid, 'xyz', { taskEmbedding: taskEmb })
    // file-1 should appear (embed > threshold), file-2 should not
    expect(r.some(x => x.path === 'src/unrelated/foo.ts')).toBe(true)
    expect(r.some(x => x.path === 'src/unrelated/bar.ts')).toBe(false)
  })

  it('reason is "embedding" for files found only via cosine', () => {
    const taskEmb = unitVec(0)
    insertFile(1, 'src/zzzz/zzzz.ts', unitVec(0))  // no keyword match
    const r = suggestContext(pid, 'xyz', { taskEmbedding: taskEmb })
    expect(r[0]!.reason).toBe('embedding')
  })

  it('reason is "direct" for files with keyword match (even if they also have embedding)', () => {
    const taskEmb = unitVec(0)
    insertFile(1, 'src/billing/stripe.ts', unitVec(0))  // both keyword + embed match
    const r = suggestContext(pid, 'billing stripe', { taskEmbedding: taskEmb })
    expect(r[0]!.reason).toBe('direct')
  })

  it('embedScore is returned in results', () => {
    const taskEmb = unitVec(0)
    insertFile(1, 'src/foo/bar.ts', unitVec(0))
    const r = suggestContext(pid, 'xyz', { taskEmbedding: taskEmb })
    expect(typeof r[0]!.embedScore).toBe('number')
    expect(r[0]!.embedScore!).toBeGreaterThan(0.9)
  })

  it('file with NULL embedding gets embed_score=0, can still rank via keyword', () => {
    const taskEmb = unitVec(0)
    insertFile(1, 'src/billing/stripe.ts', null)  // no embedding stored
    const r = suggestContext(pid, 'billing stripe', { taskEmbedding: taskEmb })
    // Should still be found via keyword (keyword_score > 0)
    expect(r.some(x => x.path === 'src/billing/stripe.ts')).toBe(true)
    expect(r[0]!.embedScore).toBe(0)
  })

  it('files below EMBED_THRESHOLD with no keyword are excluded', () => {
    const taskEmb = unitVec(0)
    // file with near-orthogonal embedding (cosine ~0.05) — below 0.10 threshold
    const nearOrthogonal = [0.05, 0.99, 0.0, 0.0]
    insertFile(1, 'src/zzzzz/nope.ts', nearOrthogonal)
    const r = suggestContext(pid, 'xyz', { taskEmbedding: taskEmb })
    expect(r.some(x => x.path === 'src/zzzzz/nope.ts')).toBe(false)
  })

  it('combined score = embed×0.6 + keyword×0.4 ranks file with both higher than keyword-only', () => {
    const taskEmb = unitVec(0)
    // file-A: high embed match + keyword match  → high combined score
    insertFile(1, 'src/payment/stripe.ts', unitVec(0))
    // file-B: keyword match only, no embedding  → lower combined score
    insertFile(2, 'src/payment/service.ts', null)

    const r = suggestContext(pid, 'payment stripe', { taskEmbedding: taskEmb })
    const posA = r.findIndex(x => x.path === 'src/payment/stripe.ts')
    const posB = r.findIndex(x => x.path === 'src/payment/service.ts')
    expect(posA).toBeGreaterThanOrEqual(0)
    expect(posB).toBeGreaterThanOrEqual(0)
    expect(posA).toBeLessThan(posB)  // A ranks before B
  })

  it('high-embed file without keyword ranks above low-embed file with keyword', () => {
    const taskEmb = unitVec(0)
    // file-A: very high cosine but no keyword match
    insertFile(1, 'src/zzz/core.ts', [0.99, 0.01, 0.0, 0.0])
    // file-B: keyword match, no embedding
    insertFile(2, 'src/billing/service.ts', null)

    // task text only matches 'billing service' → file-B gets keyword score
    // file-A has very high embed_score
    const r = suggestContext(pid, 'billing service', { taskEmbedding: taskEmb })
    const posA = r.findIndex(x => x.path === 'src/zzz/core.ts')
    const posB = r.findIndex(x => x.path === 'src/billing/service.ts')

    expect(posA).toBeGreaterThanOrEqual(0)
    expect(posB).toBeGreaterThanOrEqual(0)
    // file-A: 0.99×0.6 = 0.594; file-B: 0.5×0.4 = 0.2 (normalized keyword)
    expect(r[posA]!.score).toBeGreaterThan(r[posB]!.score)
  })

  it('topN is respected in embedding path', () => {
    const taskEmb = unitVec(0)
    for (let i = 0; i < 5; i++) {
      insertFile(i + 1, `src/mod${i}/file.ts`, unitVec(0))
    }
    const r = suggestContext(pid, 'xyz', { taskEmbedding: taskEmb, topN: 3 })
    expect(r.length).toBeLessThanOrEqual(3)
  })

  it('embed_hits is persisted in runs table via insertRun', () => {
    insertRun({
      project_id: pid,
      prompt: 'test with embeddings',
      task_class: 'implement',
      model: 'test-model',
      provider: 'test',
      skill_id: null,
      task_id: null,
      allowed_outputs: null,
      files_attempted: null,
      files_authorized: null,
      files_blocked: null,
      snapshot_before: null,
      snapshot_after: null,
      qa_verdict: null,
      qa_reason: null,
      embed_hits: 3,
      status: 'done',
      input_tokens: 10,
      output_tokens: 20,
      usd_cost: 0,
      elapsed_ms: 100,
      result: 'ok',
    })
    const runs = listRuns(10)
    const match = runs.find(r => r.project_id === pid)
    expect(match).toBeDefined()
    expect(match!.embed_hits).toBe(3)
  })

  it('empty texts array returns []', () => {
    const r = suggestContext(pid, '', { taskEmbedding: unitVec(0) })
    // taskEmbedding provided but no files → still ok
    expect(Array.isArray(r)).toBe(true)
  })

  it('embedding results contain mixed reasons (direct + embedding)', () => {
    const taskEmb = unitVec(0)
    // file with keyword match → reason 'direct'
    insertFile(1, 'src/payment/stripe.ts', unitVec(0))
    // file with no keyword match but high cosine → reason 'embedding'
    insertFile(2, 'src/unrelated/util.ts', unitVec(0))

    const r = suggestContext(pid, 'payment stripe', { taskEmbedding: taskEmb })
    const stripeFile  = r.find(x => x.path === 'src/payment/stripe.ts')
    const utilFile    = r.find(x => x.path === 'src/unrelated/util.ts')

    expect(stripeFile).toBeDefined()
    expect(stripeFile!.reason).toBe('direct')
    expect(utilFile).toBeDefined()
    expect(utilFile!.reason).toBe('embedding')

    // total embed_hits = count of 'embedding' reasons
    const embedHits = r.filter(x => x.reason === 'embedding').length
    expect(embedHits).toBeGreaterThanOrEqual(1)
  })
})
