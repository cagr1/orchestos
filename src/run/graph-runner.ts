/**
 * src/run/graph-runner.ts
 *
 * A2 — Graph runner: topological traversal that walks the full DAG.
 * A branch that exhausts retries marks its dependents as 'blocked' with
 * explicit reason and continues independent branches (no global break).
 *
 * A4 — Circuit breaker: three independent limits (iterations, wall-clock,
 * max cost), plus context-monitor `cost_notice` integration.
 * Any limit crossed → stop immediately, leave remaining tasks `pending`
 * for a future `--graph` invocation.
 *
 * Design: docs/graph-runner-design.md
 * Pattern source: scheduler.ts executePlan() (Mes 5) — ported from SubTask[] to Task[]
 *
 * Reglas del plan.md:
 *   - Nunca hace break global ante un failed (como executePlan, no como --all)
 *   - Una rama que agota retries marca dependientes como blocked con razón explícita
 *   - Las ramas independientes continúan sin tocarse
 *   - Reusa 'blocked' status existente en TaskStatus (src/tasks/schema.ts)
 *   - Circuit breaker con 3 topes: iteraciones (200), costo acumulado, wall-clock
 *   - cost_notice del context-monitor integrado como warning informativo + umbral de parada
 */

import { loadTasks as loadTasksReal, updateTaskStatus as updateTaskStatusReal } from '../tasks/loader.ts'
import { runTask } from './harness.ts'
import { diagnoseTask } from '../agents/diagnose.ts'
import type { FailurePattern } from '../agents/diagnose.ts'
import { MAX_RETRIES } from './qa.ts'
import { RunLogger } from './logger.ts'
import type { Task } from '../tasks/schema.ts'
import type { OrcheConfig } from '../config/schema.ts'
import type { SandboxMode } from './sandbox-policy.ts'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GRAPH_MAX_ITERATIONS = 200
const RATE_LIMIT_REQUEUE_DELAY_MS = 10_000
/** Aviso informativo de costo de sesión, alineado con el cost_notice de context-monitor ($5). */
const COST_NOTICE_THRESHOLD_USD = 5

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type GraphOutcome =
  | 'completed'
  | 'failed_permanent'
  | 'blocked'
  | 'rate_limited_then_completed'
  | 'skipped_circuit_breaker'

export interface GraphTaskEntry {
  id: string
  outcome: GraphOutcome
  error?: string
  usd_cost: number
  tokens: { input: number; output: number }
  elapsed_ms: number
}

export interface GraphRunResult {
  tasks: GraphTaskEntry[]
  aggregated_cost: number
  aggregated_tokens: { input: number; output: number }
  aggregated_ms: number
  circuit_break_reason?: string
  /** Fraction [0,1] of tasks that completed autonomously (sin intervención humana) */
  autonomy_metric: number
}

export interface GraphRunOpts {
  projectRoot: string
  contextText: string
  projectId?: string
  orcheConfig?: OrcheConfig
  orcheConfigFound?: boolean
  maxCost?: number
  maxMinutes?: number
  sandboxMode?: SandboxMode
  keepWorktree?: boolean
  /**
   * Test-only injection seam. Bun's `mock.module()` replaces a module for the
   * whole `bun test` process (every file that statically imports it afterwards
   * gets the mock too) — unsafe for `run/harness.ts`, `agents/diagnose.ts` and
   * `tasks/loader.ts` since other suites (spec.test.ts, diagnose.test.ts,
   * graph-summary.test.ts) import them directly. Passing these lets tests stub
   * task execution and task state without touching the shared module graph.
   * Never set by real callers (cli.ts, dashboard handler) — defaults to the
   * real implementations.
   */
  runTaskFn?: typeof runTask
  diagnoseFn?: typeof diagnoseTask
  loadTasksFn?: typeof loadTasksReal
  updateTaskStatusFn?: typeof updateTaskStatusReal
}

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

