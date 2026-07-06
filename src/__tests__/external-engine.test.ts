/**
 * B.3 — unit tests for the external ExecutorEngine (Claude Code headless).
 *
 * Misma filosofía que agentic-engine.test.ts: ejercitar el engine aislado
 * del harness, sin DB. El "proceso externo" se mockea via override de
 * Bun.spawn (Bun permite reasignar la función global, mismo mecanismo que
 * la suite ya usa con globalThis.fetch para el HTTP). El worktree es real
 * (createWorktree + git) porque es la única forma honesta de ejercitar el
 * camino `git status --porcelain → FileChange[]` del engine.
 *
 * Cubre los 4 escenarios de B.3:
 *  1. Mock del subproceso: stdout JSON válido + worktree con cambios → outcome
 *     con files correctos, usd parseado, costByIteration con 1 entrada honesta,
 *     log con el conteo de archivos.
 *  2. Contrato sobre el diff: el engine reporta el diff COMPLETO sin filtrar
 *     (decisión d de docs/external-executor-design.md). El filtrado real contra
 *     task.output[] lo hace enforceContract() en el harness; acá verificamos
 *     que el engine no aplica ningún filtro propio (pasa archivos dentro Y
 *     fuera de output[]), y que se propaga a harness via outcome.files sin
 *     pérdida. Tambien se ejercita el formato rename de git status porcelain
 *     ("XY old -> new") y el path normalizado.
 *  3. Timeout: subprocess que nunca termina + timeoutMs corto →
 *     ExecutorExternalError mencionando "timed out" (no $0 silencioso).
 *  4. Costo desconocido honesto (decisión b, F0.8): stdout no parseable O
 *     JSON sin total_cost_usd → ExecutorExternalError explícito, jamás
 *     reporta usd=0 cuando el dato falta.
 *
 * Bonus: el engine rechaza correr sin worktree (línea de seguridad §5 del
 * diseño — no ejecutamos un proceso no controlado contra el repo real).
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { git, createWorktree, type Worktree } from '../run/sandbox.ts'
import { ExecutorExternalError, externalEngine } from '../run/executors/external.ts'
import type { Task } from '../tasks/schema.ts'
import type { RunContext } from '../run/middleware.ts'

// IDEAS.md #22 — el CI de GitHub Actions no tiene el binario `claude` real
// instalado (a diferencia de las máquinas de desarrollo), así que el guard
// `findClaudeBinary()` de external.ts (que llama a `Bun.which` de verdad)
// tiraba en los 13 tests que no mockeaban `Bun.which` explícitamente — solo
// los 3 tests "C.2" de más abajo lo hacían. Mock global por defecto acá;
// los tests C.2 siguen pudiendo sobreescribirlo puntualmente para sus casos
// (binario ausente / presente) sin conflicto, porque capturan y restauran
// su propio "original" dentro del mismo test.
const originalWhich = Bun.which
beforeEach(() => {
  ;(Bun as any).which = (_bin: string) => '/usr/local/bin/claude'
})
afterEach(() => {
  Bun.which = originalWhich
})

// -- fixtures ------------------------------------------------------------------

const originalSpawn = Bun.spawn

interface MockProc {
  stdin: { write(_s: string): void; end(): void }
  stdout: ReadableStream<Uint8Array>
  stderr: ReadableStream<Uint8Array>
  exited: Promise<number>
  kill(_signal: string): void
}

interface MockSpawnCall {
  cmd: string[]
  cwd: string
  stdinText: string
}

function makeMockProc(stdoutText: string, opts: { hang?: boolean; exitDelayMs?: number } = {}): MockProc {
  const encoder = new TextEncoder()
  const stdoutStream = new ReadableStream<Uint8Array>({
    start(controller) {
      if (!opts.hang) {
        // Give the consumer a tick to subscribe before enqueuing
        queueMicrotask(() => {
          controller.enqueue(encoder.encode(stdoutText))
          controller.close()
        })
      }
      // If hang=true, never enqueue/close → the awaiting `new Response(proc.stdout).text()` blocks
    },
  })
  const stderrStream = new ReadableStream<Uint8Array>({
    start(c) { c.close() },
  })
  let resolveExit!: (n: number) => void
  const exited = new Promise<number>((r) => { resolveExit = r })
  if (!opts.hang) {
    queueMicrotask(() => {
      if (opts.exitDelayMs) setTimeout(() => resolveExit(0), opts.exitDelayMs)
      else resolveExit(0)
    })
  }
  return {
    stdin: { write(_s) { /* discard */ }, end() { /* discard */ } },
    stdout: stdoutStream,
    stderr: stderrStream,
    exited,
    kill(_signal) { /* no-op for mocks */ },
  }
}

