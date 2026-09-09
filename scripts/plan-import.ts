import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { runMigrations } from '../src/db/migrate.ts'
import { upsertPlanItem } from '../src/db/plan-items.ts'
import { db } from '../src/db/sqlite.ts'
import { type PlanItemSource, parsePlanItemSources } from './plan-status.ts'

function bodyFromEvidence(root: string, href: string): string {
  const [relativePath, anchor] = href.split('#', 2)
  if (!relativePath || !anchor)
    throw new Error(`Evidence link must include a file and anchor: ${href}`)
  const path = join(root, relativePath)
  if (!existsSync(path)) throw new Error(`Evidence file not found: ${path}`)
  const text = readFileSync(path, 'utf-8')
  const marker = `<a id="${anchor}"></a>`
  const start = text.indexOf(marker)
  if (start === -1) throw new Error(`Evidence anchor not found: ${href}`)
  const next = text.indexOf('<a id="', start + marker.length)
  return text.slice(start, next === -1 ? text.length : next).trim()
}

function commitShaFor(item: PlanItemSource, root: string): string {
  const search = Bun.spawnSync(
    ['git', 'log', '--format=%H', '-S', `- [x] **${item.id} —`, '--', 'PLAN.md'],
    {
      cwd: root,
      stdout: 'pipe',
      stderr: 'pipe',
    },
  )
  const sha = new TextDecoder().decode(search.stdout).trim().split('\n')[0]
  if (search.exitCode === 0 && sha) return sha

  const head = Bun.spawnSync(['git', 'rev-parse', 'HEAD'], {
    cwd: root,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const fallback = new TextDecoder().decode(head.stdout).trim()
  if (head.exitCode !== 0 || !fallback)
    throw new Error(`Could not determine fallback commit SHA for ${item.id}`)
  return fallback
}

interface ImportResult {
  count: number
  deletedIds: string[]
}

function importSources(sources: PlanItemSource[], root: string, reconcile: boolean): ImportResult {
  const importAll = db.transaction(() => {
    for (const item of sources) {
      const body = item.evidenceHref ? bodyFromEvidence(root, item.evidenceHref) : item.body
      if (item.status === 'done' && !body.trim()) {
        throw new Error(`Closed plan item ${item.id} has an empty body`)
      }
      upsertPlanItem(
        {
          id: item.id,
          sprint: item.sprint ?? '',
          block: item.block,
          delegation: item.delegation,
          title: item.title,
          body,
          status: item.status,
          commitSha: item.status === 'done' ? commitShaFor(item, root) : null,
          closedAt: item.closedDate,
          position: item.position,
        },
        db,
      )
    }

    if (!reconcile) return []

    const sourceIds = new Set(sources.map((item) => item.id))
    const orphanIds = db
      .query<{ id: string }, []>('SELECT id FROM plan_items')
      .all()
      .map((item) => item.id)
      .filter((id) => !sourceIds.has(id))
    for (const id of orphanIds) db.run('DELETE FROM plan_items WHERE id = ?', [id])
    return orphanIds
  })
  return { count: sources.length, deletedIds: importAll() }
}

function importPlanWithResult(root: string, reconcile: boolean): ImportResult {
  const plan = readFileSync(join(root, 'PLAN.md'), 'utf-8')
  const sources = parsePlanItemSources(plan)
  const existing =
    db.query<{ count: number }, []>('SELECT COUNT(*) AS count FROM plan_items').get()?.count ?? 0
  if (!reconcile && existing !== 0)
    throw new Error('plan_items is already seeded; plan import runs once')

  return importSources(sources, root, reconcile)
}

export function importPlan(root: string = process.cwd(), reconcile = false): number {
  return importPlanWithResult(root, reconcile).count
}

if (import.meta.main) {
  runMigrations()
  const reconcile = Bun.argv.includes('--reconcile')
  const result = importPlanWithResult(process.cwd(), reconcile)
  console.log(`✓ ${result.count} plan items ${reconcile ? 'reconciled' : 'imported'} from PLAN.md`)
  if (reconcile) {
    console.log(
      `✓ ${result.deletedIds.length} orphan plan items deleted: ${result.deletedIds.join(', ') || '(none)'}`,
    )
  }
}