export async function runGraph(
  opts: GraphRunOpts,
): Promise<GraphRunResult> {
  const {
    projectRoot, contextText, projectId, orcheConfig, orcheConfigFound,
    maxCost, maxMinutes, sandboxMode, keepWorktree,
    runTaskFn = runTask, diagnoseFn = diagnoseTask,
    loadTasksFn = loadTasksReal, updateTaskStatusFn = updateTaskStatusReal,
  } = opts

  const entries: GraphTaskEntry[] = []
  let totalCost = 0
  let totalInputTokens = 0
  let totalOutputTokens = 0
  let totalMs = 0
  let circuitBreakReason: string | undefined

  const requeuedForRateLimit = new Set<string>()
  const blockedAncestors = new Set<string>()

  const startedAt = Date.now()

  for (let iteration = 0; iteration < GRAPH_MAX_ITERATIONS; iteration++) {
    // ── Circuit breaker (A4) — pre-iteration checks ──────────────────────
    // AR.4: `maxCost && ...` / `maxMinutes && ...` trataba 0 como "sin límite"
    // por truthiness — pasar --max-cost 0 ("no gastar nada") invertía la
    // intención del usuario y dejaba gastar sin tope. `!= null` distingue
    // "no se pasó el flag" de "se pasó 0".
    if (maxMinutes != null && (Date.now() - startedAt) / 60_000 >= maxMinutes) {
      circuitBreakReason = `wall-clock limit reached (${maxMinutes} min)`
      break
    }
    if (maxCost != null && totalCost >= maxCost) {
      circuitBreakReason = `cost limit reached ($${maxCost.toFixed(4)})`
      break
    }

    // ── Load current state from tasks.yaml ───────────────────────────────
    const file = loadTasksFn(projectRoot)
    const tasks = file.tasks

    // Find ready tasks: pending, all deps done, not already a blocked ancestor
    const ready = tasks.filter(t =>
      t.status === 'pending' &&
      !blockedAncestors.has(t.id) &&
      t.depends_on.every(dep => {
        const depTask = tasks.find(x => x.id === dep)
        return depTask?.status === 'done'
      })
    )

    const anyPendingNotBlocked = tasks.some(t =>
      t.status === 'pending' && !blockedAncestors.has(t.id)
    )

    // AR.1 — el runner es secuencial: nada fuera de este loop cambia
    // tasks.yaml entre iteraciones. Si no hay 'ready' pero sí pending no
    // bloqueados, el atasco es permanente (dep inexistente o ciclo) — no se
    // va a resolver con un sleep. Cortar ya y nombrar qué quedó atascado,
    // igual que --all (cli.ts:1070-1073), en vez de un busy-wait silencioso.
    if (ready.length === 0) {
      if (anyPendingNotBlocked) {
        const stuck = tasks.filter(t => t.status === 'pending' && !blockedAncestors.has(t.id))
        const detail = stuck.map(t => {
          const unmet = t.depends_on.filter(dep => tasks.find(x => x.id === dep)?.status !== 'done')
          return `${t.id} (waiting on: ${unmet.join(', ') || 'unknown'})`
        }).join('; ')
        circuitBreakReason = `no executable tasks — stuck: ${detail}`
        console.error(`\n[graph] ⏹ Stalled — ${circuitBreakReason}`)
      }
      break
    }

    // ── Execute each ready task ──────────────────────────────────────────
    for (const task of ready) {
      if (blockedAncestors.has(task.id)) continue

      const t0 = performance.now()
      const entry = await executeSingleTask(
        task,
        { projectRoot, contextText, projectId, orcheConfig, orcheConfigFound, sandboxMode, keepWorktree, runTaskFn, diagnoseFn, loadTasksFn, updateTaskStatusFn },
        requeuedForRateLimit,
        blockedAncestors,
      )
      entry.elapsed_ms = Math.round(performance.now() - t0)

      entries.push(entry)
      totalCost += entry.usd_cost
      totalInputTokens += entry.tokens.input
      totalOutputTokens += entry.tokens.output
      totalMs += entry.elapsed_ms

      if (entry.outcome === 'failed_permanent') {
        console.error(`[graph] ✗ ${task.id} failed permanently — branch blocked`)
      } else if (entry.outcome === 'blocked') {
        console.error(`[graph] ⊘ ${task.id} blocked`)
      } else if (entry.outcome === 'rate_limited_then_completed') {
        console.error(`[graph] ✓ ${task.id} done (after rate-limit requeue)`)
      } else {
        console.error(`[graph] ✓ ${task.id} done`)
      }

      // ── A4 — Cost notice de sesión ─────────────────────────────────────
      // A nivel de grafo solo vigilamos el COSTO ACUMULADO de la sesión: cada
      // tarea es una llamada aislada (contexto propio, sin historial heredado),
      // así que la salud de contexto por modelo ya se verifica por-tarea dentro
      // del harness con la ventana real del catálogo (contextWindowFor). Sumar
      // tokens de tareas independientes contra una ventana única no significaría
      // nada — sería una métrica de costo disfrazada de salud de contexto.
      if (totalCost > COST_NOTICE_THRESHOLD_USD) {
        console.error(`[graph] notice: costo acumulado $${totalCost.toFixed(2)} supera $${COST_NOTICE_THRESHOLD_USD.toFixed(2)}`)
      }

      // ── A4 — Post-task circuit breaker ─────────────────────────────────
      if (maxCost != null && totalCost >= maxCost) {
        circuitBreakReason = `cost limit reached ($${maxCost.toFixed(4)})`
        break
      }
    }

    // Inner break for cost limit → also break outer loop
    if (circuitBreakReason) break
  }

  if (circuitBreakReason) {
    console.error(`\n[graph] ⏹ Circuit break: ${circuitBreakReason}`)
  }

  // AR.5 — el reporte debe dar cuenta de TODA tarea, no solo las que llegaron
  // a ejecutarse: (a) tareas que el circuit breaker o el atasco (AR.1) dejaron
  // sin tocar (quedan 'pending' en tasks.yaml, sin entry) y (b) tareas
  // bloqueadas transitivamente como descendiente de una rama fallida (su
  // status pasa a 'blocked' directo, sin pasar por executeSingleTask, así que
  // tampoco tenían entry). Sin esto, B2 (reporte de cierre) no puede distinguir
  // "no se llegó a ejecutar" de "no existía".
  const reportedIds = new Set(entries.map(e => e.id))
  for (const t of loadTasksFn(projectRoot).tasks) {
    if (reportedIds.has(t.id) || t.status === 'done') continue
    entries.push({
      id: t.id,
      outcome: t.status === 'blocked' ? 'blocked' : 'skipped_circuit_breaker',
      error: t.retry_reason,
      usd_cost: 0,
      tokens: { input: 0, output: 0 },
      elapsed_ms: 0,
    })
  }

  const completedCount = entries.filter(e =>
    e.outcome === 'completed' || e.outcome === 'rate_limited_then_completed'
  ).length
  const autonomyMetric = entries.length > 0 ? completedCount / entries.length : 1

  return {
    tasks: entries,
    aggregated_cost: totalCost,
    aggregated_tokens: { input: totalInputTokens, output: totalOutputTokens },
    aggregated_ms: totalMs,
    circuit_break_reason: circuitBreakReason,
    autonomy_metric: autonomyMetric,
  }
}

