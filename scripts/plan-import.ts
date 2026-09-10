import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { runMigrations } from '../src/db/migrate.ts'
import { findAllPlanTransitionCommits, getPlanItem, upsertPlanItem } from '../src/db/plan-items.ts'
import { db } from '../src/db/sqlite.ts'
import {
  type PlanItemSource,
  parsePlanDocumentSegments,
  parsePlanItemSources,
} from './plan-status.ts'

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

function gitHead(root: string): string | null {
  const result = Bun.spawnSync(['git', 'rev-parse', 'HEAD'], { cwd: root, stdout: 'pipe' })
  const sha = new TextDecoder().decode(result.stdout).trim()
  return result.exitCode === 0 && sha ? sha : null
}

/**
 * S.6a part C found this the hard way: the pre-commit hook's `plan:render --check` expects
 * `plan_doc_segments` to already reflect the staged PLAN.md, which means reconcile has to run
 * BEFORE the closing commit exists — but a proof of that commit cannot exist yet either. The
 * fix distinguishes two cases instead of one blanket rule:
 *   - an item transitioning open→done in THIS very call has no history to prove — it gets the
 *     same provisional `git rev-parse HEAD` that `preparePlanItemClose()` already writes for the
 *     dashboard's own prepare-close flow, and `listPlanItemsWithCommitStatus()` correctly shows
 *     it as `commitPending` until a later reconcile (after the real commit) confirms it;
 *   - an item that was ALREADY `done` before this call must still prove its stored SHA — this is
 *     the guarantee the fix was for or actually about: no more inventing a fresh HEAD for a
 *     historical close whose commit doesn't say so, which is what let a false claim through
 *     undetected before (see PLAN.md's Bloque S evidence for S.6a).
 */
function commitShaFor(
  item: PlanItemSource,
  closeCommits: Map<string, string>,
  reopenedAfterLatestClose: Set<string>,
  allowProvisional: boolean,
  root: string,
): string {
  const sha = closeCommits.get(item.id)
  if (sha && !reopenedAfterLatestClose.has(item.id)) return sha
  if (allowProvisional) {
    const provisional = gitHead(root)
    if (provisional) return provisional
  }
  throw new Error(`Could not prove a closing commit SHA for ${item.id}`)
}

interface ImportResult {
  count: number
  deletedIds: string[]
}

function importSources(sources: PlanItemSource[], root: string, reconcile: boolean): ImportResult {
  const plan = readFileSync(join(root, 'PLAN.md'), 'utf-8')
  const segments = parsePlanDocumentSegments(plan)
  const roundTrip = segments.map((segment) => segment.text).join('')
  if (roundTrip !== plan) throw new Error('PLAN.md segment round-trip is not byte-exact')

  // Resolved once for every item instead of once per item — see findAllPlanTransitionCommits.
  const { closeCommits, reopenedAfterLatestClose } = findAllPlanTransitionCommits(root)
  const importAll = db.transaction(() => {
    for (const item of sources) {
      const body = item.evidenceHref ? bodyFromEvidence(root, item.evidenceHref) : item.body
      if (item.status === 'done' && !body.trim()) {
        throw new Error(`Closed plan item ${item.id} has an empty body`)
      }
      // Provisional-HEAD is only for the reconcile-before-commit workflow, and only for an
      // item this very call is newly closing — never for the one-time seed import, and never
      // for an item that was already `done` (that must always prove its stored commit).
      const wasAlreadyDone = getPlanItem(item.id, db)?.status === 'done'
      const allowProvisional = reconcile && !wasAlreadyDone
      upsertPlanItem(
        {
          id: item.id,
          sprint: item.sprint ?? '',
          block: item.block,
          delegation: item.delegation,
          title: item.title,
          body,
          status: item.status,
          commitSha:
            item.status === 'done'
              ? commitShaFor(item, closeCommits, reopenedAfterLatestClose, allowProvisional, root)
              : null,
          closedAt: item.closedDate,
          position: item.position,
        },
        db,
      )
    }

    if (!reconcile) return []

    db.run("DELETE FROM plan_doc_segments WHERE doc = 'PLAN.md'")
    for (const segment of segments) {
      db.run(
        `INSERT INTO plan_doc_segments (doc, position, kind, text, item_id)
         VALUES (?, ?, ?, ?, ?)`,
        [segment.doc, segment.position, segment.kind, segment.text, segment.itemId],
      )
    }

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
