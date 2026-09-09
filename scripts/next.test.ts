import { Database } from 'bun:sqlite'
import { afterEach, expect, test } from 'bun:test'
import { readyItems, setDeps, upsertPlanItem } from '../src/db/plan-items.ts'
import { MAX_NEXT_ITEMS, renderNext } from './next.ts'

const databases: Database[] = []

function createDatabase(): Database {
  const database = new Database(':memory:')
  databases.push(database)
  database.run(`
    CREATE TABLE plan_items (
      id TEXT PRIMARY KEY, sprint TEXT NOT NULL, block TEXT, delegation TEXT NOT NULL,
      title TEXT NOT NULL, body TEXT NOT NULL DEFAULT '', status TEXT NOT NULL,
      commit_sha TEXT, closed_at TEXT, position INTEGER NOT NULL
    );
    CREATE TABLE plan_item_deps (
      item_id TEXT NOT NULL, depends_on TEXT NOT NULL,
      PRIMARY KEY (item_id, depends_on)
    );
  `)
  return database
}

function addItem(database: Database, id: string, status: 'open' | 'done', position: number): void {
  upsertPlanItem(
    {
      id,
      sprint: 'Bloque S',
      delegation: '⚡',
      title: `Título ${id}`,
      status,
      commitSha: status === 'done' ? 'commit-fixture' : null,
      position,
    },
    database,
  )
}

afterEach(() => {
  for (const database of databases.splice(0)) database.close()
})

test('muestra solo ítems abiertos cuyas dependencias ya están cerradas', () => {
  const database = createDatabase()
  addItem(database, 'done', 'done', 0)
  addItem(database, 'ready', 'open', 1)
  addItem(database, 'blocked', 'open', 2)
  setDeps('ready', ['done'], database)
  setDeps('blocked', ['ready'], database)

  expect(renderNext(readyItems(database))).toBe(
    'Ítems listos para tomar: 1\nready ⚡ — Título ready',
  )
})

test('acota el contexto a doce ítems y declara los restantes', () => {
  const database = createDatabase()
  for (let index = 0; index < MAX_NEXT_ITEMS + 2; index += 1) {
    addItem(database, `S.${index + 1}`, 'open', index)
  }

  const lines = renderNext(readyItems(database)).split('\n')
  expect(lines).toHaveLength(MAX_NEXT_ITEMS + 2)
  expect(lines[0]).toBe(`Ítems listos para tomar: ${MAX_NEXT_ITEMS + 2}`)
  expect(lines.at(-1)).toBe('… 2 más.')
  expect(lines.join('\n')).not.toContain('S.13 ⚡')
})

test('explica cuando no hay trabajo listo', () => {
  expect(renderNext([])).toBe('No hay ítems abiertos con todas sus dependencias cerradas.')
})
