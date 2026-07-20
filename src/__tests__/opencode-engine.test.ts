/**
 * G.5 — unit tests for the opencode ExecutorEngine (`opencode run`, headless).
 *
 * Mismo patrón que external-engine.test.ts (Bun.spawn/Bun.which overrideados,
 * worktree real vía createWorktree + git) — el proceso opencode se mockea,
 * el diff se ejercita de verdad. Diferencia clave respecto a external.ts:
 * opencode emite NDJSON incremental (step_start/tool_use/text/step_finish),
 * no un solo blob JSON — el costo/tokens se suman entre step_finish events.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { git, createWorktree, type Worktree } from '../run/sandbox.ts'
import { ExecutorOpencodeError, opencodeEngine, orchestosModelToOpencodeModel } from '../run/executors/opencode.ts'
import type { Task } from '../tasks/schema.ts'
import type { RunContext } from '../run/middleware.ts'

const originalWhich = Bun.which
beforeEach(() => {
  ;(Bun as any).which = (_bin: string) => '/usr/local/bin/opencode'
})
afterEach(() => {
  Bun.which = originalWhich
})

// -- fixtures (mismo patrón que external-engine.test.ts) ------------------------

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
  const stderrStream = new ReadableStream<Uint8Array>({ start(c) { c.close() } })
  let resolveExit!: (n: number) => void
  const exited = new Promise<number>((r) => { resolveExit = r })
  if (opts.exitDelayMs) setTimeout(() => resolveExit(0), opts.exitDelayMs)
  else queueMicrotask(() => resolveExit(0))
  return {
    stdout: stdoutStream,
    stderr: stderrStream,
    exited,
    kill(_signal) { /* no-op */ },
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
  const dir = mkdtempSync(join(tmpdir(), 'orchestos-g5-opencode-'))
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
    id: 'g5-opencode-test',
    description: 'G.5 opencode engine test',
    executor: 'openrouter',
    input: [],
    output: ['out.txt'],
    depends_on: [],
    status: 'pending',
    retry_count: 0,
    ...overrides,
  }
}

function buildCtx(worktree: Worktree, task: Task): RunContext {
  return {
    opts: {} as any,
    taskClass: 'implement',
    model: 'deepseek/deepseek-v4-flash',
    providerName: 'openrouter',
    provider: null as any,
    task,
    embedHits: 0,
    skillInstructions: '',
    allowedTools: [],
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
  for (const wt of worktrees.splice(0)) { try { wt.cleanup() } catch {} }
  for (const r of repos.splice(0)) { try { rmSync(r, { recursive: true, force: true }) } catch {} }
})

// NDJSON real (probado en vivo el 2026-07-20 con `opencode run --format json --auto`).
function ndjson(...events: object[]): string {
  return events.map(e => JSON.stringify(e)).join('\n') + '\n'
}

const stepFinish = (cost: number, input: number, output: number) => ({
  type: 'step_finish',
  part: { type: 'step-finish', cost, tokens: { input, output } },
})

// -- tests ---------------------------------------------------------------------

