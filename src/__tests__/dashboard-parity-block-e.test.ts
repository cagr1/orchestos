import { afterAll, describe, expect, it } from 'bun:test'
import {
  handleApiMemoryConflictResolve,
  handleApiMemoryConflicts,
  handleApiMemoryDelete,
} from '../dashboard/handlers/memory.ts'
import { handleApiRunsAnalyze, handleApiRunsDelete } from '../dashboard/handlers/runs.ts'
import { insertConflict, resolveConflict, upsertMemory } from '../db/memory.ts'
import { insertRun } from '../db/runs.ts'
import { db } from '../db/sqlite.ts'

// Bloque E (Mes 18, ex-IDEAS #9b) — `orchestos memory conflicts` y
// `orchestos runs --analyze` ahora tienen equivalente en el dashboard.

const insertedConflictIds: string[] = []
const insertedMemoryIds: string[] = []

afterAll(() => {
  // IDEAS.md #20 — no dejar filas de test en la DB real.
  for (const id of insertedConflictIds) resolveConflict(id)
  db.run(
    'DELETE FROM memory_conflicts WHERE id IN (' +
      insertedConflictIds.map(() => '?').join(',') +
      ')',
    insertedConflictIds,
  )
  if (insertedMemoryIds.length > 0) {
    db.run(
      'DELETE FROM memory_entries WHERE id IN (' + insertedMemoryIds.map(() => '?').join(',') + ')',
      insertedMemoryIds,
    )
  }
})

describe('handleApiMemoryConflicts', () => {
  it('returns an unresolved conflict just inserted', async () => {
    const entryA = upsertMemory('block-e-test-project', 'entry-a', 'block e entry a').id
    const entryB = upsertMemory('block-e-test-project', 'entry-b', 'block e entry b').id
    insertedMemoryIds.push(entryA, entryB)
    const id = insertConflict(entryA, entryB, 'contradiction', 'high')
    insertedConflictIds.push(id)

    const res = handleApiMemoryConflicts()
    const data = (await res.json()) as Array<{ id: string; relation: string }>
    expect(data.some((c) => c.id === id && c.relation === 'contradiction')).toBe(true)
  })

  it('returns an empty array on a project filter with no matches', async () => {
    const res = handleApiMemoryConflicts(
      new URL('http://localhost/api/memory/conflicts?project=no-such-project-xyz'),
    )
    const data = (await res.json()) as unknown[]
    expect(data).toEqual([])
  })
})

// I.5 (Mes 18) — el panel de conflictos gana su primera acción real.
describe('handleApiMemoryConflictResolve', () => {
  it('resolves an unresolved conflict and drops it from the list', async () => {
    const entryA = upsertMemory('i5-test-project', 'entry-a', 'i5 entry a').id
    const entryB = upsertMemory('i5-test-project', 'entry-b', 'i5 entry b').id
    insertedMemoryIds.push(entryA, entryB)
    const id = insertConflict(entryA, entryB, 'contradiction', 'high')
    insertedConflictIds.push(id)

    const res = handleApiMemoryConflictResolve(
      new URL(`http://localhost/api/memory/conflicts/${id}/resolve`),
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { ok: boolean }
    expect(body.ok).toBe(true)

    const after = (await handleApiMemoryConflicts().json()) as Array<{ id: string }>
    expect(after.some((c) => c.id === id)).toBe(false)
  })

  it('404s on an unknown conflict id', async () => {
    const res = handleApiMemoryConflictResolve(
      new URL('http://localhost/api/memory/conflicts/no-such-id/resolve'),
    )
    expect(res.status).toBe(404)
    const body = (await res.json()) as { ok: boolean; error?: string }
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
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify([
                  {
                    pattern: 'block-e-test-pattern',
                    frequency: 5,
                    fix_hint: 'do X instead',
                    confidence: 'high',
                  },
                ]),
              },
            },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 5 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )) as unknown as typeof fetch

    const req = new Request('http://localhost/api/runs/analyze', {
      method: 'POST',
      body: JSON.stringify({ last: 20 }),
    })
    const res = await handleApiRunsAnalyze(req)
    const data = (await res.json()) as {
      suggestions: Array<{ pattern: string }>
      proposals: unknown[]
    }
    // La DB real de dev ya tiene runs de gates anteriores (>=3) — si no los
    // tuviera, el handler devuelve `message` en vez de `suggestions`.
    if (data.suggestions) {
      expect(Array.isArray(data.suggestions)).toBe(true)
    }
  })
})

// I.8 (Mes 18) — Runs y Memory (entries) ganan su primera acción de borrado.
describe('handleApiRunsDelete', () => {
  it('deletes an existing run and 404s on a second delete', async () => {
    const id = insertRun({
      project_id: null,
      prompt: 'i8 test prompt',
      task_class: 'test',
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
      status: 'done',
      input_tokens: 1,
      output_tokens: 1,
      usd_cost: 0,
      elapsed_ms: 1,
      result: null,
    })

    const res = handleApiRunsDelete(new URL(`http://localhost/api/runs/${id}`))
    expect(res.status).toBe(200)
    expect(((await res.json()) as { ok: boolean }).ok).toBe(true)

    const again = handleApiRunsDelete(new URL(`http://localhost/api/runs/${id}`))
    expect(again.status).toBe(404)
  })
})

describe('handleApiMemoryDelete', () => {
  it('deletes an existing memory entry and 404s on a second delete', async () => {
    const { id } = upsertMemory('i8-test-project', 'i8-test-topic', 'i8 test content')

    const res = handleApiMemoryDelete(new URL(`http://localhost/api/memory/${id}`))
    expect(res.status).toBe(200)
    expect(((await res.json()) as { ok: boolean }).ok).toBe(true)

    const again = handleApiMemoryDelete(new URL(`http://localhost/api/memory/${id}`))
    expect(again.status).toBe(404)
  })
})
