/**
 * src/config/schema.ts
 *
 * Schema for orchestos.config.yaml — project-level model routing config.
 * Each role maps to a {provider, model} pair.
 * String shorthand: "anthropic/claude-opus-4-7" → {provider:'anthropic', model:'claude-opus-4-7'}
 * Single word: "codex" → {provider:'codex', model:''}
 */

export interface ModelRoleConfig {
  provider: string // e.g. 'openrouter', 'anthropic', 'openai', 'codex'
  model: string // e.g. 'claude-opus-4-7', 'deepseek/deepseek-v3' (empty for codex)
}

/**
 * CC.D1 (Mes 29, 2026-08-17) — reemplaza `ExecutorMode` + los valores CLI de
 * `executorEngine` (que eran el mismo concepto con dos nombres: `cli-claude`↔
 * `external`, `cli-codex`↔`codex`, `cli-opencode`↔`opencode`, traducidos entre sí
 * por `resolveExecutorSelection()`). Un solo campo, guiado por el estándar real
 * de la industria — [[wiki/concepts/agent-client-protocol]] (ACP, Zed): el
 * cliente elige EL AGENTE, el agente elige su propio modelo. Ver PLAN.md §
 * Mes 29 / CC.D.
 *
 * Preferencia PERSISTENTE del usuario para tareas de build auto-creadas desde
 * el chat (D.7/G.2) y ahora también para el chat mismo (CC.1) y el harness
 * (BB.1). [[feedback-deteccion-no-decision-automatica]]: `resolveCascadeTier()`
 * (engine-cascade.ts) SOLO detecta qué hay disponible — nunca decide en nombre
 * del usuario. Este campo es la decisión real, fijada a mano; ausente = la
 * cascada sugiere un default de bootstrap (ver `cascadeTaskFields()`).
 */
export type AgentChoice = 'local' | 'claude' | 'opencode' | 'codex' | 'api'

/**
 * I.3 (Mes 30, 2026-09-04) — el requisito nuevo de Carlos: con varios proyectos
 * y varios CLIs, la asignación agente+modelo tiene que resolverse POR TAREA, no
 * solo por proyecto entero (`agent` de arriba). Esto es lo que el DAG mixto
 * Claude/Codex del dogfooding necesita ("la tarea 3 corre con Codex, la 7 con
 * Claude") — no reemplaza `agent` (que sigue siendo el último recurso antes de
 * la cascada E.16), lo precede. Reglas declarativas, nunca inferidas por un LLM
 * (misma línea no-negociable que ya cubre `agent`): se editan a mano en
 * orchestos.config.yaml, igual que `models.*` — sin UI de edición todavía,
 * deliberado (ver PLAN.md I.3).
 *
 * Matching: `output` (glob contra `Task.output`, vía Bun.Glob) tiene prioridad
 * sobre `skill` (id exacto) si una tarea matchea ambos tipos de regla — más
 * específico gana. La primera regla que matchea, en orden de declaración, se
 * usa; no hay merge de varias reglas parciales.
 */
export interface TaskAgentRule {
  match: {
    /** Glob(s) contra algún path de `Task.output` — ej. "apps/api/**". */
    output?: string[]
    /** Id exacto de skill asignada a la tarea. */
    skill?: string
  }
  agent: AgentChoice
  /** Opcional — si la regla no lo fija, resolveAgentSelection() decide el default del agente. */
  cli_effort?: string
}

export interface OrcheConfig {
  config_version: number
  models: {
    planner: ModelRoleConfig
    executor_heavy: ModelRoleConfig
    executor_light: ModelRoleConfig
    default: ModelRoleConfig
    /** Optional QA judge model — absence triggers the resolution logic in harness.ts (never same model as executor) */
    qa?: ModelRoleConfig
  }
  /** CC.D1 — ver AgentChoice arriba. Ausente = sin preferencia guardada todavía. */
  agent?: AgentChoice
  /** I.3 — ver TaskAgentRule arriba. Ausente/vacío = sin reglas, se salta este paso. */
  taskAgentRules?: TaskAgentRule[]
  /** If true, every task must have an approved spec before it can run */
  requireSpec?: boolean
  /**
   * CC.D1 — antes vivía dentro de `executorEngine` (`single-shot`/`agentic`),
   * mezclado con los valores CLI. Renombrado y acotado: solo tiene sentido
   * cuando `agent` es `'api'` (o ausente) — un CLI no expone esta distinción,
   * la decide el binario. Absencia = `'single-shot'` (G.3, opt-in), cero
   * cambio de comportamiento para lo existente.
   */
  apiMode?: 'single-shot' | 'agentic'
  /** Agentic engine tuning — absence means default (maxIterations: 15). No cost cap by design (see docs/executor-engine-design.md §3). */
  agentic?: { maxIterations?: number }
  /** B.2 — External engine tuning. timeoutMs = wall-clock guarantee of termination (no cost cap by design, same as maxIterations). Absence = default in external.ts (20min, see docs §4). */
  external?: { timeoutMs?: number }
  /**
   * K.4b — segundo juez adversarial DESPUÉS de que el QA normal dé pass, ANTES del merge.
   * Reusa el mismo qaJudge (modelo/provider) ya resuelto — no agrega selección de modelo
   * nueva. Opt-in porque dobla el costo de QA por tarea que pasa; absencia = desactivado
   * (comportamiento actual, sin cambios). Ver PLAN.md § K.4b.
   */
  adversarialQA?: boolean
  /**
   * X.2 (IDEAS #33) — refuter barato DESPUÉS de que el QA normal dé fail, ANTES de consumir un
   * retry. Mirror asimétrico de adversarialQA: ese ataca falsos-positivos en el lado `pass`, este
   * ataca falsos-negativos en el lado `fail` (evidencia real: DONE.md gate D.1). Opt-in porque
   * agrega una llamada de QA extra a cada fail; absencia = desactivado (comportamiento actual,
   * sin cambios). Ver PLAN.md § Mes 27 Bloque X.
   */
  refuterQA?: boolean
}

// Defaults — used when no config file is found or a role is missing
export const DEFAULT_CONFIG: OrcheConfig = {
  config_version: 1,
  models: {
    planner: { provider: 'openrouter', model: 'deepseek/deepseek-v4-flash' },
    executor_heavy: { provider: 'openrouter', model: 'deepseek/deepseek-v4-flash' },
    executor_light: { provider: 'openrouter', model: 'deepseek/deepseek-v4-flash' },
    default: { provider: 'openrouter', model: 'deepseek/deepseek-v4-flash' },
  },
}

/**
 * Parse a role value from YAML — accepts string shorthand or object form.
 * "anthropic/claude-opus-4-7" → {provider:'anthropic', model:'claude-opus-4-7'}
 * "codex"                     → {provider:'codex', model:''}
 * {provider:'anthropic', model:'claude-opus-4-7'} → as-is
 */
export function parseRoleValue(value: unknown, fallback: ModelRoleConfig): ModelRoleConfig {
  if (value === undefined || value === null) return fallback

  if (typeof value === 'string') {
    const slash = value.indexOf('/')
    if (slash === -1) {
      // single word → treat as provider name (e.g. "codex")
      return { provider: value, model: '' }
    }
    return { provider: value.slice(0, slash), model: value.slice(slash + 1) }
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>
    return {
      provider: typeof obj.provider === 'string' ? obj.provider : fallback.provider,
      model: typeof obj.model === 'string' ? obj.model : fallback.model,
    }
  }

  return fallback
}