const spawnCalls: MockSpawnCall[] = []
function installMockSpawn(stdout: string, opts: { hang?: boolean; exitDelayMs?: number } = {}): MockProc {
  const proc = makeMockProc(stdout, opts)
  // Wrap original spawn swap is done by the test; we record via the override below.
  // The actual override is set on Bun.spawn; this helper exists for clarity.
  // We use a marker on proc to find it back in tests.
  ;(proc as any).__testMarker = true
  return proc
}

afterEach(() => {
  Bun.spawn = originalSpawn
  spawnCalls.length = 0
})

// Override a single call to Bun.spawn to return `proc`; subsequent calls return
// a default "no output" mock (in case the engine retries).
function overrideBunSpawn(proc: MockProc) {
  Bun.spawn = ((cmd: string[], opts?: { cwd?: string; stdin?: unknown; stdout?: unknown; stderr?: unknown }) => {
    spawnCalls.push({ cmd: cmd.slice(), cwd: opts?.cwd ?? '', stdinText: '' })
    return proc as unknown as ReturnType<typeof Bun.spawn>
  }) as typeof Bun.spawn
}

function makeGitRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), 'orchestos-b3-ext-'))
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
    id: 'b3-external-test',
    description: 'B.3 external engine test',
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
    model: 'external/claude-code',
    providerName: 'external',
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
  for (const wt of worktrees.splice(0)) {
    try { wt.cleanup() } catch {}
  }
  for (const r of repos.splice(0)) {
    try { rmSync(r, { recursive: true, force: true }) } catch {}
  }
})

// -- tests ---------------------------------------------------------------------

