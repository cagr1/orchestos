/**
 * G.4.2b — unit tests for the codex ExecutorEngine (`codex exec`, headless).
 *
 * Mismo patrón que external-engine.test.ts/opencode-engine.test.ts
 * (Bun.spawn/Bun.which overrideados, worktree real vía createWorktree + git).
 * Diferencia clave: codex NO expone total_cost_usd en su JSONL (a diferencia
 * de claude/opencode) — el costo se computa vía calcCost() sobre el catálogo
 * real, así que estos tests seedean un catálogo de disco (mismo patrón que
 * harness-engine-persistence.test.ts) para que `openai/gpt-5.4` resuelva a
 * un precio real en vez de lanzar "not in the pricing catalog".
 */

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { _resetCatalog, ensureCatalogLoaded } from '../router/model-catalog.ts'
import {
  codexEngine,
  ExecutorCodexError,
  orchestosModelToCodexModel,
} from '../run/executors/codex.ts'
import type { RunContext } from '../run/middleware.ts'
import { createWorktree, git, type Worktree } from '../run/sandbox.ts'
import type { Task } from '../tasks/schema.ts'

// Seedea el catálogo en un ORCHESTOS_HOME temporal — mismo gotcha documentado
// en harness-engine-persistence.test.ts: cacheFilePath() resuelve a
// ${ORCHESTOS_HOME}/.orchestos/cache/models.json (con `.orchestos/` interpuesto).
function seedCatalog(): string {
  const home = mkdtempSync(join(tmpdir(), 'orchestos-g42b-cat-'))
  mkdirSync(join(home, '.orchestos', 'cache'), { recursive: true })
  writeFileSync(
    join(home, '.orchestos', 'cache', 'models.json'),
    JSON.stringify({
      fetchedAt: Date.now(),
      models: {
        'openai/gpt-5.4': {
          contextLength: 400000,
          priceIn: 2,
          priceOut: 10,
          supportsReasoning: true,
          maxOutputTokens: 128000,
        },
      },
    }),
  )
  return home
}

const _testOrchHome = seedCatalog()
const _prevOrchHome = process.env.ORCHESTOS_HOME
const originalWhich = Bun.which

beforeAll(async () => {
  process.env.ORCHESTOS_HOME = _testOrchHome
  _resetCatalog()
  await ensureCatalogLoaded()
})

// Sin esto, cualquier archivo de test que corra DESPUÉS de este en el mismo
// proceso de `bun test` y sea el PRIMERO en importar `db.ts` (el singleton se
// resuelve una sola vez, en su primer import) queda apuntando a este
// `_testOrchHome` — un directorio que nunca corrió `runMigrations()` — con
// fallos tipo "no such table: instincts". Hallazgo real de CI (2026-08-14),
// ver LEDGER.md. Mismo patrón de restauración que engine-selection.test.ts/
// harness-engine-persistence.test.ts.
afterAll(() => {
  if (_prevOrchHome === undefined) delete process.env.ORCHESTOS_HOME
  else process.env.ORCHESTOS_HOME = _prevOrchHome
})

beforeEach(() => {
  ;(Bun as any).which = (_bin: string) => '/usr/local/bin/codex'
})
afterEach(() => {
  Bun.which = originalWhich
})

// -- fixtures (mismo patrón que opencode-engine.test.ts) ------------------------

const originalSpawn = Bun.spawn

interface MockProc {
  stdout: ReadableStream<Uint8Array>
  stderr: ReadableStream<Uint8Array>
  exited: Promise<number>
  kill(_signal: string): void
}

interface MockSpawnCall {
  cmd: string[]
  cwd: string
}

function makeMockProc(stdoutText: string, opts: { exitDelayMs?: number } = {}): MockProc {
  const encoder = new TextEncoder()
  const stdoutStream = new ReadableStream<Uint8Array>({
    start(controller) {
      queueMicrotask(() => {
        controller.enqueue(encoder.encode(stdoutText))
        controller.close()
      })
    },
  })
  const stderrStream = new ReadableStream<Uint8Array>({
    start(c) {
      c.close()
    },
  })
  let resolveExit!: (n: number) => void
  const exited = new Promise<number>((r) => {
    resolveExit = r
  })
  if (opts.exitDelayMs) setTimeout(() => resolveExit(0), opts.exitDelayMs)
  else queueMicrotask(() => resolveExit(0))
  return {
    stdout: stdoutStream,
    stderr: stderrStream,
    exited,
    kill(_signal) {
      /* no-op */
    },
  }
}

