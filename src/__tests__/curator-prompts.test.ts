import { describe, expect, test } from 'bun:test'
import { CURATOR_SYSTEM, IMPORT_SYSTEM } from '../dashboard/prompts/curator.ts'

describe('curator prompts — hardening fields (N.3)', () => {
  test('CURATOR_SYSTEM teaches iron_law, common_rationalizations and red_flags', () => {
    expect(CURATOR_SYSTEM).toContain('iron_law')
    expect(CURATOR_SYSTEM).toContain('common_rationalizations')
    expect(CURATOR_SYSTEM).toContain('red_flags')
  })

  test('IMPORT_SYSTEM teaches iron_law, common_rationalizations and red_flags', () => {
    expect(IMPORT_SYSTEM).toContain('iron_law')
    expect(IMPORT_SYSTEM).toContain('common_rationalizations')
    expect(IMPORT_SYSTEM).toContain('red_flags')
  })
})
