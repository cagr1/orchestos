/**
 * S28.5 — Tests for spec lint (WHEN/THEN acceptance criteria detection).
 * S32.5 — Tests for capabilities delta header validation.
 */

import { describe, it, expect } from 'bun:test'
import { lintSpec } from '../spec/lint.ts'
import type { Spec } from '../spec/store.ts'

function makeSpec(criteriaLines: string[]): Spec {
  const criteria = criteriaLines.map(l => `- [ ] ${l}`).join('\n')
  return {
    frontmatter: {
      id: 'test-task',
      status: 'draft',
      createdAt: new Date().toISOString(),
      clarify: 'none',
    },
    body: `## Contexto\nfoo\n\n## Criterios de aceptación\n${criteria}\n\n## Notas\nbar\n`,
  }
}

describe('lintSpec — structured criteria', () => {
  it('returns no findings for criteria in WHEN/THEN format', () => {
    const spec = makeSpec([
      'WHEN the user calls createUser() THEN a new record appears in the DB',
      'WHEN invalid input is provided THEN it throws a ValidationError',
    ])
    const result = lintSpec(spec)
    expect(result.findings).toHaveLength(0)
    expect(result.structuredCount).toBe(2)
    expect(result.freeFormCount).toBe(0)
  })

  it('accepts lowercase when/then as structured', () => {
    const spec = makeSpec(['when user logs in then session cookie is set'])
    const result = lintSpec(spec)
    expect(result.findings).toHaveLength(0)
    expect(result.structuredCount).toBe(1)
  })

  it('accepts mixed-case When/Then', () => {
    const spec = makeSpec(['When POST /users is called Then response status is 201'])
    const result = lintSpec(spec)
    expect(result.findings).toHaveLength(0)
  })
})

describe('lintSpec — free-form criteria', () => {
  it('flags criteria without WHEN/THEN', () => {
    const spec = makeSpec([
      'La función debe retornar un array vacío si no hay resultados',
      'El sistema maneja errores correctamente',
    ])
    const result = lintSpec(spec)
    expect(result.findings).toHaveLength(2)
    expect(result.freeFormCount).toBe(2)
    expect(result.structuredCount).toBe(0)
  })

  it('flags criteria with only WHEN but no THEN', () => {
    const spec = makeSpec(['WHEN the user calls the API'])
    const result = lintSpec(spec)
    expect(result.findings).toHaveLength(1)
  })

  it('flags criteria with only THEN but no WHEN', () => {
    const spec = makeSpec(['THEN the result is valid'])
    const result = lintSpec(spec)
    expect(result.findings).toHaveLength(1)
  })

  it('includes the criterion text in the finding', () => {
    const spec = makeSpec(['funciona correctamente en todos los casos'])
    const result = lintSpec(spec)
    expect(result.findings[0]!.criterion).toBe('funciona correctamente en todos los casos')
  })

  it('includes a suggestion in the finding', () => {
    const spec = makeSpec(['it should return 200'])
    const result = lintSpec(spec)
    expect(result.findings[0]!.suggestion).toContain('WHEN')
    expect(result.findings[0]!.suggestion).toContain('THEN')
  })
})

describe('lintSpec — mixed criteria', () => {
  it('correctly separates structured from free-form', () => {
    const spec = makeSpec([
      'WHEN input is empty THEN return []',
      'el código compila sin errores',
      'WHEN file is missing THEN throw FileNotFoundError',
      'maneja los casos de error',
    ])
    const result = lintSpec(spec)
    expect(result.structuredCount).toBe(2)
    expect(result.freeFormCount).toBe(2)
    expect(result.findings).toHaveLength(2)
  })
})

describe('lintSpec — edge cases', () => {
  it('returns empty findings when section is missing', () => {
    const spec: Spec = {
      frontmatter: { id: 'x', status: 'draft', createdAt: '', clarify: 'none' },
      body: '## Descripción\nfoo',
    }
    const result = lintSpec(spec)
    expect(result.findings).toHaveLength(0)
    expect(result.structuredCount).toBe(0)
  })

  it('returns empty findings when section has no bullets', () => {
    const spec: Spec = {
      frontmatter: { id: 'x', status: 'draft', createdAt: '', clarify: 'none' },
      body: '## Criterios de aceptación\n(pendiente)\n',
    }
    const result = lintSpec(spec)
    expect(result.findings).toHaveLength(0)
  })

  it('strips GFM task list prefix before checking', () => {
    const spec = makeSpec(['WHEN x THEN y'])  // makeSpec adds "- [ ] " prefix
    const result = lintSpec(spec)
    expect(result.structuredCount).toBe(1)
  })
})

// ── S32.5: Delta header validation ──────────────────────────────────────────

function makeSpecWithCaps(
  caps: { added?: string[]; modified?: string[]; removed?: string[] },
  extraBody = '',
): Spec {
  return {
    frontmatter: {
      id: 'delta-task',
      status: 'draft',
      createdAt: new Date().toISOString(),
      clarify: 'none',
      capabilities: {
        added:    caps.added    ?? [],
        modified: caps.modified ?? [],
        removed:  caps.removed  ?? [],
      },
    },
    body: `## Criterios de aceptación\n- [ ] WHEN x THEN y\n\n${extraBody}`,
  }
}