const spawnCalls: MockSpawnCall[] = []
function installMockSpawn(stdout: string, opts: { exitDelayMs?: number } = {}): MockProc {
  return makeMockProc(stdout, opts)
}

afterEach(() => {
  Bun.spawn = originalSpawn
  spawnCalls.length = 0
})

function overrideBunSpawn(proc: MockProc) {
  Bun.spawn = ((cmd: string[], opts?: { cwd?: string }) => {
    spawnCalls.push({ cmd: cmd.slice(), cwd: opts?.cwd ?? '' })
    return proc as unknown as ReturnType<typeof Bun.spawn>
  }) as typeof Bun.spawn
}

function makeGitRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'orchestos-g42b-codex-'))
  git(['init', '-b', 'main'], dir)
  git(['config', 'user.email', 'test@test.com'], dir)
  git(['config', 'user.name', 'Test'], dir)
  writeFileSync(join(dir, 'README.md'), 'init')
  git(['add', '-A'], dir)
  git(['commit', '-m', 'init'], dir)
  return dir
}

const repos: string[] = []
const worktrees: Worktree[] = []
function trackWorktree(wt: Worktree) {
  worktrees.push(wt)
  repos.push(wt.projectRoot)
}

function baseTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'g42b-codex-test',
    description: 'G.4.2b codex engine test',
    executor: 'openrouter',
    input: [],
    output: ['out.txt'],
    depends_on: [],
    status: 'pending',
    retry_count: 0,
    ...overrides,
  }
}

function buildCtx(worktree: Worktree, task: Task, model = 'openai/gpt-5.4'): RunContext {
  return {
    opts: {} as any,
    taskClass: 'implement',
    model,
    providerName: 'openrouter',
    provider: null as any,
    task,
    embedHits: 0,
    skillInstructions: '',
    constitutionBlock: '',
    constitutionRules: null,
    effectiveContext: '',
    contextSource: 'AGENTS.md',
    contextTokens: 0,
    effectiveRoot: worktree.path,
    worktree,
    instinctBlock: '',
    prompt: { system: '', userContent: 'Task: ' + task.description },
    contextWarnings: [],
  }
}

afterEach(() => {
  for (const wt of worktrees.splice(0)) {
    try {
      wt.cleanup()
    } catch {}
  }
  for (const r of repos.splice(0)) {
    try {
      rmSync(r, { recursive: true, force: true })
    } catch {}
  }
})

// JSONL real (probado en vivo el 2026-07-27 con `codex exec --json` contra un git repo temporal).
function jsonl(...events: object[]): string {
  return events.map((e) => JSON.stringify(e)).join('\n') + '\n'
}

const turnCompleted = (input: number, output: number) => ({
  type: 'turn.completed',
  usage: {
    input_tokens: input,
    output_tokens: output,
    cached_input_tokens: 0,
    cache_write_input_tokens: 0,
    reasoning_output_tokens: 0,
  },
})

// -- tests ---------------------------------------------------------------------

