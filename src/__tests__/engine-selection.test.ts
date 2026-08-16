import { describe, it, expect, beforeAll, afterAll, afterEach } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, readFileSync, readdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { db } from '../db/sqlite.ts'
import { _resetCatalog } from '../router/model-catalog.ts'
import { validateTask, type Task } from '../tasks/schema.ts'
import type { OrcheConfig } from '../config/schema.ts'
import { loadOrcheConfig } from '../config/load.ts'

// G.3 — engine resolution end-to-end through runTask(): task.engine wins over
// orcheConfig.executorEngine, default is 'single-shot' (zero behavior change
// for every existing task that doesn't opt in), and requesting 'agentic' with
// a model that doesn't support tool-calling falls back to single-shot with a
// logged warning instead of failing the task.

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
      'deepseek/deepseek-v4-flash': { contextLength: 128000, priceIn: 0.15, priceOut: 0.6, supportsReasoning: false, maxOutputTokens: 8192 },
    },
  }))
  return home
}

const _testOrchHome = seedCatalog()
const _prevOrchHome = process.env.ORCHESTOS_HOME
beforeAll(() => {
  process.env.ORCHESTOS_HOME = _testOrchHome
  // Limpia el catálogo en memoria de tests anteriores en el mismo proceso (ej.
  // model-catalog.test.ts corre antes en CI): si quedó fresco, ensureCatalogLoaded
  // retorna sin leer disco y vuelve a pegar a la red.
  _resetCatalog()
})

// IDEAS.md #20 (2026-07-05): callRunTask() escribe en la misma
// ~/.orchestos/db.sqlite que usa el dashboard real — sin este cleanup, cada
// `bun test` local deja filas fantasma (task_id 'g3-selection-test') visibles
// en "Recent Runs" del dashboard que Carlos usa a diario.
//
// Restaurar ORCHESTOS_HOME acá es igual de crítico: sin esto, cualquier archivo
// de test que corra DESPUÉS de este en el mismo proceso de `bun test` y sea el
// PRIMERO en importar `db.ts` (el singleton se resuelve una sola vez, en su
// primer import) queda apuntando a este `_testOrchHome` — un directorio que
// nunca corrió `runMigrations()` — con fallos tipo "no such table: instincts".
// Hallazgo real de CI (2026-08-14), ver LEDGER.md.
afterAll(() => {
  db.run("DELETE FROM runs WHERE task_id = 'g3-selection-test'")
  if (_prevOrchHome === undefined) delete process.env.ORCHESTOS_HOME
  else process.env.ORCHESTOS_HOME = _prevOrchHome
})

const originalFetch = globalThis.fetch
const originalKey = process.env.OPENROUTER_API_KEY

afterEach(() => {
  globalThis.fetch = originalFetch
  if (originalKey === undefined) delete process.env.OPENROUTER_API_KEY
  else process.env.OPENROUTER_API_KEY = originalKey
})

function tmpDir(): string {
  return mkdtempSync(join(tmpdir(), 'orchestos-g3-selection-'))
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
  }), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

