import { afterEach, describe, expect, it } from 'bun:test'
import type { OrcheConfig } from '../config/schema.ts'
import { autoRoute } from '../router/auto-route.ts'
import { taskFieldsFromRule } from '../router/engine-cascade.ts'
import { singleShotEngine } from '../run/executors/single-shot.ts'
import {
  cliForTaskEngine,
  cliTaskEngineIds,
  registerTaskEngine,
  requireTaskEngineForAgent,
  taskEngineById,
  taskEngineForCli,
  unregisterTaskEngine,
  validTaskEngineIds,
} from '../run/executors/task-engines.ts'
import { type Task, validateTask } from '../tasks/schema.ts'

const fakeEntry = {
  cliId: 'gemini',
  engineId: 'gemini',
  engine: singleShotEngine,
  findBinary: () => '/usr/bin/gemini',
  unavailableMessage: (hint?: string) => `gemini missing ${hint ?? ''}`,
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't',
    description: 'Add a feature',
    status: 'pending',
    executor: 'openrouter',
    input: [],
    output: [],
    depends_on: [],
    retry_count: 0,
    ...overrides,
  }
}

const cfg = (agent: string): OrcheConfig =>
  ({
    config_version: 1,
    roles: { executor: { agent, model: 'm', effort: 'medium' } },
    models: {},
  }) as unknown as OrcheConfig

afterEach(() => unregisterTaskEngine('gemini'))

describe('task engine registry', () => {
  it('resolves built-ins in both directions', () => {
    expect(taskEngineForCli('claude')?.engineId).toBe('external')
    expect(taskEngineForCli('codex')?.engineId).toBe('codex')
    expect(taskEngineForCli('opencode')?.engineId).toBe('opencode')
    expect(cliForTaskEngine('external')).toBe('claude')
    expect(cliForTaskEngine('codex')).toBe('codex')
    expect(taskEngineById('opencode')?.cliId).toBe('opencode')
    expect(cliTaskEngineIds()).toEqual(['external', 'opencode', 'codex'])
    expect(cliForTaskEngine('single-shot')).toBeUndefined()
  })

  it('a registered CLI is used by autoRoute, engine choice and validation', () => {
    registerTaskEngine(fakeEntry)
    expect(autoRoute(makeTask({ engine: 'gemini' }), cfg('gemini'))).toMatchObject({
      agent: 'gemini',
      provider: 'gemini',
    })
    expect(requireTaskEngineForAgent('gemini')?.engine).toBe(singleShotEngine)
    expect(validTaskEngineIds()).toContain('gemini')
    expect(validateTask({ ...makeTask(), output: ['a'], engine: 'gemini' }, 0).engine).toBe(
      'gemini',
    )
    expect(
      taskFieldsFromRule(
        { agent: 'gemini', model: 'g', match: { skill: 's' } } as never,
        cfg('gemini'),
      ),
    ).toMatchObject({ engine: 'gemini' })
  })

  it('a known CLI without task executor fails visibly instead of single-shot', () => {
    expect(() => requireTaskEngineForAgent('gemini')).toThrow(
      'no tiene ejecutor de tareas en OrchestOS; asigna otro CLI al rol Ejecutor',
    )
    expect(() => validateTask({ ...makeTask(), output: ['a'], engine: 'gemini' }, 0)).toThrow(
      'unknown engine',
    )
    expect(requireTaskEngineForAgent('api')).toBeUndefined()
    expect(requireTaskEngineForAgent('local')).toBeUndefined()
  })

  it('rejects duplicates and unknown CLIs', () => {
    expect(() => registerTaskEngine({ ...fakeEntry, cliId: 'claude', engineId: 'x' })).toThrow()
    expect(() => registerTaskEngine({ ...fakeEntry, engineId: 'codex' })).toThrow()
    expect(() => registerTaskEngine({ ...fakeEntry, cliId: 'nope', engineId: 'nope' })).toThrow(
      'Unknown CLI',
    )
  })
})
