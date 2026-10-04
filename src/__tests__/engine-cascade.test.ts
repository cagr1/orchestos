import { describe, expect, it } from 'bun:test'
import type { OrcheConfig, TaskAgentRule } from '../config/schema.ts'
import { resolveProjectAgentRule, taskFieldsFromRule } from '../router/engine-cascade.ts'

describe('resolveProjectAgentRule()', () => {
  const rules: TaskAgentRule[] = [
    { match: { output: ['apps/api/**'] }, agent: 'codex' },
    { match: { output: ['apps/web/**'] }, agent: 'claude' },
    { match: { skill: 'frontend-design' }, agent: 'claude', cli_effort: 'high' },
  ]

  it('returns undefined when no rules are configured', () => {
    expect(resolveProjectAgentRule(undefined, { output: ['apps/api/x.ts'] })).toBeUndefined()
    expect(resolveProjectAgentRule([], { output: ['apps/api/x.ts'] })).toBeUndefined()
  })

  it('matches by output glob, with the first matching rule winning', () => {
    expect(resolveProjectAgentRule(rules, { output: ['apps/api/src/x.ts'] })).toEqual(rules[0])
    expect(resolveProjectAgentRule(rules, { output: ['apps/web/src/x.tsx'] })).toEqual(rules[1])
  })

  it('matches by exact skill id when no output rule matches', () => {
    expect(
      resolveProjectAgentRule(rules, { output: ['demo/x.ts'], skill: 'frontend-design' }),
    ).toEqual(rules[2])
  })

  it('prefers output matches over skill matches', () => {
    expect(
      resolveProjectAgentRule(rules, { output: ['apps/api/x.ts'], skill: 'frontend-design' }),
    ).toEqual(rules[0])
  })

  it('returns undefined when no rule matches', () => {
    expect(resolveProjectAgentRule(rules, { output: ['demo/x.ts'] })).toBeUndefined()
    expect(
      resolveProjectAgentRule(rules, { output: ['demo/x.ts'], skill: 'backend' }),
    ).toBeUndefined()
  })
})

describe('taskFieldsFromRule()', () => {
  const cfg: OrcheConfig = {
    config_version: 1,
    roles: { executor: { agent: 'codex', model: 'gpt-6-luna', effort: 'medium' } },
    models: {},
  }
  it('maps Claude and its declared model', () => {
    expect(
      taskFieldsFromRule({ match: { skill: 'x' }, agent: 'claude', model: 'haiku' }, cfg),
    ).toEqual({
      engine: 'external',
      executor_model: 'haiku',
    })
  })
  it('requires a model when the rule targets a different CLI', () => {
    expect(taskFieldsFromRule({ match: { skill: 'x' }, agent: 'claude' }, cfg)).toEqual({
      error: 'Task rule for claude has no model. Set it in Settings → Task rules.',
    })
  })
  it('allows the Executor CLI model to supply the rule model', () => {
    expect(taskFieldsFromRule({ match: { skill: 'x' }, agent: 'codex' }, cfg)).toEqual({
      engine: 'codex',
    })
  })
})
