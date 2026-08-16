/**
 * src/config/schema.ts
 *
 * Schema for orchestos.config.yaml — project-level model routing config.
 * Each role maps to a {provider, model} pair.
 * String shorthand: "anthropic/claude-opus-4-7" → {provider:'anthropic', model:'claude-opus-4-7'}
 * Single word: "codex" → {provider:'codex', model:''}
 */

export interface ModelRoleConfig {
  provider: string   // e.g. 'openrouter', 'anthropic', 'openai', 'codex'
  model: string      // e.g. 'claude-opus-4-7', 'deepseek/deepseek-v3' (empty for codex)
}

/**
 * G.4.1 — preferencia PERSISTENTE del usuario para tareas de build auto-creadas
 * desde el chat (D.7/G.2). [[feedback-deteccion-no-decision-automatica]]:
 * `resolveCascadeTier()` (engine-cascade.ts) SOLO detecta qué hay disponible —
 * nunca decide en nombre del usuario. Este campo es la decisión real, fijada
 * a mano; ausente (undefined) = comportamiento actual (la cascada sugiere un
 * default de bootstrap, ver `cascadeTaskFields()`).
 */
export type ExecutorMode = 'local' | 'cli-claude' | 'cli-opencode' | 'cli-codex' | 'api'

export interface OrcheConfig {
  config_version: number
  models: {
    planner:        ModelRoleConfig
    executor_heavy: ModelRoleConfig
    executor_light: ModelRoleConfig
    default:        ModelRoleConfig
    /** Optional QA judge model — absence triggers the resolution logic in harness.ts (never same model as executor) */
    qa?:            ModelRoleConfig
  }
  /** G.4.1 — ver ExecutorMode arriba. Ausente = sin preferencia guardada todavía. */
  executor_mode?: ExecutorMode
  /** If true, every task must have an approved spec before it can run */
  requireSpec?: boolean
  /**
   * Default ExecutorEngine for tasks that don't declare their own `engine:` — absence
   * means 'single-shot' (G.3, opt-in). B.2 — extended with 'external'.
   * BB.2 (2026-08-16) — extendido con 'opencode'/'codex': el harness ya los ejecutaba,
   * este tipo era el que impedía configurarlos (y `load.ts` los descartaba en silencio).
   * Con BB.1, `executor_mode` es el eje principal de "dónde corre"; este campo refina
   * "cómo corre" cuando el modo es api/local (single-shot vs agentic).
   */
  executorEngine?: 'single-shot' | 'agentic' | 'external' | 'opencode' | 'codex'
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
    planner:        { provider: 'openrouter', model: 'deepseek/deepseek-v4-flash' },
    executor_heavy: { provider: 'openrouter', model: 'deepseek/deepseek-v4-flash' },
    executor_light: { provider: 'openrouter', model: 'deepseek/deepseek-v4-flash' },
    default:        { provider: 'openrouter', model: 'deepseek/deepseek-v4-flash' },
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
      model:    typeof obj.model    === 'string' ? obj.model    : fallback.model,
    }
  }

  return fallback
}
