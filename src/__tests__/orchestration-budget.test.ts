import { Database } from 'bun:sqlite'
import { afterEach, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadOrcheConfig } from '../config/load.ts'
import { KNOWN_CLIS } from '../run/executors/cli-registry.ts'
import { buildCodexArgs } from '../run/executors/codex.ts'
import { buildClaudeArgs, buildClaudeArgsDisplay } from '../run/executors/external.ts'
import {
  finishBudget,
  openBudget,
  readBudget,
  releaseChild,
  reserveChild,
} from '../run/orchestration-budget.ts'
import { executePlan } from '../run/scheduler.ts'

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'orch-orchestration-'))
  roots.push(root)
  const database = new Database(join(root, 'budget.sqlite'))
  database.exec(`CREATE TABLE orchestration_runs (
    run_id TEXT PRIMARY KEY, project_id TEXT, parent_task_id TEXT NOT NULL,
    max_concurrent INTEGER NOT NULL, max_total INTEGER NOT NULL, enabled INTEGER NOT NULL DEFAULT 0,
    total INTEGER NOT NULL DEFAULT 0, finished_at TEXT,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`)
  database.exec(
    'CREATE TABLE orchestration_leases (run_id TEXT, child_id TEXT, pid INTEGER, created_at TEXT, PRIMARY KEY(run_id,child_id))',
  )
  return { root, database }
}

test('budget rejects when disabled, enforces max total and resumes persisted counters', () => {
  const { root, database } = fixture()
  const off = openBudget(
    { projectRoot: root, parentTaskId: 'off', planContent: 'off plan' },
    database,
  )
  expect(off.enabled).toBe(false)
  expect(reserveChild(off.runId, 'off-child', database).ok).toBe(false)
  const budget = openBudget(
    {
      projectRoot: root,
      parentTaskId: 'parent',
      planContent: 'plan A',
      config: { enabled: true, maxConcurrent: 1, maxTotal: 2 },
    },
    database,
  )
  expect(reserveChild(budget.runId, 'c1', database).ok).toBe(true)
  expect(reserveChild(budget.runId, 'c2', database).ok).toBe(false)
  releaseChild(budget.runId, 'c1', database)
  expect(reserveChild(budget.runId, 'c2', database).ok).toBe(true)
  releaseChild(budget.runId, 'c2', database)
  expect(reserveChild(budget.runId, 'c3', database)).toEqual({
    ok: false,
    reason: 'límite de orquestación: 2/2',
  })
  openBudget(
    {
      projectRoot: root,
      parentTaskId: 'parent',
      planContent: 'plan A',
      config: { enabled: true, maxConcurrent: 1, maxTotal: 2 },
    },
    database,
  )
  expect(readBudget(budget.runId, database)).toEqual({ active: 0, total: 2 })
  finishBudget(budget.runId, database)
  const next = openBudget(
    {
      projectRoot: root,
      parentTaskId: 'parent',
      planContent: 'plan A',
      config: { enabled: true, maxConcurrent: 1, maxTotal: 2 },
    },
    database,
  )
  expect(readBudget(next.runId, database)).toEqual({ active: 0, total: 0 })
  const changed = openBudget(
    {
      projectRoot: root,
      parentTaskId: 'parent',
      planContent: 'plan B',
      config: { enabled: true, maxConcurrent: 1, maxTotal: 2 },
    },
    database,
  )
  expect(changed.runId).not.toBe(next.runId)
})

test('executePlan con configuración ausente se salta antes de ejecutar hijos', async () => {
  const { root, database } = fixture()
  const budget = openBudget(
    { projectRoot: root, parentTaskId: 'disabled', planContent: 'disabled' },
    database,
  )
  let calls = 0
  const task = {
    id: 'child',
    description: 'child',
    acceptance: [],
    depends_on: [],
    allowed_tools: [],
    status: 'pending' as const,
    retry_count: 0,
  }
  const result = await executePlan(
    [task],
    {
      parentTaskId: 'disabled',
      projectRoot: root,
      baseBranch: 'main',
      orchestrationBudget: budget,
    },
    async () => {
      calls += 1
      throw new Error('no debe invocarse')
    },
  )
  expect(calls).toBe(0)
  expect(result.sub_tasks[0]?.error).toBe('Orquestación desactivada en este proyecto')
  expect(readBudget(budget.runId, database)).toEqual({ active: 0, total: 0 })
})