describe('G.5 — opencodeEngine (opencode subprocess)', () => {
  it('happy path: NDJSON con 2 step_finish → outcome suma costo/tokens de ambos', async () => {
    const root = makeGitRepo()
    const wt = createWorktree('g5-happy', 'main', root)
    trackWorktree(wt)

    writeFileSync(join(wt.path, 'out.txt'), 'hello from opencode\n')

    const stdout = ndjson(
      { type: 'step_start', part: { type: 'step-start' } },
      { type: 'tool_use', part: { type: 'tool' } },
      stepFinish(0.002, 100, 10),
      { type: 'text', part: { type: 'text', text: 'done' } },
      stepFinish(0.0005, 20, 2),
    )
    const proc = installMockSpawn(stdout)
    overrideBunSpawn(proc)

    const ctx = buildCtx(wt, baseTask())
    const outcome = await opencodeEngine.run(ctx, { maxTokens: 8192, maxIterations: 1, timeoutMs: 5000 })

    expect(spawnCalls).toHaveLength(1)
    expect(spawnCalls[0]!.cwd).toBe(wt.path)
    expect(spawnCalls[0]!.cmd[0]).toBe('opencode')
    expect(spawnCalls[0]!.cmd).toContain('run')
    expect(spawnCalls[0]!.cmd).toContain('--format')
    expect(spawnCalls[0]!.cmd).toContain('json')
    expect(spawnCalls[0]!.cmd).toContain('--auto')
    // Sin traducción de modelo real todavía (ver comentario en opencode.ts) —
    // nunca debe mandar --model con un id de OrchestOS tal cual.
    expect(spawnCalls[0]!.cmd).not.toContain('--model')

    expect(outcome.files).toEqual([{ path: 'out.txt', content: 'hello from opencode\n' }])
    expect(outcome.inputTokens).toBe(120)
    expect(outcome.outputTokens).toBe(12)
    expect(outcome.usd).toBeCloseTo(0.0025, 6)
    expect(outcome.iterations).toBe(2)
    expect(outcome.costByIteration).toHaveLength(1)
    expect(outcome.costByIteration[0]!.label).toBe('opencode (2 steps)')
    expect(outcome.costByIteration[0]!.binary).toBe('opencode')
    expect(outcome.log[0]).toContain('1 file(s) changed')
  })

  it('cli_effort de la tarea se pasa como --variant', async () => {
    const root = makeGitRepo()
    const wt = createWorktree('g5-variant', 'main', root)
    trackWorktree(wt)

    const proc = installMockSpawn(ndjson(stepFinish(0.001, 5, 1)))
    overrideBunSpawn(proc)

    const ctx = buildCtx(wt, baseTask({ cli_effort: 'high' as any }))
    await opencodeEngine.run(ctx, { maxTokens: 1024, maxIterations: 1, timeoutMs: 5000 })

    const idx = spawnCalls[0]!.cmd.indexOf('--variant')
    expect(idx).toBeGreaterThan(-1)
    expect(spawnCalls[0]!.cmd[idx + 1]).toBe('high')
  })

  it('binario ausente: throw con mensaje accionable ANTES de crear worktree o spawn', async () => {
    const originalW = Bun.which
    ;(Bun as any).which = (_bin: string) => null
    try {
      const root = makeGitRepo()
      const wt = createWorktree('g5-no-binary', 'main', root)
      trackWorktree(wt)

      const proc = installMockSpawn(ndjson(stepFinish(0.0001, 1, 1)))
      overrideBunSpawn(proc)

      const ctx = buildCtx(wt, baseTask())
      let caught: Error | null = null
      try {
        await opencodeEngine.run(ctx, { maxTokens: 1024, maxIterations: 1, timeoutMs: 5000 })
      } catch (e: any) { caught = e }

      expect(caught).toBeInstanceOf(ExecutorOpencodeError)
      expect(caught!.message).toContain('"opencode"')
      expect(caught!.message).toContain('not found in PATH')
      expect(spawnCalls).toHaveLength(0)
    } finally {
      ;(Bun as any).which = originalW
    }
  })

  it('sin worktree: rechaza correr contra el proyecto real sin sandbox', async () => {
    const ctx = { ...buildCtx({ path: '/tmp/fake', projectRoot: '/tmp/fake', cleanup() {} } as Worktree, baseTask()), worktree: null }
    let caught: Error | null = null
    try {
      await opencodeEngine.run(ctx as any, { maxTokens: 1024, maxIterations: 1, timeoutMs: 5000 })
    } catch (e: any) { caught = e }
    expect(caught).toBeInstanceOf(ExecutorOpencodeError)
    expect(caught!.message).toContain('worktree sandbox mode')
  })

  it('timeout: proceso muere sin flushear stdout parseable → error menciona "timed out" (no $0 silencioso)', async () => {
    // Mismo patrón que external-engine.test.ts: el mock no honra kill(), así que un
    // hang real nunca resolvería `exited`. En vez de eso: el proceso SÍ termina, pero
    // después del timeout (exitDelayMs > timeoutMs) y sin stdout parseable — es la
    // condición real que dispara "killed by timeout, partial output parsed" en el engine.
    const root = makeGitRepo()
    const wt = createWorktree('g5-timeout', 'main', root)
    trackWorktree(wt)

    const proc = installMockSpawn('not ndjson at all, opencode was killed before flushing', { exitDelayMs: 50 })
    overrideBunSpawn(proc)

    const ctx = buildCtx(wt, baseTask())
    let caught: Error | null = null
    try {
      await opencodeEngine.run(ctx, { maxTokens: 1024, maxIterations: 1, timeoutMs: 1 })
    } catch (e: any) { caught = e }
    expect(caught).toBeInstanceOf(ExecutorOpencodeError)
    expect(caught!.message).toContain('timed out')
  })

  it('sin ningun step_finish en el stream: error explícito, nunca usd=0 silencioso', async () => {
    const root = makeGitRepo()
    const wt = createWorktree('g5-no-cost', 'main', root)
    trackWorktree(wt)

    const proc = installMockSpawn(ndjson({ type: 'step_start', part: { type: 'step-start' } }))
    overrideBunSpawn(proc)

    const ctx = buildCtx(wt, baseTask())
    let caught: Error | null = null
    try {
      await opencodeEngine.run(ctx, { maxTokens: 1024, maxIterations: 1, timeoutMs: 5000 })
    } catch (e: any) { caught = e }
    expect(caught).toBeInstanceOf(ExecutorOpencodeError)
    expect(caught!.message).toContain('step-finish')
  })

  it('líneas NDJSON corruptas/parciales se ignoran sin abortar el parseo del resto', async () => {
    const root = makeGitRepo()
    const wt = createWorktree('g5-partial', 'main', root)
    trackWorktree(wt)

    const stdout = ndjson(stepFinish(0.001, 10, 1)) + '{"type":"text","part":{"tex\n' + ndjson(stepFinish(0.002, 20, 2))
    const proc = installMockSpawn(stdout)
    overrideBunSpawn(proc)

    const ctx = buildCtx(wt, baseTask())
    const outcome = await opencodeEngine.run(ctx, { maxTokens: 1024, maxIterations: 1, timeoutMs: 5000 })

    expect(outcome.usd).toBeCloseTo(0.003, 6)
    expect(outcome.iterations).toBe(2)
  })

  it('orchestosModelToOpencodeModel: sin tabla de traducción todavía, siempre undefined', () => {
    expect(orchestosModelToOpencodeModel('deepseek/deepseek-v4-flash')).toBeUndefined()
    expect(orchestosModelToOpencodeModel('anthropic/claude-sonnet-5')).toBeUndefined()
    expect(orchestosModelToOpencodeModel(undefined)).toBeUndefined()
  })
})
