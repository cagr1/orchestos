import { resolve, join } from 'path'
import { existsSync, writeFileSync } from 'fs'
import { stringify as yamlStringify } from 'yaml'
import { loadOrcheConfig, scaffoldConfigYaml } from '../../config/load.ts'
import type { OrcheConfig } from '../../config/schema.ts'
import { loadTasks, tasksExist } from '../../tasks/loader.ts'
import { autoRoute, formatRoute } from '../../router/auto-route.ts'
import { findClaudeBinary } from '../../run/executors/external.ts'
import { jsonResponse, errorResponse } from '../http.ts'

const EXECUTOR_ENGINES = ['single-shot', 'agentic', 'external'] as const

const ROLE_KEYS = ['planner', 'executor_heavy', 'executor_light', 'default', 'qa'] as const

// E.9 (Mes 18, paridad CLI↔Dashboard) — equivalente de `orchestos config show`:
// fuente activa (orchestos.config.yaml vs defaults), roles resueltos, y preview
// de routing para tareas pendientes (mismo autoRoute() que usa el harness real).
export async function handleApiConfigGet(): Promise<Response> {
  const root = resolve('.')
  const configPath = join(root, 'orchestos.config.yaml')
  const configFound = existsSync(configPath)
  const cfg = loadOrcheConfig(root)

  const roles = {
    planner: `${cfg.models.planner.provider}/${cfg.models.planner.model || '(self)'}`,
    executor_heavy: `${cfg.models.executor_heavy.provider}/${cfg.models.executor_heavy.model || '(self)'}`,
    executor_light: `${cfg.models.executor_light.provider}/${cfg.models.executor_light.model || '(self)'}`,
    default: `${cfg.models.default.provider}/${cfg.models.default.model || '(self)'}`,
    qa: cfg.models.qa ? `${cfg.models.qa.provider}/${cfg.models.qa.model || '(self)'}` : null,
  }

  let pendingRouting: Array<{ id: string; model: string; executor: string }> = []
  if (tasksExist(root)) {
    const tasksFile = loadTasks(root)
    const pending = tasksFile.tasks.filter(t => t.status === 'pending')
    pendingRouting = pending.map(t => {
      const route = autoRoute(t, cfg, configFound)
      const modelStr = route ? formatRoute(route) : `${t.executor} (legacy)`
      return { id: t.id, model: modelStr, executor: t.executor }
    })
  }

  return jsonResponse({
    source: configFound ? configPath : null,
    configFound,
    roles,
    pendingRouting,
    executorEngine: cfg.executorEngine ?? 'single-shot',
    agenticMaxIterations: cfg.agentic?.maxIterations ?? 15,
    externalTimeoutMinutes: Math.round((cfg.external?.timeoutMs ?? 20 * 60 * 1000) / 60000),
    claudeCliDetected: findClaudeBinary() !== null,
  })
}

// E.9 — equivalente de `orchestos config init`: crea orchestos.config.yaml con
// el scaffold de siempre. 409 si ya existe (mismo comportamiento que la CLI,
// que hace process.exit(1) en vez de sobreescribir en silencio).
export async function handleApiConfigInit(): Promise<Response> {
  const root = resolve('.')
  const configPath = join(root, 'orchestos.config.yaml')
  if (existsSync(configPath)) {
    return errorResponse('orchestos.config.yaml already exists', 409)
  }
  writeFileSync(configPath, scaffoldConfigYaml(), 'utf8')
  return jsonResponse({ ok: true, path: configPath })
}

// Fix real (2026-07-08): Carlos notó que la vista de roles en Settings era de
// solo lectura — ni la CLI (config init/show) ni el dashboard tenían forma de
// CAMBIAR el modelo por rol, solo mostrarlo. Este endpoint escribe directo a
// orchestos.config.yaml (lo crea si no existía, mismo efecto que config init
// pero ya con los roles elegidos en vez del scaffold default). Siempre asume
// provider 'openrouter' — igual que el resto del selector de modelos en la
// app (chat, composer de tareas, diagnose), ninguno expone otros providers.
export async function handleApiConfigSet(req: Request): Promise<Response> {
  let body: {
    roles?: Record<string, string>
    executorEngine?: string
    agenticMaxIterations?: number
    externalTimeoutMinutes?: number
  }
  try { body = (await req.json()) as typeof body } catch { return errorResponse('Invalid JSON', 400) }
  if (body.roles !== undefined && typeof body.roles !== 'object') return errorResponse('roles must be an object', 400)
  if (!body.roles && body.executorEngine === undefined && body.agenticMaxIterations === undefined && body.externalTimeoutMinutes === undefined) {
    return errorResponse('nothing to save', 400)
  }

  const root = resolve('.')
  const configPath = join(root, 'orchestos.config.yaml')
  const current = loadOrcheConfig(root)
  const models: OrcheConfig['models'] = { ...current.models }

  for (const key of ROLE_KEYS) {
    const raw = body.roles?.[key]
    if (typeof raw !== 'string') continue
    // qa es el único rol legítimamente "sin configurar" (harness.ts lo
    // auto-resuelve si está ausente, nunca el mismo modelo que el executor).
    // Un string vacío para qa es una limpieza explícita, no "no tocar" —
    // para el resto de los roles un vacío se ignora (nunca deben quedar sin valor).
    if (!raw.trim()) {
      if (key === 'qa') delete models.qa
      continue
    }
    models[key] = { provider: 'openrouter', model: raw.trim() }
  }

  const newConfig: OrcheConfig = { ...current, models }

  if (typeof body.executorEngine === 'string' && (EXECUTOR_ENGINES as readonly string[]).includes(body.executorEngine)) {
    newConfig.executorEngine = body.executorEngine as OrcheConfig['executorEngine']
  }
  if (typeof body.agenticMaxIterations === 'number' && Number.isFinite(body.agenticMaxIterations) && body.agenticMaxIterations > 0) {
    newConfig.agentic = { maxIterations: Math.round(body.agenticMaxIterations) }
  }
  if (typeof body.externalTimeoutMinutes === 'number' && Number.isFinite(body.externalTimeoutMinutes) && body.externalTimeoutMinutes > 0) {
    newConfig.external = { timeoutMs: Math.round(body.externalTimeoutMinutes * 60000) }
  }

  writeFileSync(configPath, yamlStringify(newConfig), 'utf8')
  return jsonResponse({ ok: true })
}
