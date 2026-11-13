import { describe, expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse } from 'yaml'
import { loadSkill, validateSkill } from '../skills/registry.ts'

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
    expect(() => validateSkill(baseSkill({ iron_law: 'x'.repeat(301) }), 'test.yaml')).toThrow(
      /iron_law/,
    )
  })

  test('accepts valid common_rationalizations', () => {
    const skill = validateSkill(
      baseSkill({
        common_rationalizations: [
          { excuse: 'It looks fine', refutation: 'Looking fine is not tested.' },
        ],
      }),
      'test.yaml',
    )
    expect(skill.common_rationalizations).toHaveLength(1)
  })

  test('rejects an empty common_rationalizations array', () => {
    expect(() => validateSkill(baseSkill({ common_rationalizations: [] }), 'test.yaml')).toThrow(
      /common_rationalizations/,
    )
  })

  test('rejects a common_rationalizations entry missing refutation', () => {
    expect(() =>
      validateSkill(
        baseSkill({
          common_rationalizations: [{ excuse: 'It looks fine' }],
        }),
        'test.yaml',
      ),
    ).toThrow(/refutation/)
  })

  test('rejects a common_rationalizations entry missing excuse', () => {
    expect(() =>
      validateSkill(
        baseSkill({
          common_rationalizations: [{ refutation: 'No.' }],
        }),
        'test.yaml',
      ),
    ).toThrow(/excuse/)
  })

  test('accepts valid red_flags', () => {
    const skill = validateSkill(
      baseSkill({ red_flags: ['writing the test after the code'] }),
      'test.yaml',
    )
    expect(skill.red_flags).toHaveLength(1)
  })

  test('rejects an empty red_flags array', () => {
    expect(() => validateSkill(baseSkill({ red_flags: [] }), 'test.yaml')).toThrow(/red_flags/)
  })

  test('rejects red_flags entries that are not strings', () => {
    expect(() => validateSkill(baseSkill({ red_flags: [42] }), 'test.yaml')).toThrow(/red_flags/)
  })
})

describe('validateSkill — activation contract (O.0)', () => {
  test('accepts a skill without activation (backward compatible)', () => {
    expect(() => validateSkill(baseSkill(), 'test.yaml')).not.toThrow()
  })

  test('accepts a minimal activation with only mode', () => {
    const skill = validateSkill(baseSkill({ activation: { mode: 'suggest' } }), 'test.yaml')
    expect(skill.activation?.mode).toBe('suggest')
  })

  test('rejects an invalid mode', () => {
    expect(() => validateSkill(baseSkill({ activation: { mode: 'always' } }), 'test.yaml')).toThrow(
      /activation\.mode/,
    )
  })

  test('rejects activation missing mode', () => {
    expect(() => validateSkill(baseSkill({ activation: {} }), 'test.yaml')).toThrow(
      /activation\.mode/,
    )
  })

  test('accepts valid triggers', () => {
    const skill = validateSkill(
      baseSkill({
        activation: { mode: 'automatic', triggers: ['auth', 'secrets'] },
      }),
      'test.yaml',
    )
    expect(skill.activation?.triggers).toEqual(['auth', 'secrets'])
  })

  test('rejects an empty triggers array', () => {
    expect(() =>
      validateSkill(
        baseSkill({
          activation: { mode: 'automatic', triggers: [] },
        }),
        'test.yaml',
      ),
    ).toThrow(/activation\.triggers/)
  })

  test('rejects triggers entries that are not strings', () => {
    expect(() =>
      validateSkill(
        baseSkill({
          activation: { mode: 'automatic', triggers: [42] },
        }),
        'test.yaml',
      ),
    ).toThrow(/activation\.triggers/)
  })

  test('accepts valid phases reusing TaskClass values', () => {
    const skill = validateSkill(
      baseSkill({
        activation: { mode: 'automatic', phases: ['review', 'implement'] },
      }),
      'test.yaml',
    )
    expect(skill.activation?.phases).toEqual(['review', 'implement'])
  })

  test('rejects a phases entry outside TaskClass', () => {
    expect(() =>
      validateSkill(
        baseSkill({
          activation: { mode: 'automatic', phases: ['deployment'] },
        }),
        'test.yaml',
      ),
    ).toThrow(/activation\.phases/)
  })

  test('rejects an empty phases array', () => {
    expect(() =>
      validateSkill(
        baseSkill({
          activation: { mode: 'automatic', phases: [] },
        }),
        'test.yaml',
      ),
    ).toThrow(/activation\.phases/)
  })
})

describe('AUD.16 — validated skill projection', () => {
  for (const [field, value] of [
    ['when_to_use', 'x'],
    ['inputs_required', [1]],
    ['verifiers', 'x'],
    ['anti_patterns', [false]],
    ['examples', [{ input: 1 }]],
    ['examples', [{ input: 'a', output: 'b' }]],
    ['source', 'x'],
    ['source', { url: 'x' }],
    ['language_targets', { ts: { verifiers: 'x' } }],
  ] as const) {
    test(`rejects malformed ${field}: ${JSON.stringify(value)}`, () => {
      expect(() => validateSkill(baseSkill({ [field]: value }), 'test.yaml')).toThrow(field)
    })
  }
  test('returns a fresh object without unknown fields, including nested fields', () => {
    const raw = baseSkill({
      extra: 1,
      source: { url: 'x', fetchedAt: 'y', extra: 1 },
      activation: { mode: 'suggest', extra: 1 },
    })
    const skill = validateSkill(raw, 'test.yaml')
    expect(skill).not.toBe(raw)
    expect(skill).not.toHaveProperty('extra')
    expect(skill.source).toEqual({ url: 'x', fetchedAt: 'y' })
    expect(skill.activation).toEqual({ mode: 'suggest' })
  })
  test('all bundled YAML skills load with identical content', () => {
    const dir = join(import.meta.dir, '../../skills')
    const files = readdirSync(dir).filter((file) => file.endsWith('.yaml'))
    expect(files.length).toBeGreaterThan(0)
    for (const file of files) {
      const path = join(dir, file)
      expect(loadSkill(path)).toEqual(parse(readFileSync(path, 'utf8')))
    }
  })
})