describe('B.3 — externalEngine (claude-code subprocess)', () => {
  it('happy path: mock del subproceso devuelve JSON válido, worktree con cambios → outcome completo', async () => {
    const root = makeGitRepo()
    const wt = createWorktree('b3-happy', 'main', root)
    trackWorktree(wt)

    // Simulamos lo que el proceso externo escribiría: out.txt creado.
    writeFileSync(join(wt.path, 'out.txt'), 'hello from claude code\n')

    const mockStdout = JSON.stringify({
      usage: { input_tokens: 1234, output_tokens: 567 },
      total_cost_usd: 0.0123,
      num_turns: 4,
    })
    const proc = installMockSpawn(mockStdout)
    overrideBunSpawn(proc)

    const ctx = buildCtx(wt, baseTask())
    const outcome = await externalEngine.run(ctx, { maxTokens: 8192, maxIterations: 1, timeoutMs: 5000 })

    // El engine corrió contra el worktree (no contra el project root)
    expect(spawnCalls).toHaveLength(1)
    expect(spawnCalls[0]!.cwd).toBe(wt.path)
    // Decisión a del diseño: contrato via prompt + --allowedTools limitan blast radius
    expect(spawnCalls[0]!.cmd[0]).toBe('claude')
    expect(spawnCalls[0]!.cmd).toContain('-p')
    expect(spawnCalls[0]!.cmd).toContain('--output-format')
    expect(spawnCalls[0]!.cmd).toContain('json')
    expect(spawnCalls[0]!.cmd).toContain('--append-system-prompt')
    expect(spawnCalls[0]!.cmd).toContain('--allowedTools')

    // Outcome: files del diff (NO filtrado — el engine devuelve TODO el diff,
    // enforceContract en el harness es quien decide qué pasa)
    expect(outcome.files).toEqual([{ path: 'out.txt', content: 'hello from claude code\n' }])
    // Costo parseado honestamente
    expect(outcome.inputTokens).toBe(1234)
    expect(outcome.outputTokens).toBe(567)
    expect(outcome.usd).toBe(0.0123)
    expect(outcome.iterations).toBe(4)
    // costByIteration: 1 sola entrada agregada (Claude Code headless no expone
    // costo por turno individual, mismo argumento honesto que agentic.ts)
    expect(outcome.costByIteration).toHaveLength(1)
    expect(outcome.costByIteration[0]!.label).toBe('external (claude-code, 4 turns)')
    expect(outcome.costByIteration[0]!.model).toBe('external/claude-code')
    expect(outcome.costByIteration[0]!.inputTokens).toBe(1234)
    expect(outcome.costByIteration[0]!.outputTokens).toBe(567)
    expect(outcome.costByIteration[0]!.costUsd).toBe(0.0123)
    // C.1 — info de proceso persistida para que el run detail del dashboard
    // pueda reconstruir la línea de comandos del subproceso. El system prompt
    // real fue reemplazado por `<contract>` en el engine para no inflar la DB.
    expect(outcome.costByIteration[0]!.binary).toBe('claude')
    expect(outcome.costByIteration[0]!.args).toEqual([
      '-p', '--output-format', 'json',
      '--append-system-prompt', '<contract>',
      '--allowedTools', 'Edit,Write,Read,Glob,Grep',
    ])
    // Log con conteo de archivos
    expect(outcome.log).toHaveLength(1)
    expect(outcome.log[0]).toContain('1 file')
    expect(outcome.log[0]).toContain('worktree')
    expect(outcome.log[0]).not.toContain('killed by timeout')
  })

  it('D.1 — regresión en vivo: modificar un archivo TRACKEADO existente (git status " M path" como única entrada) no pierde el path', async () => {
    // Hallazgo real del gate D.1 (2026-07-05, dinero real, dos corridas):
    // Claude Code editó exactamente el archivo pedido en el worktree las dos
    // veces, pero el engine reportaba `files: []` de todos modos, disparando
    // "missing declared output" en el harness. Causa raíz: todos los tests de
    // arriba (happy path, contrato, etc.) solo escriben archivos NUEVOS
    // (untracked, "?? path" en el porcelain) — nunca modifican un archivo ya
    // trackeado y comiteado, que aparece como " M path" (espacio inicial
    // literal). El `git()` compartido de sandbox.ts hace `.trim()` sobre TODO
    // el stdout, comiéndose ese espacio inicial cuando es la primera línea —
    // "M src/foo.ts" tras el slice(3) queda "rc/foo.ts", que no existe, y se
    // descarta en silencio. Este test replica exactamente el escenario que
    // ninguno de arriba cubría.
    const root = makeGitRepo()
    writeFileSync(join(root, 'out.txt'), 'original content\n')
    git(['add', '-A'], root)
    git(['commit', '-m', 'add out.txt'], root)

    const wt = createWorktree('b3-tracked-mod', 'main', root)
    trackWorktree(wt)

    // Simula lo que Claude Code hizo en vivo: editar un archivo YA trackeado.
    writeFileSync(join(wt.path, 'out.txt'), 'modified by claude code\n')

    const mockStdout = JSON.stringify({
      usage: { input_tokens: 10, output_tokens: 20 },
      total_cost_usd: 0.01,
      num_turns: 1,
    })
    overrideBunSpawn(installMockSpawn(mockStdout))

    const ctx = buildCtx(wt, baseTask())
    const outcome = await externalEngine.run(ctx, { maxTokens: 8192, maxIterations: 1, timeoutMs: 5000 })

    expect(outcome.files).toEqual([{ path: 'out.txt', content: 'modified by claude code\n' }])
  })

  it('contrato sobre el diff: engine reporta el diff COMPLETO sin filtrar — archivos fuera de output[] tambien llegan al harness (decision d)', async () => {
    // El diseño dice explicitamente (decisión d): el engine NO filtra, el
    // contrato lo aplica el harness via enforceContract() sobre outcome.files.
    // Si el engine filtrara, estariamos duplicando logica Y un proceso que
    // escribe fuera del contrato (el caso que el harness necesita detectar)
    // pasaria invisible. Verificamos que ambos archivos llegan al outcome,
    // dejando a enforceContract (testeado en contract.test.ts) la decisión.
    const root = makeGitRepo()
    const wt = createWorktree('b3-contract', 'main', root)
    trackWorktree(wt)

    // El proceso "externo" escribió el archivo declarado Y otro fuera de output[].
    writeFileSync(join(wt.path, 'out.txt'), 'in contract\n')
    writeFileSync(join(wt.path, 'rogue.txt'), 'should be reported, not filtered\n')

    const proc = installMockSpawn(JSON.stringify({
      usage: { input_tokens: 100, output_tokens: 50 },
      total_cost_usd: 0.001,
      num_turns: 1,
    }))
    overrideBunSpawn(proc)

    const ctx = buildCtx(wt, baseTask({ output: ['out.txt'] }))
    const outcome = await externalEngine.run(ctx, { maxTokens: 4096, maxIterations: 1, timeoutMs: 5000 })

    const paths = outcome.files.map(f => f.path).sort()
    // Ambos archivos presentes — la frontera de seguridad es enforceContract en harness.ts
    expect(paths).toEqual(['out.txt', 'rogue.txt'])
    expect(outcome.files.find(f => f.path === 'out.txt')!.content).toBe('in contract\n')
    expect(outcome.files.find(f => f.path === 'rogue.txt')!.content).toBe('should be reported, not filtered\n')
  })

  it('parseGitStatusPorcelain handles rename format "XY old -> new" — el path final es el que se reporta', async () => {
    // El formato de rename en git status --porcelain v2 es "R  old -> new".
    // Simulamos el escenario: el proceso externo renombro README.md a README2.md.
    // (En una corrida real de claude, el rename aparecera como "R  README.md -> README2.md".)
    const root = makeGitRepo()
    const wt = createWorktree('b3-rename', 'main', root)
    trackWorktree(wt)

    git(['mv', 'README.md', 'README2.md'], wt.path)
    // El "diff" efectivo: README2.md existe, README.md ya no.

    const proc = installMockSpawn(JSON.stringify({
      usage: { input_tokens: 1, output_tokens: 1 },
      total_cost_usd: 0.0001,
      num_turns: 1,
    }))
    overrideBunSpawn(proc)

    const ctx = buildCtx(wt, baseTask())
    const outcome = await externalEngine.run(ctx, { maxTokens: 1024, maxIterations: 1, timeoutMs: 5000 })

    // Solo el path final del rename aparece (el viejo se descarta implicitamente:
    // ya no existe en disco, readFileSync falla y se salta — linea 55 de external.ts).
    expect(outcome.files.map(f => f.path)).toEqual(['README2.md'])
    expect(outcome.files[0]!.content).toBe('init')
  })

  it('timeout: subprocess que nunca termina → ExecutorExternalError menciona "timed out" (no $0 silencioso)', async () => {
    const root = makeGitRepo()
    const wt = createWorktree('b3-timeout', 'main', root)
    trackWorktree(wt)
    writeFileSync(join(wt.path, 'out.txt'), 'wont be reported, timed out before flush')

    // stdout nunca emite → `new Response(proc.stdout).text()` bloquea para siempre.
    // timeoutMs corto dispara el SIGTERM del setTimeout, pero el stream sigue colgado
    // (mock no honra kill), así que el `await proc.exited` nunca resuelve. Para que
    // el test termine, necesitamos un escenario más realista: el proc SÍ termina
    // (resolveExit se llama), pero DESPUÉS del timeout y sin stdout parseable.
    // Eso es exactamente la condición de "killed by timeout, partial output parsed"
    // que el engine maneja: lanza con mensaje de timeout porque JSON.parse falla.
    const proc = makeMockProc('not json at all because claude was killed before flushing', { exitDelayMs: 50 })
    overrideBunSpawn(proc)

    const ctx = buildCtx(wt, baseTask())
    // 1ms de timeout — el setTimeout del engine dispara casi instantáneo y marca timedOut=true.
    // proc.stdin.end() cierra el stdin, el await de exited resuelve a los 50ms, el
    // clearTimeout del engine ya pasó (timedOut quedó en true), el JSON.parse del
    // stdout (que tiene 'not json at all...') falla → throw con mensaje timeout.
    await expect(externalEngine.run(ctx, { maxTokens: 4096, maxIterations: 1, timeoutMs: 1 }))
      .rejects.toThrow(ExecutorExternalError)

    // Reset: re-ejecutamos con la asserción específica del mensaje.
    // (El test anterior verificó el TIPO; este verifica el mensaje exacto, que es la
    // evidencia clave de la decisión b del diseño: NO se reporta usd=0 silencioso.)
    const proc2 = makeMockProc('garbage', { exitDelayMs: 30 })
    overrideBunSpawn(proc2)
    const ctx2 = buildCtx(wt, baseTask())
    let caught: Error | null = null
    try {
      await externalEngine.run(ctx2, { maxTokens: 4096, maxIterations: 1, timeoutMs: 1 })
    } catch (e: any) {
      caught = e
    }
    expect(caught).toBeInstanceOf(ExecutorExternalError)
    expect(caught!.message).toContain('timed out')
    expect(caught!.message).toContain('not reported as $0')
    expect(caught!.message).toContain('1ms')
  })

  it('costo desconocido: stdout NO es JSON parseable (sin timeout) → ExecutorExternalError explicito', async () => {
    const root = makeGitRepo()
    const wt = createWorktree('b3-badjson', 'main', root)
    trackWorktree(wt)
    writeFileSync(join(wt.path, 'out.txt'), 'partial')

    // Stdout con texto plano — caso típico: claude crasheó o el output-format
    // no se respetó. NO es un timeout (proc termina rápido), pero el parse falla.
    const proc = installMockSpawn('claude code: command not found or similar stderr-only output')
    overrideBunSpawn(proc)

    const ctx = buildCtx(wt, baseTask())
    let caught: Error | null = null
    try {
      await externalEngine.run(ctx, { maxTokens: 4096, maxIterations: 1, timeoutMs: 5000 })
    } catch (e: any) {
      caught = e
    }
    expect(caught).toBeInstanceOf(ExecutorExternalError)
    expect(caught!.message).toContain('no parseable JSON')
    expect(caught!.message).toContain('not reported as $0')
  })

  it('costo desconocido: JSON parseable PERO sin total_cost_usd → rechaza (no $0 silencioso)', async () => {
    const root = makeGitRepo()
    const wt = createWorktree('b3-missing-cost', 'main', root)
    trackWorktree(wt)
    writeFileSync(join(wt.path, 'out.txt'), 'x')

    // JSON valido pero el campo crítico falta. Decisión b: "if not a number,
    // refusing to report cost as $0" (línea 141-143 de external.ts).
    const proc = installMockSpawn(JSON.stringify({
      usage: { input_tokens: 100, output_tokens: 50 },
      num_turns: 1,
      // total_cost_usd ausente
    }))
    overrideBunSpawn(proc)

    const ctx = buildCtx(wt, baseTask())
    let caught: Error | null = null
    try {
      await externalEngine.run(ctx, { maxTokens: 4096, maxIterations: 1, timeoutMs: 5000 })
    } catch (e: any) {
      caught = e
    }
    expect(caught).toBeInstanceOf(ExecutorExternalError)
    expect(caught!.message).toContain('total_cost_usd')
    expect(caught!.message).toContain('refusing to report cost as $0')
  })

  it('costo parcial: total_cost_usd presente, usage ausente → defaults a 0 (no es "costo desconocido")', async () => {
    // Caso límite: claude devolvió cost pero no usage. La decisión b es específica
    // sobre total_cost_usd (campo crítico); usage es informativo. Si falta usage,
    // caemos a 0 tokens con un cost real — NO es el mismo caso que "costo
    // desconocido". Verificamos que esto pasa sin throw, registrando 0 tokens
    // pero el costo real (honesto, no $0).
    const root = makeGitRepo()
    const wt = createWorktree('b3-partial-usage', 'main', root)
    trackWorktree(wt)
    writeFileSync(join(wt.path, 'out.txt'), 'partial usage')

    const proc = installMockSpawn(JSON.stringify({
      // usage ausente
      total_cost_usd: 0.005,
      num_turns: 2,
    }))
    overrideBunSpawn(proc)

    const ctx = buildCtx(wt, baseTask())
    const outcome = await externalEngine.run(ctx, { maxTokens: 4096, maxIterations: 1, timeoutMs: 5000 })

    expect(outcome.usd).toBe(0.005)
    expect(outcome.inputTokens).toBe(0)
    expect(outcome.outputTokens).toBe(0)
    expect(outcome.iterations).toBe(2)
  })

  it('num_turns ausente → default 1 (singular en el label del costByIteration)', async () => {
    const root = makeGitRepo()
    const wt = createWorktree('b3-no-turns', 'main', root)
    trackWorktree(wt)
    writeFileSync(join(wt.path, 'out.txt'), 'x')

    const proc = installMockSpawn(JSON.stringify({
      usage: { input_tokens: 1, output_tokens: 1 },
      total_cost_usd: 0.0001,
      // num_turns ausente
    }))
    overrideBunSpawn(proc)

    const ctx = buildCtx(wt, baseTask())
    const outcome = await externalEngine.run(ctx, { maxTokens: 1024, maxIterations: 1, timeoutMs: 5000 })

    expect(outcome.iterations).toBe(1)
    // Pluralización correcta: "1 turn" sin 's' cuando iterations === 1
    expect(outcome.costByIteration[0]!.label).toBe('external (claude-code, 1 turn)')
  })

  it('rechaza correr sin worktree — red de seguridad contra proceso no controlado (decision d, §5)', async () => {
    // Sin worktree, el engine DEBE lanzar antes de hacer cualquier spawn.
    // Esto es lo que el test B.2 (engine-selection.test.ts) ya verifica a nivel
    // harness, pero lo duplicamos a nivel engine para fijar la invariante de
    // módulo: el engine NUNCA escribe a disco sin worktree, ni siquiera con
    // sandboxMode: 'cwd' (que es el default en otros engines).
    const ctx: RunContext = {
      opts: {} as any,
      taskClass: 'implement',
      model: 'external/claude-code',
      providerName: 'external',
      provider: null as any,
      task: baseTask(),
      embedHits: 0,
      skillInstructions: '',
      allowedTools: [],
      constitutionBlock: '',
      constitutionRules: null,
      effectiveContext: '',
      contextSource: 'AGENTS.md',
      contextTokens: 0,
      effectiveRoot: '/tmp/whatever',
      worktree: null, // <-- la condicion que el engine rechaza
      instinctBlock: '',
      prompt: { system: '', userContent: 'x' },
      contextWarnings: [],
    }

    // Si Bun.spawn fuera llamado, esto fallaria (no lo configuramos), confirmando
    // que el throw es ANTES del spawn.
    await expect(externalEngine.run(ctx, { maxTokens: 4096, maxIterations: 1, timeoutMs: 5000 }))
      .rejects.toThrow(ExecutorExternalError)
    expect(spawnCalls).toHaveLength(0)
  })

  it('worktree sin cambios → files vacíos pero outcome normal (costo y log presentes)', async () => {
    // Caso límite: el proceso externo terminó sin tocar archivos (ej. solo leyó
    // y reportó). El engine devuelve files=[] pero igual parsea el costo. No es
    // un error: el harness luego verá que no hay archivos que matcheen output[]
    // y eso es la señal natural de "no produjo nada", manejada por otras capas.
    const root = makeGitRepo()
    const wt = createWorktree('b3-noop', 'main', root)
    trackWorktree(wt)

    const proc = installMockSpawn(JSON.stringify({
      usage: { input_tokens: 10, output_tokens: 5 },
      total_cost_usd: 0.0001,
      num_turns: 1,
    }))
    overrideBunSpawn(proc)

    const ctx = buildCtx(wt, baseTask())
    const outcome = await externalEngine.run(ctx, { maxTokens: 1024, maxIterations: 1, timeoutMs: 5000 })

    expect(outcome.files).toEqual([])
    expect(outcome.usd).toBe(0.0001)
    expect(outcome.log[0]).toContain('0 file')
  })

  it('paths normalizados a relativos y con forward slashes (compatibles con enforceContract)', async () => {
    // Decisión d: el engine lee paths desde git status --porcelain y los pasa
    // por normalizeRelPath() (línea 53) para garantizar que el harness pueda
    // compararlos contra task.output[] sin problemas de './' o 'foo/../bar'.
    // Verificamos que el path que llega al outcome no tiene './' prefijo ni
    // separadores mixtos.
    const root = makeGitRepo()
    const wt = createWorktree('b3-normpath', 'main', root)
    trackWorktree(wt)
    writeFileSync(join(wt.path, 'out.txt'), 'normalized path test')

    const proc = installMockSpawn(JSON.stringify({
      usage: { input_tokens: 1, output_tokens: 1 },
      total_cost_usd: 0.0001,
      num_turns: 1,
    }))
    overrideBunSpawn(proc)

    const ctx = buildCtx(wt, baseTask())
    const outcome = await externalEngine.run(ctx, { maxTokens: 1024, maxIterations: 1, timeoutMs: 5000 })

    const paths = outcome.files.map(f => f.path)
    expect(paths).toContain('out.txt')
    for (const p of paths) {
      expect(p.startsWith('./')).toBe(false)
      expect(p.startsWith('/')).toBe(false)
      expect(p.includes('\\')).toBe(false)
    }
  })

  it('B.4 — directorio untracked (solo) no crashea con EISDIR: statSync.isFile() lo descarta antes de readFileSync', async () => {
    // El bug que destapó este test en B.3: git status --porcelain reporta
    // `?? empty-dir/` cuando el proceso externo crea un directorio vacío.
    // readFileSync sobre un directorio tira EISDIR. El fix (B.4) salta
    // entradas que no son archivos via statSync(full).isFile() — coherente
    // con la regla existente "existsSync(full) → continue" para borrados.
    // Si el directorio tiene contenido, git lo reporta como paths
    // individuales (siguiente test cubre ese caso).
    const { mkdirSync } = await import('fs')
    const root = makeGitRepo()
    const wt = createWorktree('b4-empty-dir', 'main', root)
    trackWorktree(wt)
    mkdirSync(join(wt.path, 'empty-dir'))
    // Tambien un archivo "normal" para verificar que el skip del directorio
    // no afecta a archivos hermanos.
    writeFileSync(join(wt.path, 'out.txt'), 'sibling of empty dir\n')

    const proc = installMockSpawn(JSON.stringify({
      usage: { input_tokens: 1, output_tokens: 1 },
      total_cost_usd: 0.0001,
      num_turns: 1,
    }))
    overrideBunSpawn(proc)

    const ctx = buildCtx(wt, baseTask())
    const outcome = await externalEngine.run(ctx, { maxTokens: 1024, maxIterations: 1, timeoutMs: 5000 })

    // El archivo hermano se reporta normal; el directorio vacío NO aparece
    // (es lo correcto — un dir vacío no es un FileChange).
    const paths = outcome.files.map(f => f.path).sort()
    expect(paths).toEqual(['out.txt'])
    expect(outcome.files[0]!.content).toBe('sibling of empty dir\n')
  })

  it('B.4 — directorio con contenido: git reporta los archivos internos individualmente y se leen OK', async () => {
    // Caso complementario: si el proceso externo crea `sub/inner.txt`, git
    // reporta `?? sub/inner.txt` directamente (no `?? sub/`). El fix debe
    // leer el archivo interno sin intentar leer el directorio.
    // Antes del fix este test crasheaba con EISDIR porque ademas de
    // `sub/inner.txt` git tambien reportaba `sub/` (depende de la version
    // de git, pero defensivamente lo testeamos).
    const { mkdirSync } = await import('fs')
    const root = makeGitRepo()
    const wt = createWorktree('b4-dir-with-file', 'main', root)
    trackWorktree(wt)
    mkdirSync(join(wt.path, 'sub'), { recursive: true })
    writeFileSync(join(wt.path, 'sub', 'inner.txt'), 'nested file\n')

    const proc = installMockSpawn(JSON.stringify({
      usage: { input_tokens: 1, output_tokens: 1 },
      total_cost_usd: 0.0001,
      num_turns: 1,
    }))
    overrideBunSpawn(proc)

    const ctx = buildCtx(wt, baseTask())
    const outcome = await externalEngine.run(ctx, { maxTokens: 1024, maxIterations: 1, timeoutMs: 5000 })

    // Al menos `sub/inner.txt` aparece; el directorio `sub/` puede o no
    // aparecer en el porcelain (depende de git), pero si aparece, el fix
    // lo descarta via isFile() sin crashear.
    const paths = outcome.files.map(f => f.path).sort()
    expect(paths).toContain('sub/inner.txt')
    expect(outcome.files.find(f => f.path === 'sub/inner.txt')!.content).toBe('nested file\n')
    // Aseguramos que ningun path del outcome es un directorio
    for (const f of outcome.files) {
      expect(f.path.endsWith('/')).toBe(false)
    }
  })

  it('C.1 — args del subproceso son la única fuente de verdad: lo que se le pasa a Bun.spawn y lo que se persiste en costByIteration coinciden (estructura), salvo el system prompt completo', async () => {
    // buildClaudeArgs() arma los args UNA vez; runClaudeCode los pasa a
    // Bun.spawn con el system prompt real, y costByIteration[0].args los
    // persiste con `<contract>` en lugar del prompt. Verificamos la coherencia
    // estructural: misma cantidad de elementos, mismas flags en las mismas
    // posiciones, mismo binario. Lo que cambia es solo el slot del prompt.
    const root = makeGitRepo()
    const wt = createWorktree('c1-ssot', 'main', root)
    trackWorktree(wt)
    writeFileSync(join(wt.path, 'out.txt'), 'ok')

    const proc = installMockSpawn(JSON.stringify({
      usage: { input_tokens: 1, output_tokens: 1 },
      total_cost_usd: 0.0001,
      num_turns: 1,
    }))
    overrideBunSpawn(proc)

    const ctx = buildCtx(wt, baseTask())
    const outcome = await externalEngine.run(ctx, { maxTokens: 1024, maxIterations: 1, timeoutMs: 5000 })

    // Lo que Bun.spawn recibio:
    const spawned = spawnCalls[0]!.cmd
    // Lo que el detalle del run va a mostrar:
    const persisted = outcome.costByIteration[0]!.args!
    const persistedBinary = outcome.costByIteration[0]!.binary!

    // Mismo binario, misma longitud
    expect(spawned[0]).toBe(persistedBinary)
    expect(spawned.length).toBe(1 + persisted.length)
    // Mismas flags en las mismas posiciones (todo lo que no es el system prompt)
    // spawned = ['claude', '-p', '--output-format', 'json', '--append-system-prompt', '<prompt real>', '--allowedTools', 'Edit,Write,Read,Glob,Grep']
    // persisted = ['-p', '--output-format', 'json', '--append-system-prompt', '<contract>', '--allowedTools', 'Edit,Write,Read,Glob,Grep']
    expect(spawned[1]).toBe(persisted[0]) // -p
    expect(spawned[2]).toBe(persisted[1]) // --output-format
    expect(spawned[3]).toBe(persisted[2]) // json
    expect(spawned[4]).toBe(persisted[3]) // --append-system-prompt
    // spawned[5] es el prompt real (largo); persisted[4] es el placeholder
    expect(persisted[4]).toBe('<contract>')
    expect(spawned[5]).not.toBe('<contract>') // no se persiste el prompt real
    expect(spawned[5]!.length).toBeGreaterThan(0) // y se pasa algo
    // Cola
    expect(spawned[6]).toBe(persisted[5]) // --allowedTools
    expect(spawned[7]).toBe(persisted[6]) // Edit,Write,Read,Glob,Grep
  })

  it('C.1 — el system prompt pasado a Bun.spawn NO contiene el placeholder `<contract>` (es el contrato real)', async () => {
    // Belt-and-suspenders para que un refactor futuro no rompa la honestidad:
    // el system prompt real se manda al subproceso, y el placeholder se queda
    // solo en la copia persistida. Si alguien refactoriza y accidentalmente
    // manda `<contract>` al subproceso, este test lo destapa.
    const root = makeGitRepo()
    const wt = createWorktree('c1-realprompt', 'main', root)
    trackWorktree(wt)
    writeFileSync(join(wt.path, 'out.txt'), 'ok')

    const proc = installMockSpawn(JSON.stringify({
      usage: { input_tokens: 1, output_tokens: 1 },
      total_cost_usd: 0.0001,
      num_turns: 1,
    }))
    overrideBunSpawn(proc)

    // effectiveContext lo arma buildCtx como '' y el engine construye el
    // prompt via buildSystemPrompt() que junta effectiveContext + constitutionBlock
    // + skillInstructions + instinctBlock + "## OUTPUT CONTRACT" + "You may ONLY..."
    // Aca al menos verificamos que la copia persistida no se filtra al spawn.
    const ctx = buildCtx(wt, baseTask())
    await externalEngine.run(ctx, { maxTokens: 1024, maxIterations: 1, timeoutMs: 5000 })

    const spawned = spawnCalls[0]!.cmd
    const systemPromptArg = spawned[5] // el unico que no esta en args persistidos
    // El system prompt real es la cadena del contrato, no el placeholder
    expect(systemPromptArg).not.toBe('<contract>')
    // Y debe contener la marca canonica del contrato (output[])
    expect(systemPromptArg).toContain('OUTPUT CONTRACT')
    expect(systemPromptArg).toContain('out.txt')
  })

  it('C.2 — binario ausente: throw con mensaje accionable ANTES de crear worktree o spawn (no fallo criptico)', async () => {
    // Mockeamos findClaudeBinary via override de Bun.which. La idea: en una
    // maquina sin claude, el engine falla INMEDIATAMENTE con un mensaje que
    // dice (a) que pasa, (b) como arreglarlo. No queremos que el usuario
    // vea "spawn ENOENT" 5 stack frames abajo.
    const originalWhich = Bun.which
    ;(Bun as any).which = (_bin: string) => null
    try {
      const root = makeGitRepo()
      const wt = createWorktree('c2-no-binary', 'main', root)
      trackWorktree(wt)
      // Aun si el worktree tiene cambios (simulando que ya hubo un run previo
      // o un setup), el engine debe fallar antes de tocar nada.
      writeFileSync(join(wt.path, 'out.txt'), 'would be reported if binary existed')

      const proc = installMockSpawn(JSON.stringify({
        usage: { input_tokens: 1, output_tokens: 1 },
        total_cost_usd: 0.0001,
        num_turns: 1,
      }))
      overrideBunSpawn(proc)

      const ctx = buildCtx(wt, baseTask())
      let caught: Error | null = null
      try {
        await externalEngine.run(ctx, { maxTokens: 1024, maxIterations: 1, timeoutMs: 5000 })
      } catch (e: any) {
        caught = e
      }
      // Tipo correcto
      expect(caught).toBeInstanceOf(ExecutorExternalError)
      // Mensaje accionable: menciona el binario Y como instalar
      expect(caught!.message).toContain('"claude"')
      expect(caught!.message).toContain('not found in PATH')
      expect(caught!.message).toContain('Install Claude Code')
      expect(caught!.message).toContain('https://claude.com/download')
      // Y, crucialmente: NUNCA se llamo a Bun.spawn. El check es pre-spawn.
      // Si el check fallara, veriamos el mock proc haber sido invocado.
      expect(spawnCalls).toHaveLength(0)
    } finally {
      ;(Bun as any).which = originalWhich
    }
  })

  it('C.2 — findClaudeBinary() exportado: reusado por CLI y API (no drift entre los 3 puntos de seleccion)', async () => {
    // La idea: el engine, la CLI y el endpoint del dashboard usan LA MISMA
    // funcion. Si en algun momento alguien cambia la implementacion en uno
    // pero no en los otros, este test es el centinela: exportamos la
    // funcion y verificamos que respeta el contrato de Bun.which.
    const { findClaudeBinary } = await import('../run/executors/external.ts')
    // Caso positivo: en CI/dev machines `claude` puede o no estar — pero
    // si esta, el resultado tiene la forma de un path absoluto.
    const found = findClaudeBinary()
    if (found !== null) {
      expect(found.startsWith('/')).toBe(true)
    }
    // Negativo: overrideamos Bun.which para forzar null y verificamos que la
    // funcion propaga ese null (no inventa un fallback).
    const originalWhich = Bun.which
    ;(Bun as any).which = (_bin: string) => null
    try {
      expect(findClaudeBinary()).toBeNull()
    } finally {
      ;(Bun as any).which = originalWhich
    }
  })

  it('C.2 — binario presente: el check pasa y el flujo sigue normal (regresion: no rompimos el happy path)', async () => {
    // El happy path ya estaba cubierto por el primer test, pero aca lo
    // explicitamos con el mensaje en claro: si `which` lo encuentra, no hay
    // throw del guard y el engine corre como antes.
    const originalWhich = Bun.which
    ;(Bun as any).which = (_bin: string) => '/usr/local/bin/claude'
    try {
      const root = makeGitRepo()
      const wt = createWorktree('c2-binary-ok', 'main', root)
      trackWorktree(wt)
      writeFileSync(join(wt.path, 'out.txt'), 'all good')

      const proc = installMockSpawn(JSON.stringify({
        usage: { input_tokens: 1, output_tokens: 1 },
        total_cost_usd: 0.0001,
        num_turns: 1,
      }))
      overrideBunSpawn(proc)

      const ctx = buildCtx(wt, baseTask())
      const outcome = await externalEngine.run(ctx, { maxTokens: 1024, maxIterations: 1, timeoutMs: 5000 })
      expect(outcome.files).toEqual([{ path: 'out.txt', content: 'all good' }])
      expect(spawnCalls).toHaveLength(1)
    } finally {
      ;(Bun as any).which = originalWhich
    }
  })
})