describe('G.4.2b — codexEngine (codex subprocess)', () => {
  it('happy path: JSONL con turn.completed → outcome con costo computado vía calcCost()', async () => {
    const root = makeGitRepo()
    const wt = createWorktree('g42b-happy', 'main', root)
    trackWorktree(wt)

    writeFileSync(join(wt.path, 'out.txt'), 'hello from codex\n')

    const stdout = jsonl(
      { type: 'thread.started', thread_id: 'abc' },
      { type: 'turn.started' },
      {
        type: 'item.completed',
        item: { id: 'item_0', type: 'agent_message', text: 'voy a escribir el archivo' },
      },
      {
        type: 'item.completed',
        item: { id: 'item_1', type: 'file_change', changes: [{ path: 'out.txt', kind: 'add' }] },
      },
      turnCompleted(1000, 200),
    )
    const proc = installMockSpawn(stdout)
    overrideBunSpawn(proc)

    const ctx = buildCtx(wt, baseTask({ engine: 'codex', cli_effort: 'high' }))
    const outcome = await codexEngine.run(ctx, {
      maxTokens: 8192,
      maxIterations: 1,
      timeoutMs: 5000,
    })

    expect(spawnCalls).toHaveLength(1)
    expect(spawnCalls[0]!.cwd).toBe(wt.path)
    expect(spawnCalls[0]!.cmd[0]).toBe('codex')
    expect(spawnCalls[0]!.cmd).toContain('exec')
    expect(spawnCalls[0]!.cmd).toContain('--json')
    expect(spawnCalls[0]!.cmd).toContain('--sandbox')
    expect(spawnCalls[0]!.cmd).toContain('workspace-write')
    expect(spawnCalls[0]!.cmd).toContain('-m')
    expect(spawnCalls[0]!.cmd).toContain('gpt-5.4') // prefijo openai/ pelado
    expect(spawnCalls[0]!.cmd).toContain('-c')
    expect(spawnCalls[0]!.cmd).toContain('model_reasoning_effort=high')

    expect(outcome.files).toEqual([{ path: 'out.txt', content: 'hello from codex\n' }])
    expect(outcome.inputTokens).toBe(1000)
    expect(outcome.outputTokens).toBe(200)
    // calcCost: (1000/1e6)*2 + (200/1e6)*10 = 0.002 + 0.002 = 0.004
    expect(outcome.usd).toBeCloseTo(0.004, 6)
    expect(outcome.iterations).toBe(1)
    expect(outcome.costByIteration[0]!.label).toBe('codex (exec)')
    expect(outcome.costByIteration[0]!.binary).toBe('codex')
    expect(outcome.costByIteration[0]!.args).toContain('-c')
    expect(outcome.costByIteration[0]!.args).toContain('model_reasoning_effort=high')
    expect(outcome.log[0]).toContain('1 file(s) changed')
  })

  // BB.6 (2026-08-18) — este test afirmaba antes que un modelo no-OpenAI "omite
  // -m y codex usa su default". Ese era exactamente el bug: codex corría con un
  // modelo desconocido y el costo se tarifaba igual con `ctx.model`, produciendo
  // un número falso con apariencia de real (el $0.00924 de BB.4). Ahora el run
  // se rechaza ANTES del spawn.
  it('modelo no-OpenAI: falla ANTES de spawnear, sin fabricar un costo (BB.6)', async () => {
    const root = makeGitRepo()
    const wt = createWorktree('g42b-nonopenai', 'main', root)
    trackWorktree(wt)

    const proc = installMockSpawn(jsonl(turnCompleted(10, 1)))
    overrideBunSpawn(proc)

    const ctx = buildCtx(wt, baseTask(), 'anthropic/claude-sonnet-5')
    let caught: Error | null = null
    try {
      await codexEngine.run(ctx, { maxTokens: 1024, maxIterations: 1, timeoutMs: 5000 })
    } catch (e: any) {
      caught = e
    }

    // No se gastó un solo token: el guard corre antes de lanzar el proceso.
    expect(spawnCalls.length).toBe(0)
    expect(caught).toBeInstanceOf(ExecutorCodexError)
    expect(caught!.message).toContain('refuses to fabricate')
    // El mensaje dice qué hacer, no solo qué falló.
    expect(caught!.message).toContain('anthropic/claude-sonnet-5')
    expect(caught!.message).toMatch(/--engine external|--engine opencode/)
  })

  // BB.6 — el guard F0.8 preexistente sigue vivo y cubre su propio caso: modelo
  // openai/* (así que -m SÍ se pasa y sabemos qué corrió) pero ausente del
  // catálogo de precios. Son dos modos de fallo distintos, no uno solo.
  it('modelo openai/* fuera del catálogo: spawnea pero no reporta $0 (F0.8 sigue vigente)', async () => {
    const root = makeGitRepo()
    const wt = createWorktree('bb6-openai-uncatalogued', 'main', root)
    trackWorktree(wt)

    const proc = installMockSpawn(jsonl(turnCompleted(10, 1)))
    overrideBunSpawn(proc)

    const ctx = buildCtx(wt, baseTask(), 'openai/gpt-not-in-catalog')
    let caught: Error | null = null
    try {
      await codexEngine.run(ctx, { maxTokens: 1024, maxIterations: 1, timeoutMs: 5000 })
    } catch (e: any) {
      caught = e
    }

    expect(spawnCalls[0]!.cmd).toContain('-m')
    expect(spawnCalls[0]!.cmd).toContain('gpt-not-in-catalog')
    expect(caught).toBeInstanceOf(ExecutorCodexError)
    expect(caught!.message).toContain('not in the pricing catalog')
  })

  it('binario ausente: throw con mensaje accionable ANTES de crear worktree o spawn', async () => {
    const originalW = Bun.which
    ;(Bun as any).which = (_bin: string) => null
    try {
      const root = makeGitRepo()
      const wt = createWorktree('g42b-no-binary', 'main', root)
      trackWorktree(wt)

      const proc = installMockSpawn(jsonl(turnCompleted(1, 1)))
      overrideBunSpawn(proc)

      const ctx = buildCtx(wt, baseTask())
      let caught: Error | null = null
      try {
        await codexEngine.run(ctx, { maxTokens: 1024, maxIterations: 1, timeoutMs: 5000 })
      } catch (e: any) {
        caught = e
      }

      expect(caught).toBeInstanceOf(ExecutorCodexError)
      expect(caught!.message).toContain('"codex"')
      expect(caught!.message).toContain('not found in PATH')
      expect(spawnCalls).toHaveLength(0)
    } finally {
      ;(Bun as any).which = originalW
    }
  })

  it('sin worktree: rechaza correr contra el proyecto real sin sandbox', async () => {
    const ctx = {
      ...buildCtx(
        { path: '/tmp/fake', projectRoot: '/tmp/fake', cleanup() {} } as Worktree,
        baseTask(),
      ),
      worktree: null,
    }
    let caught: Error | null = null
    try {
      await codexEngine.run(ctx as any, { maxTokens: 1024, maxIterations: 1, timeoutMs: 5000 })
    } catch (e: any) {
      caught = e
    }
    expect(caught).toBeInstanceOf(ExecutorCodexError)
    expect(caught!.message).toContain('worktree sandbox mode')
  })

  it('timeout: proceso termina tarde y sin stdout parseable → error menciona "timed out"', async () => {
    const root = makeGitRepo()
    const wt = createWorktree('g42b-timeout', 'main', root)
    trackWorktree(wt)

    const proc = installMockSpawn('not jsonl at all, codex was killed before flushing', {
      exitDelayMs: 50,
    })
    overrideBunSpawn(proc)

    const ctx = buildCtx(wt, baseTask())
    let caught: Error | null = null
    try {
      await codexEngine.run(ctx, { maxTokens: 1024, maxIterations: 1, timeoutMs: 1 })
    } catch (e: any) {
      caught = e
    }
    expect(caught).toBeInstanceOf(ExecutorCodexError)
    expect(caught!.message).toContain('timed out')
  })

  it('sin turn.completed en el stream: error explícito, nunca usd=0 silencioso', async () => {
    const root = makeGitRepo()
    const wt = createWorktree('g42b-no-cost', 'main', root)
    trackWorktree(wt)

    const proc = installMockSpawn(
      jsonl({ type: 'thread.started', thread_id: 'x' }, { type: 'turn.started' }),
    )
    overrideBunSpawn(proc)

    const ctx = buildCtx(wt, baseTask())
    let caught: Error | null = null
    try {
      await codexEngine.run(ctx, { maxTokens: 1024, maxIterations: 1, timeoutMs: 5000 })
    } catch (e: any) {
      caught = e
    }
    expect(caught).toBeInstanceOf(ExecutorCodexError)
    expect(caught!.message).toContain('turn.completed')
  })

  it('líneas JSONL corruptas o de log (warnings de rmcp) se ignoran sin abortar el parseo', async () => {
    const root = makeGitRepo()
    const wt = createWorktree('g42b-partial', 'main', root)
    trackWorktree(wt)

    const stdout =
      'Reading additional input from stdin...\n' +
      '2026-07-27T16:36:14Z ERROR rmcp::transport::worker: worker quit with fatal\n' +
      jsonl(turnCompleted(50, 5))
    const proc = installMockSpawn(stdout)
    overrideBunSpawn(proc)

    const ctx = buildCtx(wt, baseTask())
    const outcome = await codexEngine.run(ctx, {
      maxTokens: 1024,
      maxIterations: 1,
      timeoutMs: 5000,
    })

    expect(outcome.inputTokens).toBe(50)
    expect(outcome.outputTokens).toBe(5)
  })

  it('orchestosModelToCodexModel: pela el prefijo openai/, undefined para todo lo demás', () => {
    expect(orchestosModelToCodexModel('openai/gpt-5.4')).toBe('gpt-5.4')
    expect(orchestosModelToCodexModel('anthropic/claude-sonnet-5')).toBeUndefined()
    expect(orchestosModelToCodexModel(undefined)).toBeUndefined()
  })
})
