import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { topoSort, validateSubTaskPlan, type SubTaskPlan } from '../../src/agents/sub-task-schema.ts'
import { createSubTask } from '../../src/agents/sub-agent.ts'
import { createPlan } from '../../src/agents/planner.ts'
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validPlan(overrides?: Partial<SubTaskPlan>): SubTaskPlan {
  return {
    version: 1,
    parent_task_id: 'test-plan',
    sub_tasks: [
      { id: 'step-a', description: 'Step A', acceptance: ['A works'], depends_on: [], allowed_tools: ['read', 'write', 'edit'], output: ['a.txt'] },
      { id: 'step-b', description: 'Step B', acceptance: ['B works'], depends_on: ['step-a'], allowed_tools: ['read', 'write', 'edit'], output: ['b.txt'] },
      { id: 'step-c', description: 'Step C', acceptance: ['C works'], depends_on: ['step-b'], allowed_tools: ['read', 'write', 'edit'], output: ['c.txt'] },
    ],
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// S22.7 (a) — 3 sub-tasks linear, one fails → cascade
// ---------------------------------------------------------------------------

describe('S22.7 (a) — cascade on linear failure', () => {
  it('marks dependents as skipped when a predecessor fails', async () => {
    // Use a real git repo so createWorktree works
    const { mkdtempSync, writeFileSync, rmSync } = await import('fs')
    const { tmpdir } = await import('os')
    const { join } = await import('path')
    const { git } = await import('../../src/run/sandbox.ts')

    const root = mkdtempSync(join(tmpdir(), 'orchestos-sched-test-'))
    git(['init', '-b', 'main'], root)
    git(['config', 'user.email', 'test@test.com'], root)
    git(['config', 'user.name', 'Test'], root)
    writeFileSync(join(root, 'README.md'), 'init')
    git(['add', '-A'], root)
    git(['commit', '-m', 'init'], root)

    const { executePlan } = await import('../../src/run/scheduler.ts')

    const plan = validPlan()
    const planResult = validateSubTaskPlan(plan)
    const sorted = topoSort(planResult.sub_tasks)
    const subTasks = sorted.map(def => createSubTask(def))

    const result = await executePlan(subTasks, {
      parentTaskId: 'test-plan',
      projectRoot: root,
      baseBranch: 'main',
    }, async (st, _wt) => {
      // step-b fails
      if (st.id === 'step-b') {
        return {
          sub_task_id: st.id,
          status: 'failed' as const,
          error: 'intentional failure',
          usd_cost: 0.01,
          tokens: { input: 100, output: 50 },
          elapsed_ms: 100,
          files_written: [],
          qa_verdict: 'fail',
        }
      }
      // others succeed
      return {
        sub_task_id: st.id,
        status: 'completed' as const,
        result: 'ok',
        usd_cost: 0.01,
        tokens: { input: 100, output: 50 },
        elapsed_ms: 100,
        files_written: [`${st.id}.txt`],
        qa_verdict: 'pass',
      }
    })

    // step-a passes
    const a = result.sub_tasks.find(l => l.id === 'step-a')
    expect(a?.status).toBe('completed')

    // step-b fails
    const b = result.sub_tasks.find(l => l.id === 'step-b')
    expect(b?.status).toBe('failed')
    expect(b?.error).toBe('intentional failure')

    // step-c is skipped due to cascade
    const c = result.sub_tasks.find(l => l.id === 'step-c')
    expect(c?.status).toBe('skipped')
    expect(c?.error).toContain('dependency failed')

    // all_passed is false
    expect(result.all_passed).toBe(false)

    rmSync(root, { recursive: true, force: true })
  })
})

// ---------------------------------------------------------------------------
// S22.7 (b) — non-linear DAG (A → B, A → C) → topological order
// ---------------------------------------------------------------------------

describe('S22.7 (b) — non-linear DAG topological order', () => {
  it('sorts A → B and A → C correctly', () => {
    const plan: SubTaskPlan = {
      version: 1,
      parent_task_id: 'test-dag',
      sub_tasks: [
        { id: 'step-c', description: 'C', acceptance: ['C works'], depends_on: ['step-a'], allowed_tools: ['read'], output: ['c.txt'] },
        { id: 'step-a', description: 'A', acceptance: ['A works'], depends_on: [], allowed_tools: ['read'], output: ['a.txt'] },
        { id: 'step-b', description: 'B', acceptance: ['B works'], depends_on: ['step-a'], allowed_tools: ['read'], output: ['b.txt'] },
      ],
    }

    const result = validateSubTaskPlan(plan)
    const sorted = topoSort(result.sub_tasks)

    // A must be first
    expect(sorted[0]?.id).toBe('step-a')

    // B and C come after A, order between them is undefined but both valid
    const aIdx = sorted.findIndex(s => s.id === 'step-a')
    const bIdx = sorted.findIndex(s => s.id === 'step-b')
    const cIdx = sorted.findIndex(s => s.id === 'step-c')
    expect(aIdx).toBeLessThan(bIdx)
    expect(aIdx).toBeLessThan(cIdx)
  })

  it('rejects cycles', () => {
    const plan = {
      version: 1,
      parent_task_id: 'test-cycle',
      sub_tasks: [
        { id: 'a', description: 'A', acceptance: ['A'], depends_on: ['b'], allowed_tools: ['read'], output: ['a.txt'] },
        { id: 'b', description: 'B', acceptance: ['B'], depends_on: ['a'], allowed_tools: ['read'], output: ['b.txt'] },
      ],
    }
    expect(() => validateSubTaskPlan(plan)).toThrow('cycle')
  })
})

// ---------------------------------------------------------------------------
// S22.7 (c) — re-ejecución con topic_key → merge funcional
// ---------------------------------------------------------------------------

describe('S22.7 (c) — topic_key merge on re-execution', () => {
  // Run migrations so the memory_entries table exists
  beforeAll(() => {
    const { runMigrations } = require('../../src/db/migrate.ts')
    runMigrations()
  })

  // I.6 (Mes 18) — este describe dejaba 4 filas de fixture ('test-project'/
  // auth-schema, 'p1'/topic-a,b,c) permanentes en memory_entries, la misma
  // fuga que en src/__tests__/memory-conflicts.test.ts: sin afterAll, esas
  // filas quedaban en la DB real y aparecían como memory cards sin contenido
  // útil en el dashboard de Carlos (IDEAS.md #20).
  afterAll(() => {
    const { db } = require('../../src/db/sqlite.ts')
    db.run("DELETE FROM memory_entries WHERE project_id IN ('test-project', 'p1')")
  })

  it('upsertMemory replaces existing entry with same topic_key', async () => {
    const { upsertMemory, getMemory } = await import('../../src/db/memory.ts')

    const { id: id1 } = upsertMemory('test-project', 'auth-schema', 'version 1 content')
    expect(id1).toBeTruthy()

    const entry1 = getMemory('test-project', 'auth-schema')
    expect(entry1?.content).toBe('version 1 content')

    // re-execution with same topic_key → upsert replaces content
    const { id: id2 } = upsertMemory('test-project', 'auth-schema', 'version 2 content')
    expect(id2).toBe(id1) // same id since UNIQUE(project_id, topic_key)

    const entry2 = getMemory('test-project', 'auth-schema')
    expect(entry2?.content).toBe('version 2 content')
  })

  it('listByScope returns entries for the given scope', async () => {
    const { upsertMemory, listByScope } = await import('../../src/db/memory.ts')

    upsertMemory('p1', 'topic-a', 'scope session', 'session')
    upsertMemory('p1', 'topic-b', 'scope project', 'project')
    upsertMemory('p1', 'topic-c', 'scope global', 'global')

    const session = listByScope('p1', 'session')
    expect(session.length).toBeGreaterThanOrEqual(1)
    expect(session.find(e => e.topic_key === 'topic-a')).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// S22.7 (d) — allowed_tools validation
// ---------------------------------------------------------------------------

describe('S22.7 (d) — allowed_tools enforcement', () => {
  it('rejects sub-task with invalid allowed_tools entry', () => {
    const plan = {
      version: 1,
      parent_task_id: 'test-tools',
      sub_tasks: [
        { id: 'bad-tools', description: 'bad', acceptance: ['x'], depends_on: [], allowed_tools: ['read', 'invalid-tool'], output: ['x.txt'] },
      ],
    }
    expect(() => validateSubTaskPlan(plan)).toThrow('invalid tool')
  })

  it('accepts sub-task with empty allowed_tools', () => {
    const plan = {
      version: 1,
      parent_task_id: 'test-tools',
      sub_tasks: [
        { id: 'no-tools', description: 'no tools', acceptance: ['x'], depends_on: [], allowed_tools: [], output: ['x.txt'] },
      ],
    }
    // Should validate successfully
    expect(() => validateSubTaskPlan(plan)).not.toThrow()
  })

  it('createPlan parses valid YAML plan', () => {
    const yaml = `
version: 1
parent_task_id: test-yaml
sub_tasks:
  - id: parse-test
    description: parse test
    acceptance:
      - works
    depends_on: []
    allowed_tools: [read, write, edit]
    output:
      - out.txt
`
    const tasks = createPlan(yaml)
    expect(tasks.length).toBe(1)
    expect(tasks[0]?.id).toBe('parse-test')
    expect(tasks[0]?.allowed_tools).toEqual(['read', 'write', 'edit'])
  })
})
