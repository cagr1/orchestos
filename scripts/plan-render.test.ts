import { Database } from 'bun:sqlite'
import { expect, test } from 'bun:test'
import { renderPlan } from './plan-render.ts'
import { parsePlanDocumentSegments } from './plan-status.ts'

test('parsePlanDocumentSegments conserva byte a byte la prosa y los bloques de ítem', () => {
  const fixture = [
    '---',
    'title: fixture',
    '---',
    '',
    '> Cita literal',
    '',
    '- [ ] **F.1 — ⚡ Ítem fixture.**',
    '  cuerpo indentado',
    '',
    '### Tabla',
    '| a | b |',
    '| - | - |',
    '',
  ].join('\n')
  const segments = parsePlanDocumentSegments(fixture)
  expect(segments.filter((segment) => segment.kind === 'item')).toHaveLength(1)
  expect(segments.find((segment) => segment.kind === 'item')?.text).toBe(
    '- [ ] **F.1 — ⚡ Ítem fixture.**\n  cuerpo indentado\n',
  )
  expect(segments.map((segment) => segment.text).join('')).toBe(fixture)
})

test('renderPlan concatena segmentos ordenados desde la DB', () => {
  const database = new Database(':memory:')
  database.exec(`
    CREATE TABLE plan_doc_segments (
      doc TEXT NOT NULL,
      position INTEGER NOT NULL,
      kind TEXT NOT NULL,
      text TEXT,
      item_id TEXT,
      PRIMARY KEY (doc, position)
    )
  `)
  database.run('INSERT INTO plan_doc_segments VALUES (?, ?, ?, ?, ?)', [
    'PLAN.md',
    0,
    'prose',
    '# Fixture\n',
    null,
  ])
  database.run('INSERT INTO plan_doc_segments VALUES (?, ?, ?, ?, ?)', [
    'PLAN.md',
    1,
    'item',
    '- [ ] **F.1 — ⚡ Item.**\n',
    'F.1',
  ])
  expect(renderPlan(database)).toBe('# Fixture\n- [ ] **F.1 — ⚡ Item.**\n')
  database.close()
})
