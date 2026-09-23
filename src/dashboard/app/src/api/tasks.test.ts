import { describe, expect, test } from 'bun:test'
import { getRunnableTask, listTasks, runTask } from './tasks'

describe('tasks API mapping', () => {
  test('maps the real task wrapper to the Settings task contract', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          exists: true,
          tasks: [
            {
              id: 'build-app',
              description: 'Build the app',
              status: 'pending',
              retryReason: null,
              skill: null,
              executor: 'codex',
              retryCount: 1,
              qaVerdict: null,
              runId: 'run-1',
              engine: 'codex',
              output: ['dist/app.js'],
              dependsOn: [],
              acceptanceCriteria: ['build passes'],
              executorModel: 'gpt-5.6-luna',
              hasSplitPlan: false,
            },
          ],
        }),
        { status: 200 },
      )) as unknown as typeof fetch
    try {
      await expect(listTasks('project-1')).resolves.toMatchObject({
        exists: true,
        tasks: [
          {
            id: 'build-app',
            output: ['dist/app.js'],
            outputSlice: ['dist/app.js'],
            assignedAgent: 'codex · gpt-5.6-luna',
            depends_on: [],
            acceptance_criteria: ['build passes'],
            retryCount: 1,
            runId: 'run-1',
            engine: 'codex',
          },
        ],
      })
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  test('only returns the first pending task whose dependencies are done', () => {
    const tasks = [
      {
        id: 'blocked',
        description: 'blocked',
        status: 'pending' as const,
        output: [],
        depends_on: ['first'],
        acceptance_criteria: [],
        retryCount: 0,
        engine: 'single-shot' as const,
      },
      {
        id: 'first',
        description: 'first',
        status: 'done' as const,
        output: [],
        depends_on: [],
        acceptance_criteria: [],
        retryCount: 0,
        engine: 'single-shot' as const,
      },
      {
        id: 'ready',
        description: 'ready',
        status: 'pending' as const,
        output: [],
        depends_on: [],
        acceptance_criteria: [],
        retryCount: 0,
        engine: 'single-shot' as const,
      },
    ]
    expect(getRunnableTask(tasks)?.id).toBe('blocked')
  })

  test('surfaces a retry scheduled while the task remains pending', async () => {
    const originalFetch = globalThis.fetch
    const originalSetTimeout = globalThis.setTimeout
    const calls: string[] = []
    globalThis.setTimeout = ((handler: TimerHandler) => {
      if (typeof handler === 'function') handler()
      return 0 as unknown as ReturnType<typeof setTimeout>
    }) as unknown as typeof setTimeout
    globalThis.fetch = (async (input) => {
      const path = String(input)
      calls.push(path)
      if (path.endsWith('/run')) return new Response(JSON.stringify({ ok: true }), { status: 200 })
      const retryScheduled = calls.filter((item) => item.endsWith('/api/tasks')).length > 1
      return new Response(
        JSON.stringify({
          exists: true,
          tasks: [
            {
              id: 'task-1',
              description: 'x',
              status: 'pending',
              retryReason: retryScheduled ? 'missing declared output(s): README.md' : null,
              skill: null,
              executor: 'codex',
              retryCount: retryScheduled ? 1 : 0,
              qaVerdict: retryScheduled ? 'fail' : null,
              runId: retryScheduled ? 'run-2' : null,
              engine: 'codex',
              output: ['README.md'],
              dependsOn: [],
              acceptanceCriteria: [],
              executorModel: 'gpt-5.6-luna',
              hasSplitPlan: false,
            },
          ],
        }),
        { status: 200 },
      )
    }) as typeof fetch
    try {
      await expect(runTask('task-1', 'project-1', () => undefined)).rejects.toThrow(
        'Retry scheduled: missing declared output(s): README.md',
      )
    } finally {
      globalThis.fetch = originalFetch
      globalThis.setTimeout = originalSetTimeout
    }
  })
})