// ---------------------------------------------------------------------------
// Execute a single task with internal retry loop
// ---------------------------------------------------------------------------

/**
 * Executes one task within the graph context.
 * Handles the full lifecycle internally:
 *   1. Dependency check → 'blocked'
 *   2. runTask → 'done' / 'retry' (loop) / 'failed'
 *   3. Upon failed_permanent: diagnose + apply strategy per design.md §2
 *      - rate_limit → one requeue with backoff
 *      - all other patterns → block descendants, continue independent branches
 * Returns only when the task reaches a terminal outcome.
 */
async function executeSingleTask(
  task: Task,
  ctx: {
    projectRoot: string
    contextText: string
    projectId?: string
    orcheConfig?: OrcheConfig
    orcheConfigFound?: boolean
    sandboxMode?: SandboxMode
    keepWorktree?: boolean
    runTaskFn: typeof runTask
    diagnoseFn: typeof diagnoseTask
    loadTasksFn: typeof loadTasksReal
    updateTaskStatusFn: typeof updateTaskStatusReal
  },
  requeuedForRateLimit: Set<string>,
  blockedAncestors: Set<string>,
): Promise<GraphTaskEntry> {
  const { projectRoot, contextText, projectId, orcheConfig, orcheConfigFound, sandboxMode, keepWorktree, runTaskFn, diagnoseFn, loadTasksFn, updateTaskStatusFn } = ctx
  const taskId = task.id

  // Acumuladores de TODOS los intentos: una tarea puede hacer varias llamadas
  // LLM (retries + requeue de rate_limit) y cada una cuesta dinero. El costo
  // del circuit breaker depende de sumarlas todas — descartar los intentos
  // intermedios subcontaría el gasto y dejaría que --max-cost nunca dispare.
  let accCost = 0
  let accInput = 0
  let accOutput = 0

  // ── Initial dependency check ──────────────────────────────────────────
  // AR.6: `find(...)!` revienta con TypeError si la tarea se borró de
  // tasks.yaml entre el momento en que se computó `ready` y esta llamada
  // (edición externa concurrente del archivo). Devolver un outcome explícito
  // en vez de lanzar — el grafo no se detiene por una tarea que ya no existe.
  const initialFile = loadTasksFn(projectRoot)
  const t = initialFile.tasks.find(x => x.id === taskId)
  if (!t) {
    return {
      id: taskId, outcome: 'failed_permanent',
      error: 'task no longer exists in tasks.yaml',
      usd_cost: 0, tokens: { input: 0, output: 0 }, elapsed_ms: 0,
    }
  }
  if (t.status === 'done') {
    return {
      id: taskId, outcome: 'completed',
      usd_cost: 0, tokens: { input: 0, output: 0 }, elapsed_ms: 0,
    }
  }

  for (const dep of t.depends_on) {
    const depTask = initialFile.tasks.find(x => x.id === dep)
    if (!depTask || depTask.status !== 'done') {
      new RunLogger(projectRoot, taskId).blocked(dep)
      updateTaskStatusFn(projectRoot, taskId, {
        status: 'blocked',
        retry_reason: `dependency not done: ${dep}`,
      })
      return {
        id: taskId, outcome: 'blocked',
        error: `blocked by: ${dep} (${depTask?.status ?? 'not found'})`,
        usd_cost: 0, tokens: { input: 0, output: 0 }, elapsed_ms: 0,
      }
    }
  }

  // ── Internal retry loop ───────────────────────────────────────────────
  // Each iteration: runTask returns 'retry' while retries remain,
  // 'failed' when exhausted. We loop until 'done' or 'failed'.
  // Bound covers two full exhaustion cycles (MAX_RETRIES each) because a
  // rate_limit diagnosis resets retry_count to 0 and starts a fresh cycle
  // (design.md §2 — at most one requeue per task).
  for (let attempt = 0; attempt < MAX_RETRIES * 2 + 1; attempt++) {
    const currentFile = loadTasksFn(projectRoot)
    const currentTask = currentFile.tasks.find(x => x.id === taskId)
    if (!currentTask) {
      return {
        id: taskId, outcome: 'failed_permanent',
        error: 'task no longer exists in tasks.yaml',
        usd_cost: accCost, tokens: { input: accInput, output: accOutput }, elapsed_ms: 0,
      }
    }
    if (currentTask.status === 'done') {
      return {
        id: taskId, outcome: 'completed',
        usd_cost: 0, tokens: { input: 0, output: 0 }, elapsed_ms: 0,
      }
    }

    if (currentTask.status === 'failed_permanent') {
      // Was set externally or from a previous attempt — treat as terminal
      return {
        id: taskId, outcome: 'failed_permanent',
        error: currentTask.retry_reason,
        usd_cost: 0, tokens: { input: 0, output: 0 }, elapsed_ms: 0,
      }
    }

    // Mark running and execute
    const log = new RunLogger(projectRoot, taskId)
    updateTaskStatusFn(projectRoot, taskId, { status: 'running' })
    console.error(`  → ${taskId} attempt ${attempt + 1}`)

    const harnessResult = await runTaskFn({
      projectRoot, contextText,
      task: currentTask,
      projectId, logger: log,
      orcheConfig, orcheConfigFound,
      sandboxMode, keepWorktree,
    })

    const cost = harnessResult.cost
    accCost += cost.usd
    accInput += cost.inputTokens
    accOutput += cost.outputTokens

    if (harnessResult.status === 'done') {
      updateTaskStatusFn(projectRoot, taskId, {
        status: 'done',
        run_id: harnessResult.runId,
        qa_verdict: 'pass',
        retry_reason: undefined,
      })
      return {
        id: taskId,
        // Si llegó a 'done' tras un requeue por rate_limit, refleja ese camino
        // en el outcome (antes este caso se reportaba como 'completed' a secas).
        outcome: requeuedForRateLimit.has(taskId) ? 'rate_limited_then_completed' : 'completed',
        usd_cost: accCost,
        tokens: { input: accInput, output: accOutput },
        elapsed_ms: 0,
      }
    }

    if (harnessResult.status === 'retry') {
      const retryCount = currentTask.retry_count + 1
      updateTaskStatusFn(projectRoot, taskId, {
        status: 'pending',
        qa_verdict: 'fail',
        retry_reason: harnessResult.retryReason,
        retry_count: retryCount,
      })
      console.error(`  ↻ ${taskId} retry ${retryCount}/${MAX_RETRIES}`)
      continue
    }

    // ── Failed (all harness retries exhausted) ───────────────────────────
    const isPermanent = currentTask.retry_count + 1 >= MAX_RETRIES
    const newStatus = isPermanent ? 'failed_permanent' : 'failed'
    updateTaskStatusFn(projectRoot, taskId, {
      status: newStatus,
      retry_reason: harnessResult.retryReason,
    })

    if (!isPermanent) {
      // AR.6: sí es alcanzable, no es un edge case — el harness devuelve
      // 'failed' (no 'retry') para parse_error y contract_violation sin mirar
      // retry_count (harness.ts:198,210), así que esta rama es el camino normal
      // para esos dos fallos mientras queden retries: tratarlos como retry.
      updateTaskStatusFn(projectRoot, taskId, {
        status: 'pending',
        retry_count: currentTask.retry_count + 1,
      })
      continue
    }

    // ── Diagnose and apply strategy (design.md §2) ──────────────────────
    // AR.3: diagnoseTask hace una llamada LLM real (Haiku) — su costo cuenta
    // para el circuit breaker igual que cualquier otra llamada del grafo.
    let diag: { pattern: FailurePattern; suggestion: string; details: string }
    try {
      const full = await diagnoseFn(taskId, projectRoot)
      diag = { pattern: full.pattern, suggestion: full.suggestion, details: full.details }
      accCost += full.usdCost
      console.error(`  [diagnose] ${diag.pattern} (${full.confidence}) — ${diag.suggestion}`)
    } catch {
      diag = { pattern: 'unknown', suggestion: 'diagnosis unavailable', details: '' }
      console.error(`  [diagnose] unavailable`)
    }

    // rate_limit → one requeue with backoff (design.md §2)
    if (diag.pattern === 'rate_limit' && !requeuedForRateLimit.has(taskId)) {
      requeuedForRateLimit.add(taskId)
      updateTaskStatusFn(projectRoot, taskId, {
        status: 'pending',
        retry_count: 0,
        retry_reason: 'rate_limit — requeue once with backoff',
      })
      console.error(`  ⏳ rate_limit → requeue after ${RATE_LIMIT_REQUEUE_DELAY_MS}ms`)
      await sleep(RATE_LIMIT_REQUEUE_DELAY_MS)
      continue
    }

    // ── Block the branch ────────────────────────────────────────────────
    blockedAncestors.add(taskId)
    const descendants = findAllDescendants(taskId, loadTasksFn(projectRoot).tasks)
    for (const descId of descendants) {
      updateTaskStatusFn(projectRoot, descId, {
        status: 'blocked',
        retry_reason: `blocked by failed_permanent ancestor: ${taskId} — ${diag.suggestion}`,
      })
    }

    return {
      id: taskId, outcome: 'failed_permanent',
      error: harnessResult.retryReason,
      usd_cost: accCost,
      tokens: { input: accInput, output: accOutput },
      elapsed_ms: 0,
    }
  }

  // Safety net: should not reach here
  return {
    id: taskId, outcome: 'failed_permanent',
    error: 'exceeded max retry attempts in graph runner',
    usd_cost: accCost, tokens: { input: accInput, output: accOutput }, elapsed_ms: 0,
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Finds all tasks that transitively depend on the given taskId */
function findAllDescendants(taskId: string, tasks: Task[]): string[] {
  const visited = new Set<string>()
  function dfs(id: string) {
    for (const t of tasks) {
      if (t.depends_on.includes(id) && !visited.has(t.id)) {
        visited.add(t.id)
        dfs(t.id)
      }
    }
  }
  dfs(taskId)
  return [...visited]
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
