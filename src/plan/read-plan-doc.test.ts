import { expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readPlanDoc } from './read-plan-doc.ts'

function fixture(content?: string): string {
  const root = mkdtempSync(join(tmpdir(), 'orchestos-plan-doc-'))
  if (content !== undefined) writeFileSync(join(root, 'PLAN.md'), content)
  return root
}

test('parses a free-form checklist, section text, and indented items', () => {
  const root = fixture(
    '# SalaDespecho\n\n## Fase 1\nContexto de la fase.\n- [ ] Auditar login\n- [x] Migrar DB\n  - [ ] Verificar índices\n',
  )
  try {
    expect(readPlanDoc(root)).toEqual({
      exists: true,
      sections: [
        { title: 'SalaDespecho', level: 1, items: [], text: '' },
        {
          title: 'Fase 1',
          level: 2,
          items: [
            { checked: false, text: 'Auditar login', depth: 0 },
            { checked: true, text: 'Migrar DB', depth: 0 },
            { checked: false, text: 'Verificar índices', depth: 1 },
          ],
          text: 'Contexto de la fase.',
        },
      ],
    })
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('parses the repository PLAN.md with real item ids', () => {
  const result = readPlanDoc(process.cwd())
  expect(result.exists).toBe(true)
  expect(result.sections.length).toBeGreaterThan(0)
  expect(
    result.sections
      .flatMap((section) => section.items)
      .some((item) => item.text.includes('UI.10.A')),
  ).toBe(true)
})

test('reports an absent document without reading or writing anything', () => {
  const root = fixture()
  try {
    expect(readPlanDoc(root)).toEqual({ exists: false, sections: [] })
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('rejects documents over the read limit', () => {
  const root = fixture(`# Plan\n${'x'.repeat(1_048_577)}`)
  try {
    expect(() => readPlanDoc(root)).toThrow('1 MB read limit')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('ignores checklist lines before the first section', () => {
  const root = fixture('- [ ] Outside\n## Work\n- [ ] Inside\n')
  try {
    expect(readPlanDoc(root).sections[0]?.items).toEqual([
      { checked: false, text: 'Inside', depth: 0 },
    ])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
