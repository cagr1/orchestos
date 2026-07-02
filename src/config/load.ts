/**
 * src/config/load.ts
 *
 * Loads orchestos.config.yaml with a 3-tier fallback chain:
 *   1. <projectPath>/orchestos.config.yaml
 *   2. ~/.orchestos/config.yaml
 *   3. DEFAULT_CONFIG (hardcoded defaults — always works, no file needed)
 *
 * Returns a fully resolved OrcheConfig — callers never deal with missing fields.
 */

import { parse } from 'yaml'
import { join } from 'path'
import { homedir } from 'os'
import { existsSync, readFileSync } from 'fs'
import { DEFAULT_CONFIG, parseRoleValue, type OrcheConfig } from './schema.ts'

const GLOBAL_CONFIG_PATH = join(homedir(), '.orchestos', 'config.yaml')

/**
 * Load and merge config from project → global → defaults.
 * Never throws — worst case returns DEFAULT_CONFIG.
 */
export function loadOrcheConfig(projectPath?: string): OrcheConfig {
  const candidates: string[] = []
  if (projectPath) candidates.push(join(projectPath, 'orchestos.config.yaml'))
  candidates.push(GLOBAL_CONFIG_PATH)

  for (const candidate of candidates) {
    if (!existsSync(candidate)) continue
    try {
      const raw = parse(readFileSync(candidate, 'utf8')) as Record<string, unknown>
      return mergeWithDefaults(raw)
    } catch {
      // malformed YAML → skip to next candidate
    }
  }

  return DEFAULT_CONFIG
}

function mergeWithDefaults(raw: Record<string, unknown>): OrcheConfig {
  const models = (raw.models ?? {}) as Record<string, unknown>
  const d = DEFAULT_CONFIG.models

  return {
    config_version: typeof raw.config_version === 'number' ? raw.config_version : 1,
    models: {
      planner:        parseRoleValue(models.planner,        d.planner),
      executor_heavy: parseRoleValue(models.executor_heavy, d.executor_heavy),
      executor_light: parseRoleValue(models.executor_light, d.executor_light),
      default:        parseRoleValue(models.default,        d.default),
      // qa has no default fallback — absence means "not configured", resolved at call time (harness.ts F2.2)
      qa: models.qa !== undefined ? parseRoleValue(models.qa, d.default) : undefined,
    },
  }
}

/**
 * Generate a starter orchestos.config.yaml content string.
 */
export function scaffoldConfigYaml(): string {
  return `# orchestos.config.yaml
# Model routing configuration for this project.
# Each role maps to a provider/model pair.
# Format: "provider/model-id" or an object with provider + model fields.
# Docs: https://github.com/cagr1/orchestos

config_version: 1

models:
  # Planning tasks (architect, design, scaffold)
  planner:
    provider: openrouter
    model: deepseek/deepseek-v4-flash

  # Heavy execution tasks (fix bugs, implement features, refactor)
  executor_heavy:
    provider: openrouter
    model: deepseek/deepseek-v4-flash

  # Light execution tasks (docs, comments, small edits)
  executor_light:
    provider: openrouter
    model: deepseek/deepseek-v4-flash

  # Fallback for unclassified tasks
  default:
    provider: openrouter
    model: deepseek/deepseek-v4-flash

  # Optional: QA judge model (must differ from the executor — see docs)
  # qa:
  #   provider: anthropic
  #   model: claude-haiku-4-5

# Examples:
#   planner:        "anthropic/claude-opus-4-7"
#   executor_heavy: "openai/gpt-4o"
#   executor_light: "openrouter/deepseek/deepseek-v3"
#   executor_heavy: codex   # uses Codex CLI (requires OS_ENABLE_EXEC_CODEX=1)
`
}
