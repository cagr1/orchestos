/**
 * G.4 — el harness persiste `cost_breakdown_json` en cada `insertRun` del
 * success path, con un label canónico que el dashboard y `runs --detail`
 * pueden parsear para derivar `engine` + `iterations`:
 *   - single-shot → label "single-shot", iterations 1
 *   - agentic     → label "agentic (N rounds)", iterations N
 *
 * Misma estrategia que harness-evidence.test.ts: mock globalThis.fetch, leer
 * el runId retornado por runTask(), consultar getRun() para inspeccionar la fila
 * persistida. No mockeamos módulos.
 */
import { describe, it, expect, beforeAll, afterEach } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { _resetCatalog } from '../router/model-catalog.ts'
import type { Task } from '../tasks/schema.ts'

// Seedea el catálogo de modelos en un ORCHESTOS_HOME temporal para que
// ensureCatalogLoaded() lo lea de disco y NO consuma un handler del mock fetch.
// OJO: model-catalog.ts:cacheFilePath() resuelve a ${ORCHESTOS_HOME}/.orchestos/cache/models.json
// (con `.orchestos/` interpuesto), no a ${ORCHESTOS_HOME}/cache/models.json.
function seedCatalog(): string {
  const home = mkdtempSync(join(tmpdir(), 'orchestos-test-cat-'))
  mkdirSync(join(home, '.orchestos', 'cache'), { recursive: true })
  writeFileSync(join(home, '.orchestos', 'cache', 'models.json'), JSON.stringify({
    fetchedAt: Date.now(),
    models: {
      'anthropic/claude-haiku-4-5': { contextLength: 200000, priceIn: 0.8, priceOut: 4, supportsReasoning: false, maxOutputTokens: 8192 },
    },
  }))
  return home
}

const _testOrchHome = seedCatalog()
const originalFetch = globalThis.fetch
const originalKey = process.env.OPENROUTER_API_KEY

beforeAll(async () => {
  process.env.ORCHESTOS_HOME = _testOrchHome
  // Limpia el catálogo en memoria de tests anteriores en el mismo proceso.
  _resetCatalog()
  const { runMigrations } = await import('../db/migrate.ts')
  runMigrations()
})

afterEach(() => {
  globalThis.fetch = originalFetch
  if (originalKey === undefined) delete process.env.OPENROUTER_API_KEY
  else process.env.OPENROUTER_API_KEY = originalKey
})

function tmpDir(): string {
  return mkdtempSync(join(tmpdir(), 'orchestos-g4-persist-'))
}

