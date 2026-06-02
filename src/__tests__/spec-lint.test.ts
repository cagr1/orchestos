/**
 * S28.5 — Tests for spec lint (WHEN/THEN acceptance criteria detection).
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
