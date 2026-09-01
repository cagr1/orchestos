import { describe, expect, test } from 'bun:test'
import type { SkillDef } from '../skills/registry.ts'
import { buildSections } from '../skills/targets/_shared.ts'

function baseSkill(overrides: Partial<SkillDef> = {}): SkillDef {
  return {
    id: 'test-skill',
    version: '1.0.0',
    name: 'Test Skill',
    description: 'A skill for testing',
    instructions: 'Do the thing.',
    targets: ['claude'],
    ...overrides,
  }
}

describe('buildSections — hardening fields (N.2)', () => {
  test('a skill without hardening fields compiles identically to before (no regression)', () => {
    const sections = buildSections(
      baseSkill({
        when_to_use: ['when testing'],
        anti_patterns: ['do not skip tests'],
        verifiers: ['bun test'],
      }),
    )
    expect(sections).toEqual([
      'Do the thing.',
      '## When to use',
      '- when testing',
      '## Anti-patterns',
      '- do not skip tests',
      '## Verifiers',
      'Run after applying: `bun test`',
    ])
  })

  test('iron_law renders before instructions', () => {
    const sections = buildSections(baseSkill({ iron_law: 'Never skip the test.' }))
    expect(sections[0]).toBe('## Iron law')
    expect(sections[1]).toBe('Never skip the test.')
    expect(sections[2]).toBe('Do the thing.')
  })

  test('common_rationalizations and red_flags render after anti_patterns', () => {
    const sections = buildSections(
      baseSkill({
        anti_patterns: ['do not skip tests'],
        common_rationalizations: [
          { excuse: 'It looks fine', refutation: 'Looking fine is not tested.' },
        ],
        red_flags: ['writing the test after the code'],
        verifiers: ['bun test'],
      }),
    )
    const antiIdx = sections.indexOf('## Anti-patterns')
    const rationalizationIdx = sections.indexOf('## Common rationalizations')
    const redFlagsIdx = sections.indexOf('## Red flags')
    const verifiersIdx = sections.indexOf('## Verifiers')
    expect(antiIdx).toBeGreaterThanOrEqual(0)
    expect(rationalizationIdx).toBeGreaterThan(antiIdx)
    expect(redFlagsIdx).toBeGreaterThan(rationalizationIdx)
    expect(verifiersIdx).toBeGreaterThan(redFlagsIdx)
    expect(sections).toContain('- Excuse: It looks fine → Refutation: Looking fine is not tested.')
    expect(sections).toContain('- writing the test after the code')
  })

  test('a skill with no iron_law does not render the section', () => {
    const sections = buildSections(baseSkill())
    expect(sections).not.toContain('## Iron law')
    expect(sections[0]).toBe('Do the thing.')
  })
})