const COMPLETE_MODIFIED_BLOCK = `## MODIFIED\n\nThe previous requirement stated:\n\n- The system shall validate all inputs on entry\n- Errors must be surfaced to the caller with a typed error class\n- All edge cases for null inputs must be handled explicitly before delegation\n`

describe('lintSpec — S32.3: missing delta headers', () => {
  it('flags missing ## ADDED when capabilities.added is non-empty', () => {
    const spec = makeSpecWithCaps({ added: ['new-feature'] })
    const result = lintSpec(spec)
    expect(result.deltaIssuesCount).toBe(1)
    expect(result.findings.some(f => f.criterion.includes('## ADDED'))).toBe(true)
  })

  it('flags missing ## MODIFIED when capabilities.modified is non-empty', () => {
    const spec = makeSpecWithCaps({ modified: ['old-spec'] })
    const result = lintSpec(spec)
    expect(result.deltaIssuesCount).toBe(1)
    expect(result.findings.some(f => f.criterion.includes('## MODIFIED'))).toBe(true)
  })

  it('flags missing ## REMOVED when capabilities.removed is non-empty', () => {
    const spec = makeSpecWithCaps({ removed: ['legacy-feature'] })
    const result = lintSpec(spec)
    expect(result.deltaIssuesCount).toBe(1)
    expect(result.findings.some(f => f.criterion.includes('## REMOVED'))).toBe(true)
  })

  it('flags all three missing headers when all capabilities are set', () => {
    const spec = makeSpecWithCaps({
      added: ['feat-a'],
      modified: ['spec-b'],
      removed: ['feat-c'],
    })
    const result = lintSpec(spec)
    expect(result.deltaIssuesCount).toBe(3)
  })

  it('no delta issues when no capabilities are set', () => {
    const spec = makeSpec(['WHEN x THEN y'])
    const result = lintSpec(spec)
    expect(result.deltaIssuesCount).toBe(0)
  })

  it('no delta issues when capabilities are all empty arrays', () => {
    const spec = makeSpecWithCaps({ added: [], modified: [], removed: [] })
    const result = lintSpec(spec)
    expect(result.deltaIssuesCount).toBe(0)
  })
})

describe('lintSpec — S32.3: delta headers present (valid)', () => {
  it('no issue for added with ## ADDED section present', () => {
    const spec = makeSpecWithCaps(
      { added: ['new-feature'] },
      '## ADDED\n\nAdds a new authentication middleware.\n',
    )
    const result = lintSpec(spec)
    expect(result.findings.some(f => f.criterion.includes('## ADDED'))).toBe(false)
  })

  it('no issue for modified with complete ## MODIFIED section', () => {
    const spec = makeSpecWithCaps({ modified: ['old-spec'] }, COMPLETE_MODIFIED_BLOCK)
    const result = lintSpec(spec)
    expect(result.deltaIssuesCount).toBe(0)
  })

  it('no issue for removed with ## REMOVED section present', () => {
    const spec = makeSpecWithCaps(
      { removed: ['old-feature'] },
      '## REMOVED\n\nThe legacy XML export capability has been removed in favor of JSON.\n',
    )
    const result = lintSpec(spec)
    expect(result.findings.some(f => f.criterion.includes('## REMOVED'))).toBe(false)
  })
})

describe('lintSpec — S32.4: MODIFIED completeness', () => {
  it('flags ## MODIFIED with content shorter than 80 chars', () => {
    const spec = makeSpecWithCaps(
      { modified: ['old-spec'] },
      '## MODIFIED\n\nShort fragment.\n',
    )
    const result = lintSpec(spec)
    expect(result.deltaIssuesCount).toBeGreaterThanOrEqual(1)
    expect(result.findings.some(f => f.criterion.includes('too short'))).toBe(true)
  })

  it('flags ## MODIFIED with single-line content (even if > 80 chars)', () => {
    const longSingleLine = 'A'.repeat(90)
    const spec = makeSpecWithCaps(
      { modified: ['old-spec'] },
      `## MODIFIED\n\n${longSingleLine}\n`,
    )
    const result = lintSpec(spec)
    expect(result.findings.some(f => f.criterion.includes('single line'))).toBe(true)
  })

  it('accepts ## MODIFIED with multi-line content > 80 chars', () => {
    const spec = makeSpecWithCaps({ modified: ['old-spec'] }, COMPLETE_MODIFIED_BLOCK)
    const result = lintSpec(spec)
    expect(result.findings.some(f => f.criterion.includes('## MODIFIED section content is too short'))).toBe(false)
    expect(result.findings.some(f => f.criterion.includes('single line'))).toBe(false)
  })
})

describe('lintSpec — S32.5: freeFormCount excludes delta issues', () => {
  it('freeFormCount only counts criteria findings, not delta issues', () => {
    const spec: Spec = {
      frontmatter: {
        id: 'mixed',
        status: 'draft',
        createdAt: '',
        clarify: 'none',
        capabilities: { added: ['feat'], modified: [], removed: [] },
      },
      body: '## Criterios de aceptación\n- [ ] funciona correctamente\n- [ ] WHEN x THEN y\n',
    }
    const result = lintSpec(spec)
    expect(result.freeFormCount).toBe(1)
    expect(result.deltaIssuesCount).toBe(1)
    expect(result.findings).toHaveLength(2)
  })
})
