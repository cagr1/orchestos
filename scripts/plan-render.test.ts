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
    CREATE TABLE plan_items (
      id TEXT PRIMARY KEY, sprint TEXT NOT NULL, block TEXT, delegation TEXT NOT NULL,
      title TEXT NOT NULL, status TEXT NOT NULL, position INTEGER NOT NULL
    );
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
  database.run('INSERT INTO plan_items VALUES (?, ?, ?, ?, ?, ?, ?)', [
    'F.1',
    '',
    null,
    '⚡',
    'Item',
    'open',
    0,
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

function integrityFixture(): Database {
  const database = new Database(':memory:')
  database.exec(`
    CREATE TABLE plan_items (
      id TEXT PRIMARY KEY, sprint TEXT NOT NULL, block TEXT, delegation TEXT NOT NULL,
      title TEXT NOT NULL, status TEXT NOT NULL, position INTEGER NOT NULL
    );
    CREATE TABLE plan_doc_segments (
      doc TEXT NOT NULL, position INTEGER NOT NULL, kind TEXT NOT NULL, text TEXT,
      item_id TEXT, PRIMARY KEY (doc, position)
    );
  `)
  const segments: Array<[kind: string, text: string, itemId: string | null]> = [
    ['prose', '## Sprint fixture\n### Block fixture\n', null],
    ['item', '- [ ] **F.1 — ⚡ Item fixture.**\n', 'F.1'],
  ]
  for (const [position, [kind, text, itemId]] of segments.entries())
    database.run('INSERT INTO plan_doc_segments VALUES (?, ?, ?, ?, ?)', [
      'PLAN.md',
      position,
      kind,
      text,
      itemId,
    ])
  database.run('INSERT INTO plan_items VALUES (?, ?, ?, ?, ?, ?, ?)', [
    'F.1',
    'Sprint fixture',
    'Block fixture',
    '⚡',
    'Item fixture',
    'open',
    0,
  ])
  return database
}

test('renderPlan rejects every structured item divergence rather than printing a false sync', () => {
  for (const [column, value] of [
    ['title', 'Other title'],
    ['delegation', '🧠'],
    ['sprint', 'Other sprint'],
    ['block', 'Other block'],
    ['position', 4],
    ['status', 'done'],
  ] as const) {
    const database = integrityFixture()
    database.run(`UPDATE plan_items SET ${column} = ? WHERE id = ?`, [value, 'F.1'])
    expect(() => renderPlan(database)).toThrow(`F.1 diverges from plan_items field ${column}`)
    database.close()
  }
})

test('renderPlan rejects missing, extra, duplicated, and wrongly-labelled item segments', () => {
  for (const mutate of [
    (database: Database) => database.run("DELETE FROM plan_doc_segments WHERE item_id = 'F.1'"),
    (database: Database) =>
      database.run('INSERT INTO plan_items VALUES (?, ?, ?, ?, ?, ?, ?)', [
        'EXTRA',
        'Sprint fixture',
        null,
        '⚡',
        'Extra',
        'open',
        1,
      ]),
    (database: Database) =>
      database.run('UPDATE plan_doc_segments SET item_id = ? WHERE item_id = ?', ['OTHER', 'F.1']),
  ]) {
    const database = integrityFixture()
    mutate(database)
    expect(() => renderPlan(database)).toThrow()
    database.close()
  }
})
