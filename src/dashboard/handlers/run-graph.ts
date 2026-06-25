/**
 * src/dashboard/handlers/run-graph.ts
 *
 * C1 — Dashboard surface for the graph runner (Mes 14, Bloque C).
 *   POST /api/run/graph        → launches runGraph() in the background, returns immediately
 *   GET  /api/run/graph/status → live progress (tasks.yaml) + final outcome once done
 *
 * The runner executes in-process (not via Bun.spawn like /api/tasks/:id/run) because
 * its result (GraphRunResult: cost, autonomy metric, per-task outcome) only exists as
 * an in-memory object returned by runGraph() — a subprocess would force us to either
 * parse stdout or serialize the result to a file. In-process + a module-level state
 * singleton is the simplest option that still satisfies "lanza el runner en background":
 * the POST handler doesn't await runGraph(), so the HTTP response returns immediately
 * while the promise keeps running against the shared Bun.serve event loop.
 *
 * Progress mid-run is read live from tasks.yaml (loadTaskRows) — graph-runner.ts calls
 * updateTaskStatus() synchronously per task as it executes, so polling tasks.yaml
 * already gives accurate per-task state without needing a separate progress channel.
 */
import { resolve, join } from 'path'
import { existsSync } from 'fs'
import { runGraph as realRunGraph } from '../../run/graph-runner.ts'
import type { GraphRunResult, GraphRunOpts } from '../../run/graph-runner.ts'
import { tasksExist } from '../../tasks/loader.ts'
import { loadContext } from '../../context/load.ts'
import { getProject } from '../../db/projects.ts'
import { loadOrcheConfig } from '../../config/load.ts'
import { jsonResponse, errorResponse } from '../http.ts'
import { loadTaskRows } from './tasks.ts'
import type { GraphRunStatusResponse } from '../types.ts'

type RunState =
  | { phase: 'idle' }
  | { phase: 'running'; startedAt: number }
  | { phase: 'done'; startedAt: number; finishedAt: number; result: GraphRunResult }
  | { phase: 'error'; startedAt: number; finishedAt: number; error: string }

let state: RunState = { phase: 'idle' }

// Test-only injection seam (mirrors GraphRunOpts.runTaskFn/diagnoseFn in graph-runner.ts):
// Bun's mock.module() on a shared module like run/graph-runner.ts would leak into every
// other test file that imports the real runGraph (graph-runner.test.ts, graph-summary.test.ts)
// for the rest of the `bun test` process. A plain mutable reference + test-only setter keeps
// the fake scoped to this handler's own call site.
let runGraphImpl: (opts: GraphRunOpts) => Promise<GraphRunResult> = realRunGraph

async function handleApiRunGraph(req: Request): Promise<Response> {
  if (state.phase === 'running') {
    return errorResponse('A graph run is already in progress', 409)
  }
  const root = resolve('.')
  if (!tasksExist(root)) {
    return errorResponse('tasks.yaml not found — run: orchestos task init', 404)
  }

  let body: { maxCost?: unknown; maxMinutes?: unknown } = {}
  try { body = await req.json() as { maxCost?: unknown; maxMinutes?: unknown } } catch { /* no body — defaults apply */ }
  const maxCost = typeof body.maxCost === 'number' ? body.maxCost : undefined
  const maxMinutes = typeof body.maxMinutes === 'number' ? body.maxMinutes : undefined

  const projectContext = loadContext(root)
  const project = getProject(root)
  const orcheConfigFound = existsSync(join(root, 'orchestos.config.yaml'))
  const orcheConfig = loadOrcheConfig(root)

  const startedAt = Date.now()
  state = { phase: 'running', startedAt }

  runGraphImpl({
    projectRoot: root,
    contextText: projectContext,
    projectId: project?.id,
    orcheConfig,
    orcheConfigFound,
    maxCost,
    maxMinutes,
  }).then(result => {
    state = { phase: 'done', startedAt, finishedAt: Date.now(), result }
  }).catch(e => {
    state = { phase: 'error', startedAt, finishedAt: Date.now(), error: e instanceof Error ? e.message : String(e) }
  })

  return jsonResponse({ ok: true })
}

function handleApiRunGraphStatus(): Response {
  const tasks = loadTaskRows(resolve('.'))
  const body: GraphRunStatusResponse =
    state.phase === 'idle'
      ? { phase: 'idle', tasks }
      : state.phase === 'running'
      ? { phase: 'running', tasks, startedAt: state.startedAt }
      : state.phase === 'done'
      ? { phase: 'done', tasks, startedAt: state.startedAt, finishedAt: state.finishedAt, result: state.result }
      : { phase: 'error', tasks, startedAt: state.startedAt, finishedAt: state.finishedAt, error: state.error }
  return jsonResponse(body)
}

/** Test-only: reset the module-level singleton between test files. */
function resetRunGraphState(): void {
  state = { phase: 'idle' }
}

/** Test-only: swap runGraph for a stub without touching the shared module graph. */
function __setRunGraphForTests(fn: (opts: GraphRunOpts) => Promise<GraphRunResult>): void {
  runGraphImpl = fn
}

/** Test-only: restore the real runGraph implementation. */
function __resetRunGraphForTests(): void {
  runGraphImpl = realRunGraph
}

export { handleApiRunGraph, handleApiRunGraphStatus, resetRunGraphState, __setRunGraphForTests, __resetRunGraphForTests }
