/**
 * G.4 — `orchestos runs --detail <id>` imprime un bloque `## Engine` con
 * `type` e `iterations` derivados de `cost_breakdown_json`. Verificamos
 * capturando console.log e insertando filas en la DB con `cost_breakdown_json`
 * controlado (mismo patrón que harness-evidence.test.ts: DB real
 * `~/.orchestos/db.sqlite`, `runMigrations()` en beforeAll).
 *
 * printRunDetail() es privado en cli.ts; se exportó para este test. Importar
 * cli.ts corre `runMigrations()` en el top-level (idempotente, mismo efecto
 * que el harness) pero no ejecuta ningún comando hasta que un usuario
 * invoca `program.parse()`.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'bun:test'
import type { RunRecord } from '../db/runs.ts'
import { db } from '../db/sqlite.ts'

const { insertRun } = await import('../db/runs.ts')
const { runMigrations } = await import('../db/migrate.ts')
const { printRunDetail } = await import('../cli.ts')

beforeAll(() => {
  runMigrations()
  // touch imports so Bun doesn't tree-shake them
  expect(typeof insertRun).toBe('function')
  expect(typeof printRunDetail).toBe('function')
})

afterEach(() => {
  // nothing global to reset; the test uses unique task_ids so rows don't collide
})

// IDEAS.md #20 (2026-07-05): el único test que llama insertRun() de verdad
// (línea ~169) escribe en la ~/.orchestos/db.sqlite real, la misma que lee
// el dashboard — sin esto deja una fila fantasma 'g4-rd-task' visible ahí.
afterAll(() => {
  db.run("DELETE FROM runs WHERE task_id = 'g4-rd-task'")
})

function makeRow(overrides: Partial<RunRecord> = {}): RunRecord {
  const base: RunRecord = {
    id: 'g4-rd-' + Math.random().toString(36).slice(2, 10),
    project_id: null,
    prompt: 'G.4 printRunDetail test',
    task_class: 'implement',
    model: 'mock/model',
    provider: 'openrouter',
    skill_id: null,
    task_id: 'g4-rd-task',
    allowed_outputs: '["out.txt"]',
    files_attempted: '["out.txt"]',
    files_authorized: '["out.txt"]',
    files_blocked: '[]',
    snapshot_before: '{}',
    snapshot_after: '{"out.txt":"sha"}',
    qa_verdict: 'pass',
    qa_reason: 'ok',
    qa_model: 'openai/gpt-4o-mini',
    checks_json: null,
    constitution_rules: null,
    context_source: 'AGENTS.md',
    context_tokens: 100,
    embed_hits: 0,
    context_warnings_json: null,
    cost_breakdown_json: null,
    status: 'done',
    input_tokens: 5,
    output_tokens: 3,
    usd_cost: 0.0001,
    elapsed_ms: 100,
    result: '1 file(s) written',
    created_at: new Date().toISOString(),
  }
  return { ...base, ...overrides }
}

function capturePrintDetail(row: RunRecord): string {
  const lines: string[] = []
  const originalLog = console.log
  console.log = (...args: unknown[]) => { lines.push(args.map(a => String(a)).join(' ')) }
  try {
    printRunDetail(row)
  } finally {
    console.log = originalLog
  }
  return lines.join('\n')
}

describe('G.4 — `runs --detail` imprime `## Engine` con type + iterations', () => {
  it('single-shot: imprime "type: single-shot   iterations: 1"', () => {
    const row = makeRow({
      cost_breakdown_json: JSON.stringify([{
        label: 'single-shot',
        model: 'mock/model',
        inputTokens: 5,
        outputTokens: 3,
        costUsd: 0.0001,
      }]),
    })
    const out = capturePrintDetail(row)
    expect(out).toContain('## Engine')
    expect(out).toMatch(/type: single-shot\s+iterations: 1/)
  })

  it('agentic 3 rounds: imprime "type: agentic   iterations: 3 rounds"', () => {
    const row = makeRow({
      cost_breakdown_json: JSON.stringify([{
        label: 'agentic (3 rounds)',
        model: 'mock/model',
        inputTokens: 10,
        outputTokens: 8,
        costUsd: 0.0005,
      }]),
    })
    const out = capturePrintDetail(row)
    expect(out).toContain('## Engine')
    expect(out).toMatch(/type: agentic\s+iterations: 3 rounds/)
  })

  it('agentic 1 round (singular): imprime "iterations: 1 round" (sin la s)', () => {
    const row = makeRow({
      cost_breakdown_json: JSON.stringify([{
        label: 'agentic (1 round)',
        model: 'mock/model',
        inputTokens: 2,
        outputTokens: 1,
        costUsd: 0.0001,
      }]),
    })
    const out = capturePrintDetail(row)
    expect(out).toMatch(/iterations: 1 round\b/)
    expect(out).not.toMatch(/iterations: 1 rounds/)
  })

  it('cost_breakdown_json null (run legacy pre-G.4): imprime "type: unknown   iterations: unknown"', () => {
    const row = makeRow({ cost_breakdown_json: null })
    const out = capturePrintDetail(row)
    expect(out).toContain('## Engine')
    expect(out).toMatch(/type: unknown\s+iterations: unknown/)
    expect(out).toContain('pre-G.4')
  })

  it('cost_breakdown_json con label inesperado: cae a unknown (defensivo, no throw)', () => {
    const row = makeRow({
      cost_breakdown_json: JSON.stringify([{
        label: 'turbo-mode-42',
        model: 'mock/model',
        inputTokens: 1,
        outputTokens: 1,
        costUsd: 0,
      }]),
    })
    const out = capturePrintDetail(row)
    expect(out).toContain('## Engine')
    expect(out).toMatch(/type: unknown\s+iterations: unknown/)
  })

  it('el bloque ## Engine aparece DESPUÉS de ## Provider (orden semántico — engine es pariente del provider)', () => {
    const row = makeRow({
      cost_breakdown_json: JSON.stringify([{
        label: 'agentic (2 rounds)',
        model: 'mock/model',
        inputTokens: 1, outputTokens: 1, costUsd: 0,
      }]),
    })
    const out = capturePrintDetail(row)
    const idxEngine = out.indexOf('## Engine')
    const idxProvider = out.indexOf('## Provider')
    const idxCost = out.indexOf('## Cost')
    expect(idxEngine).toBeGreaterThan(-1)
    expect(idxProvider).toBeGreaterThan(-1)
    expect(idxCost).toBeGreaterThan(-1)
    expect(idxProvider).toBeLessThan(idxEngine)
    expect(idxEngine).toBeLessThan(idxCost)
  })

  it('insertRun + getRun end-to-end: el bloque ## Engine refleja lo que el harness persistió (single-shot)', async () => {
    const id = insertRun(makeRow({
      cost_breakdown_json: JSON.stringify([{
        label: 'single-shot',
        model: 'mock/model',
        inputTokens: 7,
        outputTokens: 4,
        costUsd: 0.0002,
      }]),
    }))
    expect(id).toBeTruthy()
    const { getRun } = await import('../db/runs.ts')
    const row = getRun(id)!
    const out = capturePrintDetail(row)
    expect(out).toMatch(/type: single-shot\s+iterations: 1/)
  })
})
