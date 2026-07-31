import { describe, expect, test } from 'bun:test'
import { validateSkill } from '../skills/registry.ts'

function baseSkill(overrides: Record<string, unknown> = {}) {
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

describe('validateSkill — hardening fields (N.1)', () => {
  test('accepts a skill without hardening fields (backward compatible)', () => {
    expect(() => validateSkill(baseSkill(), 'test.yaml')).not.toThrow()
  })

  test('accepts a valid iron_law', () => {
    const skill = validateSkill(baseSkill({ iron_law: 'Never skip the test.' }), 'test.yaml')
    expect(skill.iron_law).toBe('Never skip the test.')
  })

  test('rejects an empty iron_law', () => {
    expect(() => validateSkill(baseSkill({ iron_law: '' }), 'test.yaml')).toThrow(/iron_law/)
  })

  test('rejects an iron_law longer than 300 chars', () => {
    expect(() => validateSkill(baseSkill({ iron_law: 'x'.repeat(301) }), 'test.yaml')).toThrow(/iron_law/)
  })

  test('accepts valid common_rationalizations', () => {
    const skill = validateSkill(baseSkill({
      common_rationalizations: [{ excuse: 'It looks fine', refutation: 'Looking fine is not tested.' }],
    }), 'test.yaml')
    expect(skill.common_rationalizations).toHaveLength(1)
  })

  test('rejects an empty common_rationalizations array', () => {
    expect(() => validateSkill(baseSkill({ common_rationalizations: [] }), 'test.yaml')).toThrow(/common_rationalizations/)
  })

  test('rejects a common_rationalizations entry missing refutation', () => {
    expect(() => validateSkill(baseSkill({
      common_rationalizations: [{ excuse: 'It looks fine' }],
    }), 'test.yaml')).toThrow(/refutation/)
  })

  test('rejects a common_rationalizations entry missing excuse', () => {
    expect(() => validateSkill(baseSkill({
      common_rationalizations: [{ refutation: 'No.' }],
    }), 'test.yaml')).toThrow(/excuse/)
  })

  test('accepts valid red_flags', () => {
    const skill = validateSkill(baseSkill({ red_flags: ['writing the test after the code'] }), 'test.yaml')
    expect(skill.red_flags).toHaveLength(1)
  })

  test('rejects an empty red_flags array', () => {
    expect(() => validateSkill(baseSkill({ red_flags: [] }), 'test.yaml')).toThrow(/red_flags/)
  })

  test('rejects red_flags entries that are not strings', () => {
    expect(() => validateSkill(baseSkill({ red_flags: [42] }), 'test.yaml')).toThrow(/red_flags/)
  })
})