test('several real processes cannot reserve beyond maxTotal', async () => {
  const root = mkdtempSync(join(tmpdir(), 'orch-orchestration-processes-'))
  roots.push(root)
  mkdirSync(join(root, '.orchestos'), { recursive: true })
  const database = new Database(join(root, '.orchestos', 'db.sqlite'))
  database.exec(`CREATE TABLE orchestration_runs (
    run_id TEXT PRIMARY KEY, project_id TEXT, parent_task_id TEXT NOT NULL,
    max_concurrent INTEGER NOT NULL, max_total INTEGER NOT NULL, enabled INTEGER NOT NULL DEFAULT 0,
    total INTEGER NOT NULL DEFAULT 0, finished_at TEXT,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`)
  database.exec(
    'CREATE TABLE orchestration_leases (run_id TEXT, child_id TEXT, pid INTEGER, created_at TEXT, PRIMARY KEY(run_id,child_id))',
  )
  const budget = openBudget(
    {
      projectRoot: root,
      parentTaskId: 'parallel',
      planContent: 'parallel',
      config: { enabled: true, maxConcurrent: 8, maxTotal: 2 },
    },
    database,
  )
  database.close()
  const budgetModule = new URL('../run/orchestration-budget.ts', import.meta.url).href
  const source = `import { reserveChild } from ${JSON.stringify(budgetModule)}; const result=reserveChild(${JSON.stringify(budget.runId)},String(process.pid)); process.exit(result.ok?0:3);`
  const env = { PATH: process.env.PATH ?? '', HOME: root, TMPDIR: root, ORCHESTOS_HOME: root }
  const children = Array.from({ length: 5 }, () =>
    Bun.spawn([process.execPath, '-e', source], { env, stdout: 'pipe', stderr: 'pipe' }),
  )
  const exits = await Promise.all(children.map((child) => child.exited))
  expect(exits.filter((code) => code === 0)).toHaveLength(2)
  const verify = new Database(join(root, '.orchestos', 'db.sqlite'), { readonly: true })
  expect(
    verify.query('SELECT total FROM orchestration_runs WHERE run_id=?').get(budget.runId),
  ).toEqual({ total: 2 })
  verify.close()
})

test('un lease de un proceso muerto se limpia antes de reanudar', async () => {
  const root = mkdtempSync(join(tmpdir(), 'orch-orchestration-dead-lease-'))
  roots.push(root)
  mkdirSync(join(root, '.orchestos'), { recursive: true })
  const database = new Database(join(root, '.orchestos', 'db.sqlite'))
  database.exec(`CREATE TABLE orchestration_runs (
    run_id TEXT PRIMARY KEY, project_id TEXT, parent_task_id TEXT NOT NULL,
    max_concurrent INTEGER NOT NULL, max_total INTEGER NOT NULL, enabled INTEGER NOT NULL DEFAULT 0,
    total INTEGER NOT NULL DEFAULT 0, finished_at TEXT,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`)
  database.exec(
    'CREATE TABLE orchestration_leases (run_id TEXT, child_id TEXT, pid INTEGER, created_at TEXT, PRIMARY KEY(run_id,child_id))',
  )
  const budget = openBudget(
    {
      projectRoot: root,
      parentTaskId: 'crash',
      planContent: 'plan',
      config: { enabled: true, maxConcurrent: 1, maxTotal: 3 },
    },
    database,
  )
  database.close()
  const moduleUrl = new URL('../run/orchestration-budget.ts', import.meta.url).href
  const source = `import { reserveChild } from ${JSON.stringify(moduleUrl)}; reserveChild(${JSON.stringify(budget.runId)},'crashed'); console.log('lease-ready'); setInterval(()=>{},1000)`
  const child = Bun.spawn([process.execPath, '-e', source], {
    env: { PATH: process.env.PATH ?? '', HOME: root, TMPDIR: root, ORCHESTOS_HOME: root },
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const reader = child.stdout.getReader()
  await reader.read()
  child.kill('SIGKILL')
  await child.exited
  const resumed = new Database(join(root, '.orchestos', 'db.sqlite'))
  expect(reserveChild(budget.runId, 'replacement', resumed).ok).toBe(true)
  expect(readBudget(budget.runId, resumed)).toEqual({ active: 1, total: 2 })
  resumed.close()
})

test('ON sin límites se rechaza y OFF no añade capacidades no verificadas', () => {
  const { root } = fixture()
  writeFileSync(join(root, 'orchestos.config.yaml'), 'orchestration:\n  enabled: true\n')
  expect(() => loadOrcheConfig(root)).toThrow(/maxConcurrent/)
  expect(buildClaudeArgs('prompt', undefined, undefined, true)).toContain('--disallowedTools')
  expect(buildClaudeArgsDisplay(undefined, undefined, true)).toContain('Agent')
  expect(buildCodexArgs('prompt')).not.toContain('multi_agent')
  expect(KNOWN_CLIS.find((cli) => cli.id === 'claude')?.subagentBlock).toEqual({
    args: ['--disallowedTools', 'Agent'],
  })
  expect(KNOWN_CLIS.find((cli) => cli.id === 'codex')?.subagentBlock).toBe('not-guaranteed')
  expect(KNOWN_CLIS.find((cli) => cli.id === 'opencode')?.subagentBlock).toBe('not-guaranteed')
})
