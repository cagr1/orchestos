import type { Database } from 'bun:sqlite'
import { existsSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { parsePlanFeatureStatus } from '../../scripts/plan-status.ts'
import { renderPlan } from './plan-doc.ts'
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

export interface PlanItemWithDeps {
  id: string
  sprint: string
  block: string | null
  delegation: PlanItemDelegation
  title: string
  status: PlanItemStatus
  position: number
  commitSha: string | null
  closedAt: string | null
  dependsOn: string[]
  blockedBy: string[]
  ready: boolean
}

export interface PlanItemWithCommitStatus extends PlanItemWithDeps {
  commitPending: boolean
}

export interface PreparePlanCloseOptions {
  id: string
  root: string
  provisionalSha: string
  now: string
  database?: Database
  writePlan?: (path: string, content: string) => void
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

/** Reads all dependency edges in one additional query, never one query per card. */
export function listPlanItemsWithDeps(database: Database = db): PlanItemWithDeps[] {
  const items = listPlanItems({}, database)
  const dependencies = database
    .query<{ item_id: string; depends_on: string; status: PlanItemStatus; position: number }, []>(
      `SELECT dep.item_id, dep.depends_on, dependency.status, dependency.position
       FROM plan_item_deps AS dep
       JOIN plan_items AS dependency ON dependency.id = dep.depends_on
       ORDER BY dep.item_id ASC, dependency.position ASC, dependency.id ASC`,
    )
    .all()
  const byItem = new Map<string, Array<{ id: string; status: PlanItemStatus }>>()
  for (const dependency of dependencies) {
    const list = byItem.get(dependency.item_id) ?? []
    list.push({ id: dependency.depends_on, status: dependency.status })
    byItem.set(dependency.item_id, list)
  }
  return items.map((item) => {
    const deps = byItem.get(item.id) ?? []
    const blockedBy = deps.filter((dep) => dep.status !== 'done').map((dep) => dep.id)
    return {
      id: item.id,
      sprint: item.sprint,
      block: item.block,
      delegation: item.delegation,
      title: item.title,
      status: item.status,
      position: item.position,
      commitSha: item.commit_sha,
      closedAt: item.closed_at,
      dependsOn: deps.map((dep) => dep.id),
      blockedBy,
      ready: item.status === 'open' && blockedBy.length === 0,
    }
  })
}

const FULL_COMMIT_SHA = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i

function git(root: string, args: string[]): { exitCode: number; stdout: string } {
  const result = Bun.spawnSync(['git', ...args], { cwd: root, stdout: 'pipe', stderr: 'pipe' })
  return { exitCode: result.exitCode, stdout: new TextDecoder().decode(result.stdout).trim() }
}

function itemStatusAtCommit(root: string, commit: string, id: string): PlanItemStatus | null {
  const document = git(root, ['show', `${commit}:PLAN.md`])
  if (document.exitCode !== 0) return null
  return parsePlanFeatureStatus(document.stdout).find((item) => item.id === id)?.status ?? null
}

/** A close SHA is trustworthy only when that commit itself flips the item's status. */
export function isConfirmedPlanCloseCommit(root: string, id: string, sha: string): boolean {
  if (!FULL_COMMIT_SHA.test(sha)) return false
  if (git(root, ['rev-parse', '--verify', `${sha}^{commit}`]).exitCode !== 0) return false
  if (git(root, ['merge-base', '--is-ancestor', sha, 'HEAD']).exitCode !== 0) return false
  if (itemStatusAtCommit(root, sha, id) !== 'done') return false
  const parent = git(root, ['rev-parse', '--verify', `${sha}^`])
  if (parent.exitCode !== 0) {
    // A root commit transitions from an empty document.
    return true
  }
  return itemStatusAtCommit(root, parent.stdout, id) !== 'done'
}

export interface PlanTransitionCommits {
  closeCommits: Map<string, string>
  reopenCommits: Map<string, string>
  reopenedAfterLatestClose: Set<string>
}

/**
 * Finds each item's latest close and reopen transitions in one pass over PLAN.md history.
 * `--first-parent` keeps each entry's parent equal to the next (older) entry parsed here, so
 * every commit's PLAN.md is read exactly once. A reopen that appears before a close in this
 * newest-first walk invalidates that close as proof of the current working-tree closure.
 */
export function findAllPlanTransitionCommits(root: string): PlanTransitionCommits {
  const closeCommits = new Map<string, string>()
  const reopenCommits = new Map<string, string>()
  const history = git(root, ['log', '--first-parent', '--format=%H', '--', 'PLAN.md'])
  if (history.exitCode !== 0)
    return { closeCommits, reopenCommits, reopenedAfterLatestClose: new Set() }
  const shas = history.stdout.split('\n').filter(Boolean)
  const parsed = shas.map((sha) => {
    const document = git(root, ['show', `${sha}:PLAN.md`])
    return document.exitCode === 0
      ? new Map(parsePlanFeatureStatus(document.stdout).map((item) => [item.id, item.status]))
      : new Map<string, PlanItemStatus>()
  })
  for (const [index, sha] of shas.entries()) {
    const after = parsed[index]
    const before = parsed[index + 1] ?? new Map<string, PlanItemStatus>()
    if (!after) continue
    for (const [id, status] of after) {
      if (status === 'done' && before.get(id) !== 'done' && !closeCommits.has(id))
        closeCommits.set(id, sha)
      if (status === 'open' && before.get(id) === 'done' && !reopenCommits.has(id))
        reopenCommits.set(id, sha)
    }
  }
  const reopenedAfterLatestClose = new Set<string>()
  for (const [id, reopenSha] of reopenCommits) {
    const closeSha = closeCommits.get(id)
    if (!closeSha || shas.indexOf(reopenSha) < shas.indexOf(closeSha))
      reopenedAfterLatestClose.add(id)
  }
  return { closeCommits, reopenCommits, reopenedAfterLatestClose }
}

/**
 * Finds the real transition commit for every item in one pass over PLAN.md's history,
 * instead of re-walking the whole history once per item. `plan-import.ts`'s reconcile closes
 * dozens of items at a time; calling `findPlanCloseCommit` per item was O(items × history) git
 * subprocess spawns — on this repo's ~440 PLAN.md-touching commits that took minutes and could
 * hang. Reopen-then-reclose resolves to the most recent closing transition.
 */
export function findAllPlanCloseCommits(root: string): Map<string, string> {
  return findAllPlanTransitionCommits(root).closeCommits
}

/** Finds the real transition commit for a single item; callers must abort rather than
 * inventing HEAD. Prefer `findAllPlanCloseCommits` when resolving more than one id. */
export function findPlanCloseCommit(root: string, id: string): string | null {
  return findAllPlanCloseCommits(root).get(id) ?? null
}

/**
 * Resolves each SHA once per request. Any git error, missing object, shallow
 * history, or unrelated commit stays visibly pending.
 */
export function listPlanItemsWithCommitStatus(
  root: string,
  database: Database = db,
): PlanItemWithCommitStatus[] {
  const states = new Map<
    string,
    { after: Map<string, PlanItemStatus>; before: Map<string, PlanItemStatus> } | null
  >()
  const stateFor = (sha: string) => {
    if (states.has(sha)) return states.get(sha)
    if (!FULL_COMMIT_SHA.test(sha)) {
      states.set(sha, null)
      return null
    }
    if (git(root, ['rev-parse', '--verify', `${sha}^{commit}`]).exitCode !== 0) {
      states.set(sha, null)
      return null
    }
    if (git(root, ['merge-base', '--is-ancestor', sha, 'HEAD']).exitCode !== 0) {
      states.set(sha, null)
      return null
    }
    const after = git(root, ['show', `${sha}:PLAN.md`])
    if (after.exitCode !== 0) {
      states.set(sha, null)
      return null
    }
    const parent = git(root, ['rev-parse', '--verify', `${sha}^`])
    let beforeStatuses: Map<string, PlanItemStatus>
    if (parent.exitCode === 0) {
      const before = git(root, ['show', `${parent.stdout}:PLAN.md`])
      if (before.exitCode !== 0) {
        states.set(sha, null)
        return null
      }
      beforeStatuses = new Map(
        parsePlanFeatureStatus(before.stdout).map((item) => [item.id, item.status]),
      )
    } else {
      // The parent doesn't resolve locally. In a repo with full history that means `sha` is a
      // genuine root commit — the item can legitimately be born already `done`. In a truncated
      // history (`git clone --depth=1`) the parent exists upstream but was never fetched, so
      // this commit cannot prove any transition and must NOT be treated as a root.
      const shallow = git(root, ['rev-parse', '--is-shallow-repository'])
      if (shallow.exitCode === 0 && shallow.stdout === 'false') {
        beforeStatuses = new Map()
      } else {
        states.set(sha, null)
        return null
      }
    }
    const value = {
      after: new Map(parsePlanFeatureStatus(after.stdout).map((item) => [item.id, item.status])),
      before: beforeStatuses,
    }
    states.set(sha, value)
    return value
  }
  return listPlanItemsWithDeps(database).map((item) => {
    const sha = item.commitSha
    if (!sha) return { ...item, commitPending: false }
    const state = stateFor(sha)
    const confirmed = state?.after.get(item.id) === 'done' && state.before.get(item.id) !== 'done'
    return { ...item, commitPending: item.status === 'done' && !confirmed }
  })
}

export function wouldCreateDependencyCycle(
  itemId: string,
  dependsOn: string[],
  database: Database = db,
): boolean {
  if (dependsOn.includes(itemId)) return true
  const edges = database
    .query<{ item_id: string; depends_on: string }, []>(
      'SELECT item_id, depends_on FROM plan_item_deps ORDER BY item_id, depends_on',
    )
    .all()
  const graph = new Map<string, string[]>()
  for (const edge of edges) {
    if (edge.item_id === itemId) continue
    const next = graph.get(edge.item_id) ?? []
    next.push(edge.depends_on)
    graph.set(edge.item_id, next)
  }
  graph.set(itemId, dependsOn)
  const pending = [...dependsOn]
  const visited = new Set<string>()
  while (pending.length > 0) {
    const current = pending.pop()
    if (!current || visited.has(current)) continue
    if (current === itemId) return true
    visited.add(current)
    pending.push(...(graph.get(current) ?? []))
  }
  return false
}

function atomicWritePlan(path: string, content: string): void {
  const temp = join(dirname(path), `.${basename(path)}.${crypto.randomUUID()}.tmp`)
  try {
    writeFileSync(temp, content, 'utf-8')
    renameSync(temp, path)
  } finally {
    if (existsSync(temp)) unlinkSync(temp)
  }
}

/**
 * Coordinates the pending-close transition. The database transaction and filesystem restore
 * keep PLAN.md and plan_items aligned if the atomic replacement cannot complete.
 */
export function preparePlanItemClose(options: PreparePlanCloseOptions): PlanItemWithDeps {
  const database = options.database ?? db
  const planPath = join(options.root, 'PLAN.md')
  const originalPlan = readFileSync(planPath, 'utf-8')
  let wrotePlan = false
  const close = database.transaction(() => {
    const current = getPlanItem(options.id, database)
    if (!current) throw new Error(`Plan item not found: ${options.id}`)
    if (current.status === 'done') throw new Error(`Plan item is already done: ${options.id}`)
    const enriched = listPlanItemsWithDeps(database).find((item) => item.id === options.id)
    if (!enriched) throw new Error(`Plan item not found: ${options.id}`)
    if (!enriched.ready) throw new Error(`Plan item is blocked: ${options.id}`)

    const segment = database
      .query<{ position: number; text: string }, [string, string]>(
        "SELECT position, text FROM plan_doc_segments WHERE doc = ? AND kind = 'item' AND item_id = ?",
      )
      .get('PLAN.md', options.id)
    if (!segment) throw new Error(`PLAN.md segment not found: ${options.id}`)
    const openHeader = `- [ ] **${options.id} —`
    if (!segment.text.startsWith(openHeader))
      throw new Error(`PLAN.md segment is not open: ${options.id}`)
    const changedSegment = `- [x] **${options.id} —${segment.text.slice(openHeader.length)}`

    closePlanItem(options.id, options.provisionalSha, options.now, database)
    database.run("UPDATE plan_doc_segments SET text = ? WHERE doc = 'PLAN.md' AND position = ?", [
      changedSegment,
      segment.position,
    ])
    const rendered = renderPlan(database)
    ;(options.writePlan ?? atomicWritePlan)(planPath, rendered)
    wrotePlan = true
    const closed = listPlanItemsWithDeps(database).find((item) => item.id === options.id)
    if (!closed) throw new Error(`Plan item disappeared while closing: ${options.id}`)
    return closed
  })
  try {
    return close()
  } catch (error) {
    if (wrotePlan) {
      try {
        atomicWritePlan(planPath, originalPlan)
      } catch {
        // The original operation error is more actionable. The caller receives it and does not
        // report a successful transition; this branch only runs after a failed DB transaction.
      }
    }
    throw error
  }
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
