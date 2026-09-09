import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderPlan } from '../../db/plan-doc.ts'
import {
  getPlanItem,
  listPlanItemsWithDeps,
  preparePlanItemClose,
  setDeps,
  wouldCreateDependencyCycle,
} from '../../db/plan-items.ts'
import { db } from '../../db/sqlite.ts'
import { errorResponse, jsonResponse, validateTaskId } from '../http.ts'
import type { PlanItemRow, PlanListResponse, PreparePlanCloseResponse } from '../types.ts'

function currentPlan(root: string): string | Response {
  const path = join(root, 'PLAN.md')
  if (!existsSync(path)) return errorResponse('PLAN.md not found for this project', 409)
  const onDisk = readFileSync(path, 'utf-8')
  let rendered: string
  try {
    rendered = renderPlan(db)
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : String(error), 409)
  }
  if (onDisk !== rendered)
    return errorResponse('PLAN.md is out of sync with the plan database', 409)
  return onDisk
}

function itemIdFromPath(req: Request, suffix: string): string | null {
  const pathname = new URL(req.url).pathname
  const prefix = '/api/plan/items/'
  if (!pathname.startsWith(prefix) || !pathname.endsWith(suffix)) return null
  return decodeURIComponent(pathname.slice(prefix.length, -suffix.length))
}

function planResponse(): PlanListResponse {
  return { items: listPlanItemsWithDeps(db) as PlanItemRow[] }
}

export function handleApiPlan(root: string): Response {
  const consistent = currentPlan(root)
  if (consistent instanceof Response) return consistent
  return jsonResponse(planResponse())
}

export async function handleApiPlanDependencies(req: Request, root: string): Promise<Response> {
  const consistent = currentPlan(root)
  if (consistent instanceof Response) return consistent
  const rawId = itemIdFromPath(req, '/dependencies')
  const id = rawId ? validateTaskId(rawId) : null
  if (!id) return errorResponse('Invalid plan item id', 400)

  let body: { dependsOn?: unknown }
  try {
    body = (await req.json()) as { dependsOn?: unknown }
  } catch {
    return errorResponse('Invalid JSON', 400)
  }
  if (!Array.isArray(body.dependsOn) || !body.dependsOn.every((dep) => typeof dep === 'string'))
    return errorResponse('dependsOn must be an array of ids', 400)
  const dependsOn = body.dependsOn.map((dep) => dep.trim())
  if (new Set(dependsOn).size !== dependsOn.length)
    return errorResponse('dependsOn must contain unique ids', 400)
  if (dependsOn.some((dep) => !validateTaskId(dep)))
    return errorResponse('dependsOn contains an invalid id', 400)

  const item = getPlanItem(id, db)
  if (!item) return errorResponse(`Plan item not found: ${id}`, 404)
  if (item.status === 'done') return errorResponse(`Plan item is already done: ${id}`, 409)
  const missing = dependsOn.find((dependency) => !getPlanItem(dependency, db))
  if (missing) return errorResponse(`Plan item not found: ${missing}`, 404)
  if (dependsOn.includes(id)) return errorResponse('A plan item cannot depend on itself', 409)
  if (wouldCreateDependencyCycle(id, dependsOn, db))
    return errorResponse('Dependencies would create a cycle', 409)

  setDeps(id, dependsOn, db)
  const updated = listPlanItemsWithDeps(db).find((candidate) => candidate.id === id)
  if (!updated) return errorResponse(`Plan item not found: ${id}`, 404)
  return jsonResponse(updated satisfies PlanItemRow)
}

function gitHead(root: string): string | null {
  const result = Bun.spawnSync(['git', 'rev-parse', 'HEAD'], {
    cwd: root,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const sha = new TextDecoder().decode(result.stdout).trim()
  return result.exitCode === 0 && sha ? sha : null
}

export function handleApiPlanPrepareClose(req: Request, root: string): Response {
  const consistent = currentPlan(root)
  if (consistent instanceof Response) return consistent
  const rawId = itemIdFromPath(req, '/prepare-close')
  const id = rawId ? validateTaskId(rawId) : null
  if (!id) return errorResponse('Invalid plan item id', 400)
  const item = getPlanItem(id, db)
  if (!item) return errorResponse(`Plan item not found: ${id}`, 404)
  if (item.status === 'done') return errorResponse(`Plan item is already done: ${id}`, 409)
  const enriched = listPlanItemsWithDeps(db).find((candidate) => candidate.id === id)
  if (!enriched?.ready) return errorResponse(`Plan item is blocked: ${id}`, 409)
  const provisionalSha = gitHead(root)
  if (!provisionalSha) return errorResponse('Could not resolve the current Git HEAD', 500)
  try {
    const closed = preparePlanItemClose({
      id,
      root,
      provisionalSha,
      now: new Date().toISOString(),
      database: db,
    })
    const response: PreparePlanCloseResponse = { item: closed, commitPending: true }
    return jsonResponse(response)
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : String(error), 500)
  }
}