function plainResponse(content: string) {
  return new Response(JSON.stringify({
    choices: [{ message: { content } }],
    usage: { prompt_tokens: 5, completion_tokens: 3 },
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
    id: 'g3-selection-test',
    description: 'G.3 engine selection test',
    executor: 'openrouter',
    input: [],
    output: ['out.txt'],
    depends_on: [],
    status: 'pending',
    retry_count: 0,
    ...overrides,
  }
}

function latestLogContent(dir: string): string {
  const logsDir = join(dir, 'runs')
  const files = readdirSync(logsDir).filter(f => f.endsWith('.log'))
  const latest = files.sort().at(-1)!
  return readFileSync(join(logsDir, latest), 'utf-8')
}

async function callRunTask(task: Task, dir: string, opts: { orcheConfig?: OrcheConfig; modelOverride?: string } = {}) {
  const { runTask } = await import('../run/harness.ts')
  const { RunLogger } = await import('../run/logger.ts')
  const log = new RunLogger(dir, task.id)
  return runTask({
    projectRoot: dir,
    contextText: '',
    task,
    logger: log,
    sandboxMode: 'cwd',
    orcheConfig: opts.orcheConfig,
    modelOverride: opts.modelOverride,
  })
}

describe('G.3 — executor engine selection', () => {
  it('task.engine=agentic with a tool-calling-capable model runs the agentic engine and writes files via the contract', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-test-or-key'
    installMockFetch([
      () => toolCallResponse([{ name: 'write_file', args: { path: 'out.txt', content: 'agentic wrote this' } }]),
      () => plainResponse('Done — wrote out.txt'),
      () => plainResponse('{"verdict":"pass","reason":"looks good"}'),
    ])

    const dir = tmpDir()
    try {
      const task = baseTask({ engine: 'agentic' })
      const result = await callRunTask(task, dir, { modelOverride: 'anthropic/claude-haiku-4-5' })
      expect(result.status).toBe('done')
      expect(result.filesWritten).toEqual(['out.txt'])
      expect(readFileSync(join(dir, 'out.txt'), 'utf-8')).toBe('agentic wrote this')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('task.engine=agentic with a model that does not support tool-calling falls back to single-shot with a logged warning', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-test-or-key'
    installMockFetch([
      () => plainResponse('<<<FILE:out.txt>>>\nsingle-shot fallback content\n<<<ENDFILE>>>'),
      () => plainResponse('{"verdict":"pass","reason":"looks good"}'),
    ])

    const dir = tmpDir()
    try {
      const task = baseTask({ engine: 'agentic' })
      const result = await callRunTask(task, dir, { modelOverride: 'deepseek/deepseek-v4-flash' })
      expect(result.status).toBe('done')
      expect(readFileSync(join(dir, 'out.txt'), 'utf-8')).toBe('single-shot fallback content\n')
      expect(latestLogContent(dir)).toContain('falling back to single-shot')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('no task.engine and no orcheConfig.executorEngine defaults to single-shot (zero behavior change)', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-test-or-key'
    installMockFetch([
      () => plainResponse('<<<FILE:out.txt>>>\ndefault single-shot content\n<<<ENDFILE>>>'),
      () => plainResponse('{"verdict":"pass","reason":"looks good"}'),
    ])

    const dir = tmpDir()
    try {
      const task = baseTask()
      const result = await callRunTask(task, dir, { modelOverride: 'anthropic/claude-haiku-4-5' })
      expect(result.status).toBe('done')
      expect(readFileSync(join(dir, 'out.txt'), 'utf-8')).toBe('default single-shot content\n')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('orcheConfig.executorEngine=agentic applies as project-level default when the task does not declare its own engine', async () => {
    process.env.OPENROUTER_API_KEY = 'sk-test-or-key'
    installMockFetch([
      () => toolCallResponse([{ name: 'write_file', args: { path: 'out.txt', content: 'project default agentic' } }]),
      () => plainResponse('Done'),
      () => plainResponse('{"verdict":"pass","reason":"looks good"}'),
    ])

    const dir = tmpDir()
    try {
      const task = baseTask({ executor_model: 'anthropic/claude-haiku-4-5' })
      const { DEFAULT_CONFIG } = await import('../config/schema.ts')
      const orcheConfig: OrcheConfig = { ...DEFAULT_CONFIG, executorEngine: 'agentic' }
      const result = await callRunTask(task, dir, { orcheConfig })
      expect(result.status).toBe('done')
      expect(readFileSync(join(dir, 'out.txt'), 'utf-8')).toBe('project default agentic')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

// B.2 — 'external' como tercer valor de TaskEngine. Tests de selección / schema / config.
// El test E2E de la ejecución del motor (subproceso + worktree + diff) vive en B.3.
// Acá cubrimos: validateEngine acepta 'external' y rechaza inválidos con mensaje
// extendido; loadOrcheConfig resuelve executorEngine='external' y external.timeoutMs;
// y runTask() con engine='external' llega a externalEngine.run() (verificable por el
// error canónico de external.ts cuando no hay worktree — callRunTask usa sandboxMode
// 'cwd' deliberadamente para mantener este test determinista sin tocar git).
describe('B.2 — executor engine: external', () => {
  it('validateTask acepta engine: "external"', () => {
    const t = validateTask({
      id: 'b2-ext-1',
      description: 'external engine task',
      executor: 'openrouter',
      output: ['out.txt'],
      engine: 'external',
    }, 0)
    expect(t.engine).toBe('external')
  })

  it('validateTask rechaza engine: "bogus2" con mensaje que incluye "external"', () => {
    expect(() => validateTask({
      id: 'b2-ext-2',
      description: 'bad engine',
      executor: 'openrouter',
      output: ['out.txt'],
      engine: 'bogus2',
    }, 0)).toThrow(/unknown engine 'bogus2'.*external/)
  })

  it('loadOrcheConfig resuelve executorEngine="external"', () => {
    const home = mkdtempSync(join(tmpdir(), 'orchestos-b2-ext-cfg-'))
    try {
      writeFileSync(join(home, 'orchestos.config.yaml'),
        'config_version: 1\nexecutorEngine: external\nmodels: {}\n', 'utf-8')
      const cfg = loadOrcheConfig(home)
      expect(cfg.executorEngine).toBe('external')
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  it('loadOrcheConfig parsea external.timeoutMs', () => {
    const home = mkdtempSync(join(tmpdir(), 'orchestos-b2-ext-cfg-'))
    try {
      writeFileSync(join(home, 'orchestos.config.yaml'),
        'config_version: 1\nexternal:\n  timeoutMs: 60000\nmodels: {}\n', 'utf-8')
      const cfg = loadOrcheConfig(home)
      expect(cfg.external?.timeoutMs).toBe(60000)
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  it('loadOrcheConfig ignora external con tipo incorrecto (no rompe, default interno)', () => {
    const home = mkdtempSync(join(tmpdir(), 'orchestos-b2-ext-cfg-'))
    try {
      writeFileSync(join(home, 'orchestos.config.yaml'),
        'config_version: 1\nexternal: "not-an-object"\nmodels: {}\n', 'utf-8')
      const cfg = loadOrcheConfig(home)
      expect(cfg.external).toBeUndefined()
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  // G.4.1 — executor_mode: preferencia persistente del usuario.
  it('loadOrcheConfig resuelve executor_mode="cli-opencode"', () => {
    const home = mkdtempSync(join(tmpdir(), 'orchestos-g41-mode-'))
    try {
      writeFileSync(join(home, 'orchestos.config.yaml'),
        'config_version: 1\nexecutor_mode: cli-opencode\nmodels: {}\n', 'utf-8')
      const cfg = loadOrcheConfig(home)
      expect(cfg.executor_mode).toBe('cli-opencode')
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  it('loadOrcheConfig ignora executor_mode con valor desconocido (no rompe, undefined)', () => {
    const home = mkdtempSync(join(tmpdir(), 'orchestos-g41-mode-bad-'))
    try {
      writeFileSync(join(home, 'orchestos.config.yaml'),
        'config_version: 1\nexecutor_mode: not-a-real-mode\nmodels: {}\n', 'utf-8')
      const cfg = loadOrcheConfig(home)
      expect(cfg.executor_mode).toBeUndefined()
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  it('loadOrcheConfig sin executor_mode → undefined (sin preferencia guardada)', () => {
    const home = mkdtempSync(join(tmpdir(), 'orchestos-g41-mode-absent-'))
    try {
      writeFileSync(join(home, 'orchestos.config.yaml'), 'config_version: 1\nmodels: {}\n', 'utf-8')
      const cfg = loadOrcheConfig(home)
      expect(cfg.executor_mode).toBeUndefined()
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  it('task.engine="external" selecciona externalEngine y falla con error canónico de worktree (sandbox cwd)', async () => {
    // callRunTask usa sandboxMode 'cwd' — el external engine rechaza esto con
    // ExecutorExternalError("external engine requires worktree sandbox mode...").
    // El catch-all del harness (harness.ts:498) convierte ese throw en un
    // TaskResult { status: 'failed', retryReason: ... }, por eso acá
    // verificamos el resultado, NO que la promesa rechace.
    // Eso es la prueba de que el harness efectivamente seleccionó externalEngine
    // (no single-shot ni agentic) — la rama de selección B.2 se ejecutó. El
    // happy path con subprocess real + worktree es B.3.
    // IDEAS.md #22 — CI no tiene el binario `claude` real; sin este mock,
    // externalEngine.run() tira "not found in PATH" ANTES de llegar al guard
    // de worktree que este test realmente quiere ejercitar.
    const originalWhich = Bun.which
    ;(Bun as any).which = (_bin: string) => '/usr/local/bin/claude'
    const task = baseTask({ engine: 'external' })
    const dir = tmpDir()
    try {
      const result = await callRunTask(task, dir, { modelOverride: 'anthropic/claude-haiku-4-5' })
      expect(result.status).toBe('failed')
      expect(result.retryReason).toMatch(/external engine requires worktree sandbox mode/)
    } finally {
      Bun.which = originalWhich
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

// ── BB.1 (2026-08-16) — executor_mode aplica a TODA tarea ─────────────────────
//
// Antes de BB.1, `executor_mode` se leía en UN SOLO punto del runtime
// (dashboard/handlers/chat.ts) — una tarea corrida por CLI o escrita a mano en
// tasks.yaml lo ignoraba por completo, así que la config decía una cosa y el
// sistema hacía otra en silencio (reporte real de Carlos, 2026-08-16).
//
// Mismo truco de verificación que el test de B.2 de arriba: `external` rechaza
// sandbox 'cwd' con un error canónico, así que ver ESE error es la prueba de que
// el harness efectivamente seleccionó ese engine — acá vía executor_mode, no vía
// task.engine.
describe('BB.1 — executor_mode decide el engine de tareas manuales', () => {
  it('executor_mode "cli-claude" selecciona external aunque la tarea no declare engine', async () => {
    const originalWhich = Bun.which
    ;(Bun as any).which = (_bin: string) => '/usr/local/bin/claude'
    const { DEFAULT_CONFIG } = await import('../config/schema.ts')
    const orcheConfig: OrcheConfig = { ...DEFAULT_CONFIG, executor_mode: 'cli-claude' }
    const dir = tmpDir()
    try {
      const result = await callRunTask(baseTask(), dir, { orcheConfig, modelOverride: 'anthropic/claude-haiku-4-5' })
      expect(result.status).toBe('failed')
      expect(result.retryReason).toMatch(/external engine requires worktree sandbox mode/)
    } finally {
      Bun.which = originalWhich
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('task.engine gana sobre executor_mode (override explícito por tarea)', async () => {
    // executor_mode pide cli-claude (external) pero la tarea declara single-shot:
    // gana la tarea. Si la precedencia estuviera invertida, esto fallaría con el
    // error de worktree de external en vez de completar.
    process.env.OPENROUTER_API_KEY = 'sk-test-or-key'
    installMockFetch([
      () => plainResponse('<<<FILE:out.txt>>>\ntask.engine wins\n<<<ENDFILE>>>'),
      () => plainResponse('{"verdict":"pass","reason":"looks good"}'),
    ])
    const { DEFAULT_CONFIG } = await import('../config/schema.ts')
    const orcheConfig: OrcheConfig = { ...DEFAULT_CONFIG, executor_mode: 'cli-claude' }
    const dir = tmpDir()
    try {
      const task = baseTask({ engine: 'single-shot' })
      const result = await callRunTask(task, dir, { orcheConfig, modelOverride: 'anthropic/claude-haiku-4-5' })
      expect(result.status).toBe('done')
      expect(readFileSync(join(dir, 'out.txt'), 'utf-8')).toBe('task.engine wins\n')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('executor_mode "api" deja pasar a executorEngine (refina cómo corre, no dónde)', async () => {
    // 'api' devuelve {} en resolveExecutorSelection → fallthrough a executorEngine.
    // Con executorEngine 'agentic' y un modelo con tool-calling, corre agentic.
    process.env.OPENROUTER_API_KEY = 'sk-test-or-key'
    installMockFetch([
      () => toolCallResponse([{ name: 'write_file', args: { path: 'out.txt', content: 'agentic via api mode' } }]),
      () => plainResponse('Done'),
      () => plainResponse('{"verdict":"pass","reason":"looks good"}'),
    ])
    const { DEFAULT_CONFIG } = await import('../config/schema.ts')
    const orcheConfig: OrcheConfig = { ...DEFAULT_CONFIG, executor_mode: 'api', executorEngine: 'agentic' }
    const dir = tmpDir()
    try {
      const result = await callRunTask(baseTask(), dir, { orcheConfig, modelOverride: 'anthropic/claude-haiku-4-5' })
      expect(result.status).toBe('done')
      expect(readFileSync(join(dir, 'out.txt'), 'utf-8')).toBe('agentic via api mode')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
