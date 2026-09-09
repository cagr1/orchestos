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

export function importPlan(root: string = process.cwd()): number {
  const plan = readFileSync(join(root, 'PLAN.md'), 'utf-8')
  const sources = parsePlanItemSources(plan)
  const existing =
    db.query<{ count: number }, []>('SELECT COUNT(*) AS count FROM plan_items').get()?.count ?? 0
  if (existing !== 0) throw new Error('plan_items is already seeded; plan import runs once')

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
  })
  importAll()
  return sources.length
}

if (import.meta.main) {
  runMigrations()
  const count = importPlan()
  console.log(`✓ ${count} plan items imported from PLAN.md`)
}
