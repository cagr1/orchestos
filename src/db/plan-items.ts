import type { Database } from 'bun:sqlite'
import { db } from './sqlite.ts'

export type PlanItemDelegation = '🧠' | '⚡' | '🔍'
export type PlanItemStatus = 'open' | 'done'

export interface PlanItem {
  id: string
  sprint: string
  block: string | null
  delegation: PlanItemDelegation
  title: string
  body: string
  status: PlanItemStatus
  commit_sha: string | null
  closed_at: string | null
  position: number
}

export interface UpsertPlanItemInput {
  id: string
  sprint: string
  block?: string | null
  delegation: PlanItemDelegation
  title: string
  body?: string
  status: PlanItemStatus
  commitSha?: string | null
  closedAt?: string | null
  position: number
}

export interface PlanItemFilter {
  status?: PlanItemStatus
  sprint?: string
}

export function upsertPlanItem(input: UpsertPlanItemInput, database: Database = db): PlanItem {
  database.run(
    `INSERT INTO plan_items (
       id, sprint, block, delegation, title, body, status, commit_sha, closed_at, position
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       sprint = excluded.sprint,
       block = excluded.block,
       delegation = excluded.delegation,
       title = excluded.title,
       body = excluded.body,
       status = excluded.status,
       commit_sha = excluded.commit_sha,
       closed_at = excluded.closed_at,
       position = excluded.position`,
    [
      input.id,
      input.sprint,
      input.block ?? null,
      input.delegation,
      input.title,
      input.body ?? '',
      input.status,
      input.commitSha ?? null,
      input.closedAt ?? null,
      input.position,
    ],
  )
  const item = getPlanItem(input.id, database)
  if (!item) throw new Error(`Could not read upserted plan item ${input.id}`)
  return item
}

export function getPlanItem(id: string, database: Database = db): PlanItem | null {
  return database.query<PlanItem, string>('SELECT * FROM plan_items WHERE id = ?').get(id) ?? null
}

export function listPlanItems(filter: PlanItemFilter = {}, database: Database = db): PlanItem[] {
  const conditions: string[] = []
  const params: string[] = []
  if (filter.status) {
    conditions.push('status = ?')
    params.push(filter.status)
  }
  if (filter.sprint) {
    conditions.push('sprint = ?')
    params.push(filter.sprint)
  }
  const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : ''
  return database
    .query<PlanItem, string[]>(`SELECT * FROM plan_items${where} ORDER BY position ASC, id ASC`)
    .all(...params)
}

export function setDeps(itemId: string, dependsOn: string[], database: Database = db): void {
  const replace = database.transaction(() => {
    database.run('DELETE FROM plan_item_deps WHERE item_id = ?', [itemId])
    for (const dependency of dependsOn) {
      database.run('INSERT INTO plan_item_deps (item_id, depends_on) VALUES (?, ?)', [
        itemId,
        dependency,
      ])
    }
  })
  replace()
}

export function closePlanItem(
  id: string,
  commitSha: string,
  closedAt: string,
  database: Database = db,
): PlanItem | null {
  if (!commitSha.trim()) throw new Error('closePlanItem requires a commit SHA')
  database.run(
    "UPDATE plan_items SET status = 'done', commit_sha = ?, closed_at = ? WHERE id = ?",
    [commitSha, closedAt, id],
  )
  return getPlanItem(id, database)
}

export function readyItems(database: Database = db): PlanItem[] {
  return database
    .query<PlanItem, []>(
      `SELECT item.*
       FROM plan_items AS item
       WHERE item.status = 'open'
         AND NOT EXISTS (
           SELECT 1
           FROM plan_item_deps AS dep
           JOIN plan_items AS dependency ON dependency.id = dep.depends_on
           WHERE dep.item_id = item.id AND dependency.status <> 'done'
         )
       ORDER BY item.position ASC, item.id ASC`,
    )
    .all()
}
