import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parse, stringify } from 'yaml'
import { loadOrcheConfig } from '../../config/load.ts'
import { db } from '../../db/sqlite.ts'
import { detectInstalledClis, KNOWN_CLIS } from '../../run/executors/cli-registry.ts'
import { readBudget } from '../../run/orchestration-budget.ts'
import { errorResponse, jsonResponse } from '../http.ts'

export function handleApiOrchestrationGet(root: string, projectId?: string | null): Response {
  const config = loadOrcheConfig(root).orchestration ?? { enabled: false }
  const parent = db
    .query<{ parent_task_id: string }, [string | null]>(
      'SELECT parent_task_id FROM orchestration_runs WHERE project_id IS ? ORDER BY updated_at DESC LIMIT 1',
    )
    .get(projectId ?? null)
  const budget = parent
    ? db
        .query<{ run_id: string; created_at: string }, [string | null, string]>(
          'SELECT run_id,created_at FROM orchestration_runs WHERE project_id IS ? AND parent_task_id=? ORDER BY updated_at DESC LIMIT 1',
        )
        .get(projectId ?? null, parent.parent_task_id)
    : null
  const current = budget ? readBudget(budget.run_id) : null
  const extraCalls = [
    {
      id: 'planner',
      label: 'Planner (auto-split)',
      active: config.enabled,
      reason: config.enabled ? 'solo al superar el umbral de salida' : 'auto-split omitido con OFF',
    },
    { id: 'qa', label: 'QA', active: true, reason: 'validación de tareas' },
    {
      id: 'adversarialQA',
      label: 'QA adversarial',
      active: loadOrcheConfig(root).adversarialQA === true,
      reason: 'segundo juez opcional',
    },
    {
      id: 'refuterQA',
      label: 'QA refuter',
      active: loadOrcheConfig(root).refuterQA === true,
      reason: 'revisión opcional tras QA fallido',
    },
    { id: 'retries', label: 'Retries', active: true, reason: 'máximo por tarea: 3' },
  ]
  let usage: { tokens: number; usd: number } | null = null
  if (parent) {
    const planPath = join(root, `${parent.parent_task_id}.plan.yaml`)
    if (existsSync(planPath)) {
      try {
        const plan = parse(readFileSync(planPath, 'utf8')) as { sub_tasks?: { id?: string }[] }
        const ids = (plan.sub_tasks ?? [])
          .map((task) => task.id)
          .filter((id): id is string => typeof id === 'string')
        if (ids.length) {
          const placeholders = ids.map(() => '?').join(',')
          const rows = db
            .query<
              {
                input_tokens: number | null
                output_tokens: number | null
                usd_cost: number | null
              },
              (string | null)[]
            >(
              `SELECT input_tokens,output_tokens,usd_cost FROM runs WHERE project_id IS ? AND created_at >= ? AND task_id IN (${placeholders})`,
            )
            .all(projectId ?? null, budget?.created_at ?? new Date().toISOString(), ...ids)
          if (rows.length)
            usage = {
              tokens: rows.reduce((n, r) => n + (r.input_tokens ?? 0) + (r.output_tokens ?? 0), 0),
              usd: rows.reduce((n, r) => n + (r.usd_cost ?? 0), 0),
            }
        }
      } catch {
        /* malformed plan or absent child run data stays unknown */
      }
    }
  }
  return jsonResponse({
    ...config,
    current,
    usage,
    extraCalls,
    adapters: detectInstalledClis()
      .filter((cli) => cli.installed)
      .map((cli) => ({
        id: cli.id,
        label: cli.label,
        subagentBlock:
          KNOWN_CLIS.find((def) => def.id === cli.id)?.subagentBlock === 'not-guaranteed'
            ? 'no garantizado'
            : 'garantizado',
      })),
  })
}

export async function handleApiOrchestrationSet(req: Request, root: string): Promise<Response> {
  let body: { enabled?: unknown; maxConcurrent?: unknown; maxTotal?: unknown }
  try {
    body = await req.json()
  } catch {
    return errorResponse('Invalid JSON', 400)
  }
  if (typeof body.enabled !== 'boolean') return errorResponse('enabled must be boolean', 400)
  if (
    body.enabled &&
    (!Number.isInteger(body.maxConcurrent) ||
      Number(body.maxConcurrent) < 1 ||
      !Number.isInteger(body.maxTotal) ||
      Number(body.maxTotal) < 1)
  )
    return errorResponse('maxConcurrent and maxTotal are required integers >= 1 when enabled', 400)
  const path = join(root, 'orchestos.config.yaml')
  let raw: Record<string, unknown> = {}
  if (existsSync(path)) {
    try {
      raw = parse(readFileSync(path, 'utf8')) as Record<string, unknown>
    } catch {
      return errorResponse('orchestos.config.yaml is invalid', 400)
    }
  }
  raw.orchestration = body.enabled
    ? { enabled: true, maxConcurrent: body.maxConcurrent, maxTotal: body.maxTotal }
    : { enabled: false }
  writeFileSync(path, stringify(raw), 'utf8')
  try {
    loadOrcheConfig(root)
  } catch (error) {
    return errorResponse((error as Error).message, 400)
  }
  return jsonResponse({ ok: true, orchestration: raw.orchestration })
}
