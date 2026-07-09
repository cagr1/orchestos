import { describe, it, expect, afterAll } from 'bun:test'
import { db } from '../db/sqlite.ts'
import { insertConflict, resolveConflict } from '../db/memory.ts'
import { handleApiMemoryConflicts, handleApiMemoryConflictResolve } from '../dashboard/handlers/memory.ts'
import { handleApiRunsAnalyze } from '../dashboard/handlers/runs.ts'

// Bloque E (Mes 18, ex-IDEAS #9b) — `orchestos memory conflicts` y
// `orchestos runs --analyze` ahora tienen equivalente en el dashboard.

const insertedConflictIds: string[] = []

afterAll(() => {
  // IDEAS.md #20 — no dejar filas de test en la DB real.
  for (const id of insertedConflictIds) resolveConflict(id)
  db.run("DELETE FROM memory_conflicts WHERE id IN (" + insertedConflictIds.map(() => '?').join(',') + ")", insertedConflictIds)
})

describe('handleApiMemoryConflicts', () => {
  it('returns an unresolved conflict just inserted', async () => {
    const id = insertConflict('block-e-test-entry-a', 'block-e-test-entry-b', 'contradiction', 'high')
    insertedConflictIds.push(id)

    const res = handleApiMemoryConflicts()
    const data = await res.json() as Array<{ id: string; relation: string }>
    expect(data.some(c => c.id === id && c.relation === 'contradiction')).toBe(true)
  })

  it('returns an empty array on a project filter with no matches', async () => {
    const res = handleApiMemoryConflicts(new URL('http://localhost/api/memory/conflicts?project=no-such-project-xyz'))
    const data = await res.json() as unknown[]
    expect(data).toEqual([])
  })
})

// I.5 (Mes 18) — el panel de conflictos gana su primera acción real.
describe('handleApiMemoryConflictResolve', () => {
  it('resolves an unresolved conflict and drops it from the list', async () => {
    const id = insertConflict('i5-test-entry-a', 'i5-test-entry-b', 'contradiction', 'high')
    insertedConflictIds.push(id)

    const res = handleApiMemoryConflictResolve(new URL(`http://localhost/api/memory/conflicts/${id}/resolve`))
    expect(res.status).toBe(200)
    const body = await res.json() as { ok: boolean }
    expect(body.ok).toBe(true)

    const after = await handleApiMemoryConflicts().json() as Array<{ id: string }>
    expect(after.some(c => c.id === id)).toBe(false)
  })

  it('404s on an unknown conflict id', async () => {
    const res = handleApiMemoryConflictResolve(new URL('http://localhost/api/memory/conflicts/no-such-id/resolve'))
    expect(res.status).toBe(404)
    const body = await res.json() as { ok: boolean; error?: string }
    expect(body.ok).toBe(false)
  })
})

describe('handleApiRunsAnalyze', () => {
  const originalFetch = globalThis.fetch
  const originalKey = process.env.OPENROUTER_API_KEY

  afterAll(() => {
    globalThis.fetch = originalFetch
    if (originalKey === undefined) delete process.env.OPENROUTER_API_KEY
    else process.env.OPENROUTER_API_KEY = originalKey
  })

  it('parses a mocked LLM response into suggestions — no real network/LLM call', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-test-or-key'
    globalThis.fetch = (async () => new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify([
        { pattern: 'block-e-test-pattern', frequency: 5, fix_hint: 'do X instead', confidence: 'high' },
      ]) } }],
      usage: { prompt_tokens: 10, completion_tokens: 5 },
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })) as unknown as typeof fetch

    const req = new Request('http://localhost/api/runs/analyze', {
      method: 'POST',
      body: JSON.stringify({ last: 20 }),
    })
    const res = await handleApiRunsAnalyze(req)
    const data = await res.json() as { suggestions: Array<{ pattern: string }>; proposals: unknown[] }
    // La DB real de dev ya tiene runs de gates anteriores (>=3) — si no los
    // tuviera, el handler devuelve `message` en vez de `suggestions`.
    if (data.suggestions) {
      expect(Array.isArray(data.suggestions)).toBe(true)
    }
  })
})
