/**
 * Mes 14 / C1 — POST /api/run/graph + GET /api/run/graph/status
 *
 * Uses a real temp project dir (chdir) + the handler's __setRunGraphForTests /
 * __setDepsForTests seams instead of mock.module() on tasks/loader.ts, context/load.ts,
 * db/projects.ts or config/load.ts. mock.module() replaces a module for the whole
 * `bun test` process, not just this file — tasks/loader.ts in particular is imported
 * for real by graph-runner.test.ts and graph-summary.test.ts (confirmed: mocking it here
 * broke those suites' real-runGraph assertions when run together with this one).
 * tasksExist/loadTaskRows use the real tasks/loader.ts against the real tmp tasks.yaml
 * written below — no mock needed there. loadContext/getProject/loadOrcheConfig are
 * overridden via __setDepsForTests to avoid depending on the developer's real
 * ~/.orchestos/db.sqlite or ~/.orchestos/config.yaml.
 */
import { describe, it, expect, beforeEach, afterAll } from 'bun:test'
import { mkdtempSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { stringify as yamlStringify } from 'yaml'
import type { GraphRunResult, GraphRunOpts } from '../../run/graph-runner.ts'

const { route } = await import('../server.ts')
const {
  resetRunGraphState, __setRunGraphForTests, __resetRunGraphForTests,
  __setDepsForTests, __resetDepsForTests,
} = await import('../handlers/run-graph.ts')

const PORT = 4242
const originalCwd = process.cwd()
const tmpDir = mkdtempSync(join(tmpdir(), 'run-graph-api-'))
process.chdir(tmpDir)

const TASK_T1 = {
  id: 't1', description: 'do thing', executor: 'openrouter' as const,
  input: [], output: ['out/x.txt'], depends_on: [], status: 'pending' as const, retry_count: 0,
}

function writeTasksYaml(tasks: Record<string, unknown>[]): void {
  writeFileSync(
    join(tmpDir, 'tasks.yaml'),
    yamlStringify({ version: 1, project: 'mock', tasks }, { lineWidth: 120 }),
    'utf-8',
  )
}

afterAll(() => {
  __resetRunGraphForTests()
  __resetDepsForTests()
  process.chdir(originalCwd)
  rmSync(tmpDir, { recursive: true, force: true })
})

function req(method: string, path: string, body?: unknown): Request {
  return new Request(`http://localhost:${PORT}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}

function makeResult(): GraphRunResult {
  return {
    tasks: [{ id: 't1', outcome: 'completed', usd_cost: 0.001, tokens: { input: 10, output: 20 }, elapsed_ms: 100 }],
    aggregated_cost: 0.001,
    aggregated_tokens: { input: 10, output: 20 },
    aggregated_ms: 100,
    autonomy_metric: 1,
  }
}

function deferred<T>(): { promise: Promise<T>; resolve: (v: T) => void; reject: (e: unknown) => void } {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

let runGraphImpl: (opts: GraphRunOpts) => Promise<GraphRunResult> = async () => makeResult()
let lastCallOpts: GraphRunOpts | undefined

beforeEach(() => {
  resetRunGraphState()
  writeTasksYaml([TASK_T1])
  runGraphImpl = async () => makeResult()
  lastCallOpts = undefined
  __setRunGraphForTests(opts => { lastCallOpts = opts; return runGraphImpl(opts) })
  __setDepsForTests({
    loadContext: () => '',
    getProject: () => ({ id: 'p1' }) as any,
    loadOrcheConfig: () => undefined as any,
  })
})

describe('POST /api/run/graph', () => {
  it('404 when tasks.yaml is missing', async () => {
    rmSync(join(tmpDir, 'tasks.yaml'))
    const res = await route(req('POST', '/api/run/graph'), PORT)
    expect(res.status).toBe(404)
  })

  it('launches in the background and returns immediately (ok:true) without awaiting completion', async () => {
    const d = deferred<GraphRunResult>()
    runGraphImpl = () => d.promise
    const res = await route(req('POST', '/api/run/graph'), PORT)
    const body = await res.json() as { ok: boolean }
    expect(res.status).toBe(200)
    expect(body.ok).toBe(true)

    // Status must already reflect 'running' even though runGraph() hasn't resolved.
    const statusRes = await route(req('GET', '/api/run/graph/status'), PORT)
    const status = await statusRes.json() as { phase: string }
    expect(status.phase).toBe('running')

    d.resolve(makeResult())
  })

  it('409 when a run is already in progress', async () => {
    const d = deferred<GraphRunResult>()
    runGraphImpl = () => d.promise
    await route(req('POST', '/api/run/graph'), PORT)

    const res2 = await route(req('POST', '/api/run/graph'), PORT)
    expect(res2.status).toBe(409)

    d.resolve(makeResult())
  })

  it('passes maxCost/maxMinutes from the request body through to runGraph', async () => {
    await route(req('POST', '/api/run/graph', { maxCost: 2.5, maxMinutes: 30 }), PORT)
    expect(lastCallOpts?.maxCost).toBe(2.5)
    expect(lastCallOpts?.maxMinutes).toBe(30)
  })
})

describe('GET /api/run/graph/status', () => {
  it('phase=idle with live task rows when nothing has run yet', async () => {
    const res = await route(req('GET', '/api/run/graph/status'), PORT)
    const body = await res.json() as { phase: string; tasks: unknown[] }
    expect(body.phase).toBe('idle')
    expect(body.tasks).toHaveLength(1)
  })

  it('phase=done with the GraphRunResult once the background run resolves', async () => {
    const d = deferred<GraphRunResult>()
    runGraphImpl = () => d.promise
    await route(req('POST', '/api/run/graph'), PORT)
    d.resolve(makeResult())
    // Let the unawaited .then() in the handler flush.
    await new Promise(r => setTimeout(r, 0))

    const res = await route(req('GET', '/api/run/graph/status'), PORT)
    const body = await res.json() as { phase: string; result: GraphRunResult }
    expect(body.phase).toBe('done')
    expect(body.result.autonomy_metric).toBe(1)
  })

  it('phase=error when the background run throws', async () => {
    const d = deferred<GraphRunResult>()
    runGraphImpl = () => d.promise
    await route(req('POST', '/api/run/graph'), PORT)
    d.reject(new Error('boom'))
    await new Promise(r => setTimeout(r, 0))

    const res = await route(req('GET', '/api/run/graph/status'), PORT)
    const body = await res.json() as { phase: string; error: string }
    expect(body.phase).toBe('error')
    expect(body.error).toBe('boom')
  })
})
