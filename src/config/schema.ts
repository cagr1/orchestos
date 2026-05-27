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

export interface OrcheConfig {
  config_version: number
  models: {
    planner:        ModelRoleConfig
    executor_heavy: ModelRoleConfig
    executor_light: ModelRoleConfig
    default:        ModelRoleConfig
  }
  /** If true, every task must have an approved spec before it can run */
  requireSpec?: boolean
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