function openRouterResponse(content: string, promptTokens = 5, completionTokens = 3) {
  return new Response(JSON.stringify({
    choices: [{ message: { content } }],
    usage: { prompt_tokens: promptTokens, completion_tokens: completionTokens },
    model: 'mock/model',
  }), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

function toolCallResponse(calls: Array<{ name: string; args: unknown }>) {
  return new Response(JSON.stringify({
    choices: [{
      message: {
        content: null,
        tool_calls: calls.map((c, i) => ({
          id: `call_${i}`, type: 'function',
          function: { name: c.name, arguments: JSON.stringify(c.args) },
        })),
      },
    }],
    usage: { prompt_tokens: 10, completion_tokens: 5 },
    model: 'mock/model',
  }), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

function installMockFetch(handlers: Array<() => Response>) {
  let i = 0
  globalThis.fetch = (async () => {
    const handler = handlers[i++]
    if (!handler) throw new Error(`mock fetch: no handler for call #${i}`)
    return handler()
  }) as unknown as typeof fetch
}

function baseTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'g4-persist-test',
    description: 'G.4 cost_breakdown_json persistence test',
    executor: 'openrouter',
    input: [],
    output: ['out.txt'],
    depends_on: [],
    status: 'pending',
    retry_count: 0,
    ...overrides,
  }
}

async function callRunTask(task: ReturnType<typeof baseTask>, dir: string, engine: 'single-shot' | 'agentic' = 'single-shot') {
  const { runTask } = await import('../run/harness.ts')
  const { RunLogger } = await import('../run/logger.ts')
  const log = new RunLogger(dir, task.id)
  // Para agentic, necesitamos un modelo que soporte tool-calling (anthropic/claude-haiku-4-5
  // sí, deepseek/deepseek-v4-flash no — engine-selection.test.ts ya verificó el fallback).
  return runTask({
    projectRoot: dir,
    contextText: '',
    task: { ...task, engine },
    logger: log,
    sandboxMode: 'cwd',
    modelOverride: 'anthropic/claude-haiku-4-5',
  })
}

async function rowBreakdownFor(runId: string): Promise<Array<{ label: string; model: string; inputTokens: number; outputTokens: number; costUsd: number }>> {
  const { getRun } = await import('../db/runs.ts')
  const row = getRun(runId)
  expect(row).not.toBeNull()
  expect(row!.cost_breakdown_json).not.toBeNull()
  return JSON.parse(row!.cost_breakdown_json!)
}

describe('G.4 — cost_breakdown_json persistido en cada insertRun (gap de G.3)', () => {
  it('single-shot success: fila persistida tiene cost_breakdown_json con label "single-shot" y tokens reales', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-test-or-key'
    installMockFetch([
      () => openRouterResponse('<<<FILE:out.txt>>>\nhello\n<<<ENDFILE>>>', 7, 4),
      () => openRouterResponse('{"verdict":"pass","reason":"ok"}', 3, 2),
    ])

    const dir = tmpDir()
    try {
      const result = await callRunTask(baseTask(), dir, 'single-shot')
      expect(result.status).toBe('done')
      const breakdown = await rowBreakdownFor(result.runId)
      expect(breakdown).toHaveLength(1)
      expect(breakdown[0]!.label).toBe('single-shot')
      // El modelo lo resuelve el router (con modelOverride='anthropic/claude-haiku-4-5'
      // en callRunTask), no el del response body. La costByIteration registra el modelo
      // que single-shot.ts vio en ctx.model, que es el override.
      expect(breakdown[0]!.model).toBe('anthropic/claude-haiku-4-5')
      expect(breakdown[0]!.inputTokens).toBe(7)
      expect(breakdown[0]!.outputTokens).toBe(4)
      expect(breakdown[0]!.costUsd).toBeGreaterThan(0)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('agentic success: fila persistida tiene cost_breakdown_json con label "agentic (N rounds)"', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-test-or-key'
    // 2 rondas de tool-calling antes del summary final + QA = 3 fetches totales
    installMockFetch([
      () => toolCallResponse([{ name: 'write_file', args: { path: 'out.txt', content: 'agentic hi' } }]),
      () => openRouterResponse('Done — wrote out.txt', 5, 3),
      () => openRouterResponse('{"verdict":"pass","reason":"ok"}', 2, 1),
    ])

    const dir = tmpDir()
    try {
      const result = await callRunTask(baseTask(), dir, 'agentic')
      expect(result.status).toBe('done')
      const breakdown = await rowBreakdownFor(result.runId)
      expect(breakdown).toHaveLength(1)
      // G.3 limitation honesta: runToolLoop agrega tokens en un total único, no
      // expone desglose por ronda — la etiqueta dice "agentic (N rounds)" con N
      // total del loop, no N entradas individuales.
      expect(breakdown[0]!.label).toMatch(/^agentic \(\d+ rounds?\)$/)
      expect(breakdown[0]!.label).toBe('agentic (2 rounds)')
      expect(breakdown[0]!.model).toBe('anthropic/claude-haiku-4-5')
      expect(breakdown[0]!.inputTokens).toBeGreaterThan(0)
      expect(breakdown[0]!.outputTokens).toBeGreaterThan(0)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('parse error (single-shot): cost_breakdown_json queda null — el engine tiró ExecutorParseError, no hay outcome', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-test-or-key'
    installMockFetch([() => openRouterResponse('this has no file blocks', 2, 1)])

    const dir = tmpDir()
    try {
      const result = await callRunTask(baseTask(), dir, 'single-shot')
      expect(result.status).toBe('failed')
      const { getRun } = await import('../db/runs.ts')
      const row = getRun(result.runId)!
      expect(row.status).toBe('failed')
      expect(row.cost_breakdown_json).toBeNull()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('contract violation (single-shot): cost_breakdown_json se persiste con label "single-shot"', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-test-or-key'
    installMockFetch([() => openRouterResponse('<<<FILE:rogue.txt>>>\nx\n<<<ENDFILE>>>', 5, 3)])

    const dir = tmpDir()
    try {
      const result = await callRunTask(baseTask({ output: ['out.txt'] }), dir, 'single-shot')
      expect(result.status).toBe('failed')
      const breakdown = await rowBreakdownFor(result.runId)
      expect(breakdown[0]!.label).toBe('single-shot')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('QA fail (single-shot): cost_breakdown_json se persiste con label "single-shot"', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-test-or-key'
    installMockFetch([
      () => openRouterResponse('<<<FILE:out.txt>>>\nhello\n<<<ENDFILE>>>', 5, 3),
      () => openRouterResponse('{"verdict":"fail","reason":"no good"}', 3, 2),
    ])

    const dir = tmpDir()
    try {
      const result = await callRunTask(baseTask(), dir, 'single-shot')
      expect(['failed', 'retry']).toContain(result.status)
      const breakdown = await rowBreakdownFor(result.runId)
      expect(breakdown[0]!.label).toBe('single-shot')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
