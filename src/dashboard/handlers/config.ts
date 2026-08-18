import { join } from 'path'
import { existsSync, writeFileSync } from 'fs'
import { parseDocument, stringify as yamlStringify } from 'yaml'
import { loadOrcheConfig, scaffoldConfigYaml, AGENT_CHOICES } from '../../config/load.ts'
import type { OrcheConfig, AgentChoice } from '../../config/schema.ts'
import { loadTasks, tasksExist } from '../../tasks/loader.ts'
import { autoRoute, formatRoute } from '../../router/auto-route.ts'
import { findClaudeBinary } from '../../run/executors/external.ts'
import { jsonResponse, errorResponse } from '../http.ts'

// CC.D1 (2026-08-17) — `apiMode` solo tiene sentido cuando `agent` es 'api' (o
// ausente): un CLI no expone la distinción single-shot/agentic, la decide el
// binario. Antes esto vivía mezclado dentro de `executorEngine` junto con los
// valores CLI (external/opencode/codex) — separado ahora, ver schema.ts.
const API_MODES = ['single-shot', 'agentic'] as const

const ROLE_KEYS = ['planner', 'executor_heavy', 'executor_light', 'default', 'qa'] as const

// E.9 (Mes 18, paridad CLI↔Dashboard) — equivalente de `orchestos config show`:
// fuente activa (orchestos.config.yaml vs defaults), roles resueltos, y preview
// de routing para tareas pendientes (mismo autoRoute() que usa el harness real).
export async function handleApiConfigGet(root = process.cwd()): Promise<Response> {
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

  // Bug real encontrado en vivo (2026-07-27, verificando H.4): una tasks.yaml
  // con una sola tarea malformada (ej. `output: []`) tiraba `loadTasks()` sin
  // atrapar, y ESE throw tumbaba el endpoint ENTERO con 500 — Settings
  // dejaba de cargar por completo (routing, executor, todo). Mismo patrón de
  // resiliencia que ya usa `handleApiTasks()` (dashboard/handlers/tasks.ts):
  // el preview de routing es un extra, nunca debe poder romper el config.
  let pendingRouting: Array<{ id: string; model: string; executor: string }> = []
  if (tasksExist(root)) {
    try {
      const tasksFile = loadTasks(root)
      const pending = tasksFile.tasks.filter(t => t.status === 'pending')
      pendingRouting = pending.map(t => {
        const route = autoRoute(t, cfg, configFound)
        const modelStr = route ? formatRoute(route) : `${t.executor} (legacy)`
        return { id: t.id, model: modelStr, executor: t.executor }
      })
    } catch {
      // tasks.yaml malformado — el resto del config sigue siendo válido y se
      // devuelve igual; el preview de routing queda vacío en vez de 500.
    }
  }

  return jsonResponse({
    source: configFound ? configPath : null,
    configFound,
    roles,
    pendingRouting,
    // CC.D1 (2026-08-17) — `executorEngine` renombrado a `apiMode` (solo aplica
    // cuando `agent` es 'api'/ausente). `executor_mode` renombrado a `agent`.
    apiMode: cfg.apiMode ?? 'single-shot',
    // CC.1b bugfix (2026-08-17) — hallazgo real de Carlos: bajó el server varias
    // veces y el selector de esfuerzo del chat seguía mostrando 3 niveles en vez
    // de 5. Causa real: este endpoint nunca devolvía la preferencia de agente —
    // el PUT (más abajo) sí la escribía al YAML, pero el GET no la leía de
    // vuelta. El label de la respuesta del chat SÍ reflejaba el CLI (ese código
    // lee loadOrcheConfig() directo en el servidor, sin pasar por este
    // endpoint) — pero el frontend (buildChatModelFx) depende de `/api/config`
    // para saber el agente activo, así que quedaba `undefined` ahí siempre, sin
    // importar cuántas veces se reiniciara el servidor.
    agent: cfg.agent ?? null,
    agenticMaxIterations: cfg.agentic?.maxIterations ?? 15,
    externalTimeoutMinutes: Math.round((cfg.external?.timeoutMs ?? 20 * 60 * 1000) / 60000),
    claudeCliDetected: findClaudeBinary() !== null,
  })
}

