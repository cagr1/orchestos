import { describe, expect, it } from 'bun:test'
import type { TaskAgentRule } from '../config/schema.ts'
import { resolveProjectAgentRule } from '../router/engine-cascade.ts'

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
