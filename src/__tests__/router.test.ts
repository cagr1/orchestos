import { describe, expect, it } from 'bun:test'
import type { OrcheConfig } from '../config/schema.ts'
import { autoRoute } from '../router/auto-route.ts'
import { classifyTask, type TaskClass } from '../router/classify.ts'
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
    // regression 2026-07-17 (Mes 22): "design" mid-sentence as an ordinary
    // UI noun must NOT trigger 'plan' — only a leading imperative does
    ['Build a data-dense crypto terminal with responsive design, no build tooling', 'implement'],
    ['Add a pricing plan selector to the billing page', 'implement'],
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
  roles: { executor: { agent: 'codex', model: 'gpt-6-luna', effort: 'medium' } },
  models: {},
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
  it('routes the executor role and carries effort', () => {
    expect(autoRoute(makeTask('Add a feature'), baseConfig)).toEqual({
      agent: 'codex',
      provider: 'codex',
      model: 'gpt-6-luna',
      effort: 'medium',
      source: 'executor',
    })
  })
  it('task executor_model is an explicit API route', () => {
    expect(autoRoute(makeTask('Fix it', { executor_model: 'openai/gpt-4.1' }), baseConfig)).toEqual(
      { agent: 'api', provider: 'openrouter', model: 'openai/gpt-4.1', source: 'task' },
    )
  })
  it('returns null when executor is unassigned', () => {
    expect(autoRoute(makeTask('Fix it'), { ...baseConfig, roles: {} })).toBeNull()
  })
})