// E.9 — equivalente de `orchestos config init`: crea orchestos.config.yaml con
// el scaffold de siempre. 409 si ya existe (mismo comportamiento que la CLI,
// que hace process.exit(1) en vez de sobreescribir en silencio).
export async function handleApiConfigInit(root = process.cwd()): Promise<Response> {
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
export async function handleApiConfigSet(req: Request, root = process.cwd()): Promise<Response> {
  let body: {
    roles?: Record<string, string>
    apiMode?: string
    agenticMaxIterations?: number
    externalTimeoutMinutes?: number
    /** CC.D1 (era G.4.4, `executorMode`) — preferencia persistente de agente. `null`
     * limpia la preferencia guardada (vuelve a "Auto" — la cascada sugiere, ver
     * [[feedback-deteccion-no-decision-automatica]]). */
    agent?: AgentChoice | null
  }
  try { body = (await req.json()) as typeof body } catch { return errorResponse('Invalid JSON', 400) }
  if (body.roles !== undefined && typeof body.roles !== 'object') return errorResponse('roles must be an object', 400)
  if (body.agent !== undefined && body.agent !== null && !AGENT_CHOICES.includes(body.agent)) {
    return errorResponse(`agent must be one of: ${AGENT_CHOICES.join(', ')}`, 400)
  }
  if (!body.roles && body.apiMode === undefined && body.agenticMaxIterations === undefined && body.externalTimeoutMinutes === undefined && body.agent === undefined) {
    return errorResponse('nothing to save', 400)
  }

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

  if (typeof body.apiMode === 'string' && (API_MODES as readonly string[]).includes(body.apiMode)) {
    newConfig.apiMode = body.apiMode as OrcheConfig['apiMode']
  }
  if (typeof body.agenticMaxIterations === 'number' && Number.isFinite(body.agenticMaxIterations) && body.agenticMaxIterations > 0) {
    newConfig.agentic = { maxIterations: Math.round(body.agenticMaxIterations) }
  }
  if (typeof body.externalTimeoutMinutes === 'number' && Number.isFinite(body.externalTimeoutMinutes) && body.externalTimeoutMinutes > 0) {
    newConfig.external = { timeoutMs: Math.round(body.externalTimeoutMinutes * 60000) }
  }
  if (body.agent === null) {
    delete newConfig.agent
  } else if (body.agent !== undefined) {
    newConfig.agent = body.agent
  }

  // CC.D1c (2026-08-18) — `loadOrcheConfig()` migra los nombres legacy en
  // memoria. Serializar `newConfig` directamente después de cargarlo hacía
  // que cualquier PUT (incluso un cambio de roles no relacionado) reescribiera
  // todo el YAML, borrara campos desconocidos y limpiara silenciosamente
  // `executor_mode`/`executorEngine`. Editar el documento existente por rutas
  // concretas conserva el resto del archivo y deja la migración explícita.
  let output = yamlStringify(newConfig)
  if (existsSync(configPath)) {
    try {
      const document = parseDocument(await Bun.file(configPath).text())
      if (document.errors.length === 0) {
        for (const key of ROLE_KEYS) {
          const raw = body.roles?.[key]
          if (typeof raw !== 'string') continue
          if (!raw.trim()) {
            if (key === 'qa') document.deleteIn(['models', key])
            continue
          }
          document.setIn(['models', key], { provider: 'openrouter', model: raw.trim() })
        }

        if (typeof body.apiMode === 'string' && (API_MODES as readonly string[]).includes(body.apiMode)) {
          document.set('apiMode', body.apiMode)
          // `executorEngine` used these values before apiMode existed. Remove
          // only that legacy field when the user explicitly edits apiMode;
          // CLI values there belong to the separate agent migration.
          const legacyEngine = document.get('executorEngine')
          if (legacyEngine === 'single-shot' || legacyEngine === 'agentic') document.delete('executorEngine')
        }
        if (typeof body.agenticMaxIterations === 'number' && Number.isFinite(body.agenticMaxIterations) && body.agenticMaxIterations > 0) {
          document.setIn(['agentic', 'maxIterations'], Math.round(body.agenticMaxIterations))
        }
        if (typeof body.externalTimeoutMinutes === 'number' && Number.isFinite(body.externalTimeoutMinutes) && body.externalTimeoutMinutes > 0) {
          document.setIn(['external', 'timeoutMs'], Math.round(body.externalTimeoutMinutes * 60000))
        }
        if (body.agent === null || body.agent !== undefined) {
          if (body.agent === null) document.delete('agent')
          else document.set('agent', body.agent)
          // The user explicitly touched the canonical agent field, so this is
          // the one case where cleaning its legacy aliases is intentional.
          document.delete('executor_mode')
          document.delete('executorEngine')
        }
        output = document.toString()
      }
    } catch {
      // Invalid existing YAML keeps the previous safe behavior: write the
      // validated, fully resolved configuration instead of failing silently.
    }
  }
  writeFileSync(configPath, output, 'utf8')
  return jsonResponse({ ok: true })
}
