import { describe, it, expect } from 'bun:test'
import { classifyTask, type TaskClass } from '../router/classify.ts'
import { autoRoute } from '../router/auto-route.ts'
import type { OrcheConfig } from '../config/schema.ts'
import type { Task } from '../tasks/schema.ts'

// ── classifyTask ──────────────────────────────────────────────────────────────
describe('classifyTask', () => {
  const cases: [string, TaskClass][] = [
    // plan
    ['Design the architecture for the auth module', 'plan'],
    ['Scaffold a new payment service', 'plan'],
    ['Diseña la estructura del proyecto', 'plan'],
    // fix
    ['Fix the login bug that crashes on empty email', 'fix'],
    ['Corrige el error en el parsing de fechas', 'fix'],
    ['The test fails — find the broken line', 'fix'],
    // doc
    ['Document the authentication flow', 'doc'],
    ['Write a README for the billing module', 'doc'],
    ['Explica cómo funciona el router', 'doc'],
    // review
    ['Review the pull request for security issues', 'review'],
    ['Audit the database queries', 'review'],
    ['Revisa el código del servicio de pagos', 'review'],
    // implement (default)
    ['Add a button to the header', 'implement'],
    ['Create a new endpoint for user registration', 'implement'],
    ['Agrega validación al formulario de contacto', 'implement'],
  ]

  for (const [prompt, expected] of cases) {
    it(`classifies "${prompt.slice(0, 40)}…" as ${expected}`, () => {
      expect(classifyTask(prompt)).toBe(expected)
    })
  }

  it('returns implement for empty string', () => {
    expect(classifyTask('')).toBe('implement')
  })

  it('is case-insensitive', () => {
    expect(classifyTask('FIX THE BUG')).toBe('fix')
    expect(classifyTask('PLAN THE ARCHITECTURE')).toBe('plan')
  })
})

// ── autoRoute ─────────────────────────────────────────────────────────────────
const baseConfig: OrcheConfig = {
  config_version: 1,
  models: {
    planner:        { provider: 'anthropic', model: 'claude-opus-4-7' },
    executor_heavy: { provider: 'openrouter', model: 'deepseek/deepseek-r1' },
    executor_light: { provider: 'openrouter', model: 'deepseek/deepseek-v4-flash' },
    default:        { provider: 'openrouter', model: 'deepseek/deepseek-v4-flash' },
  },
}

function makeTask(description: string, overrides: Partial<Task> = {}): Task {
  return {
    id: 'test-task',
    description,
    status: 'pending',
    executor: 'openrouter',
    input: [],
    output: [],
    depends_on: [],
    retry_count: 0,
    ...overrides,
  }
}

describe('autoRoute', () => {
  it('returns null when no config file and no per-task override', () => {
    const task = makeTask('Add a button')
    expect(autoRoute(task, baseConfig, false)).toBeNull()
  })

  it('routes plan tasks to planner model', () => {
    const task = makeTask('Design the architecture for billing')
    const result = autoRoute(task, baseConfig, true)
    expect(result?.role).toBe('planner')
    expect(result?.model).toBe('claude-opus-4-7')
  })

  it('routes fix tasks to executor_heavy', () => {
    const task = makeTask('Fix the login crash bug')
    const result = autoRoute(task, baseConfig, true)
    expect(result?.role).toBe('executor_heavy')
  })

  it('routes implement tasks to executor_heavy', () => {
    const task = makeTask('Add user registration endpoint')
    const result = autoRoute(task, baseConfig, true)
    expect(result?.role).toBe('executor_heavy')
  })

  it('routes doc tasks to executor_light', () => {
    const task = makeTask('Document the authentication flow')
    const result = autoRoute(task, baseConfig, true)
    expect(result?.role).toBe('executor_light')
  })

  it('routes review tasks to executor_light', () => {
    const task = makeTask('Review the security of the auth module')
    const result = autoRoute(task, baseConfig, true)
    expect(result?.role).toBe('executor_light')
  })

  it('per-task executor_model overrides config model', () => {
    const task = makeTask('Fix the bug', { executor_model: 'claude-sonnet-4-6' })
    const result = autoRoute(task, baseConfig, true)
    expect(result?.model).toBe('claude-sonnet-4-6')
  })

  it('per-task executor_model works even without config file', () => {
    const task = makeTask('Add feature', { executor_model: 'claude-haiku-4-5' })
    const result = autoRoute(task, baseConfig, false)
    expect(result).not.toBeNull()
    expect(result?.model).toBe('claude-haiku-4-5')
  })
})
