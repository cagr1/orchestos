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

import { existsSync, readFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { parse } from 'yaml'
import {
  type AgentChoice,
  DEFAULT_CONFIG,
  type OrcheConfig,
  parseRoleValue,
  ROLE_AGENTS,
  ROLE_NAMES,
  type RoleAssignment,
  type RoleName,
  type TaskAgentRule,
} from './schema.ts'

export const AGENT_CHOICES: AgentChoice[] = ['local', 'claude', 'opencode', 'codex', 'api']

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
    roles: resolveRoles(raw),
    models: {
      ...(models.planner !== undefined
        ? { planner: parseRoleValue(models.planner, { provider: '', model: '' }) }
        : {}),
      ...(models.executor_heavy !== undefined
        ? { executor_heavy: parseRoleValue(models.executor_heavy, { provider: '', model: '' }) }
        : {}),
      ...(models.executor_light !== undefined
        ? { executor_light: parseRoleValue(models.executor_light, { provider: '', model: '' }) }
        : {}),
      ...(models.default !== undefined
        ? { default: parseRoleValue(models.default, { provider: '', model: '' }) }
        : {}),
      // qa has no default fallback — absence means "not configured", resolved at call time (harness.ts F2.2)
      qa:
        models.qa !== undefined
          ? parseRoleValue(models.qa, d.default ?? { provider: '', model: '' })
          : undefined,
    },
    // CC.D1 (2026-08-17) — `agent`/`apiMode` reemplazan a `executor_mode`/`executorEngine`
    // (dos campos que eran el mismo concepto con nombres distintos para sus valores CLI —
    // ver schema.ts). Configs existentes con los nombres viejos se migran en memoria acá,
    // sin reescribir el archivo — la próxima vez que Settings guarde, se persiste con el
    // nombre nuevo y el viejo queda huérfano en el YAML (inofensivo, ya no se lee).
    agent: resolveAgent(raw),
    taskAgentRules: parseTaskAgentRules(raw.taskAgentRules),
    apiMode: resolveApiMode(raw),
    agentic: parseAgenticConfig(raw.agentic),
    external: parseExternalConfig(raw.external),
    // K.4b — opt-in explícito: cualquier valor que no sea `true` literal se ignora (queda undefined/desactivado).
    adversarialQA: raw.adversarialQA === true ? true : undefined,
    // X.2 (IDEAS #33) — mismo criterio que adversarialQA. Hallazgo real al escribir CC.D1:
    // este campo existía en schema.ts desde Bloque X pero NUNCA se leía acá — `refuterQA: true`
    // en el YAML se ignoraba en silencio desde que se creó. Bug de la misma clase que BB.2/CC.1c.
    refuterQA: raw.refuterQA === true ? true : undefined,
  }
}

function resolveRoles(raw: Record<string, unknown>): Partial<Record<RoleName, RoleAssignment>> {
  const result: Partial<Record<RoleName, RoleAssignment>> = {}
  const explicit =
    raw.roles && typeof raw.roles === 'object' && !Array.isArray(raw.roles)
      ? (raw.roles as Record<string, unknown>)
      : {}
  const legacy = (raw.models && typeof raw.models === 'object' ? raw.models : {}) as Record<
    string,
    unknown
  >
  const sources: Partial<Record<RoleName, string>> = {
    orchestrator: 'planner',
    executor: 'executor_heavy',
    reviewer: 'qa',
  }
  for (const name of ROLE_NAMES) {
    if (Object.hasOwn(explicit, name)) {
      const value = explicit[name]
      if (value === null) continue // null desasigna también los roles migrables desde models.
      const obj =
        value && typeof value === 'object' && !Array.isArray(value)
          ? (value as Record<string, unknown>)
          : {}
      if (
        !ROLE_AGENTS.includes(obj.agent as (typeof ROLE_AGENTS)[number]) ||
        typeof obj.model !== 'string' ||
        !obj.model.trim()
      ) {
        warnIgnored(`roles.${name}`, value, ['{ agent, model }'])
        continue
      }
      const assignment: RoleAssignment = {
        agent: obj.agent as RoleAssignment['agent'],
        model: obj.model.trim(),
      }
      if (typeof obj.effort === 'string' && obj.effort.trim()) assignment.effort = obj.effort.trim()
      if (typeof obj.provider === 'string' && obj.provider.trim())
        assignment.provider = obj.provider.trim()
      result[name] = assignment
      continue
    }
    const from = sources[name]
    if (!from || legacy[from] === undefined) continue
    // Los nombres legacy de CLI no traducen un modelo API viejo a un modelo CLI.
    if (name === 'executor' && ['claude', 'codex', 'opencode'].includes(String(resolveAgent(raw))))
      continue
    const parsed = parseRoleValue(legacy[from], { provider: '', model: '' })
    if (!parsed.model.trim()) continue
    result[name] = { agent: 'api', model: parsed.model, provider: parsed.provider }
  }
  return result
}

export class RoleUnassignedError extends Error {
  constructor(role: RoleName) {
    super(`Rol '${role}' sin asignar: elígelo en Settings → Model routing`)
    this.name = 'RoleUnassignedError'
  }
}

export function resolveRole(cfg: OrcheConfig, role: RoleName): RoleAssignment {
  const assignment = cfg.roles[role]
  if (!assignment) throw new RoleUnassignedError(role)
  return assignment
}

/** Avisa en vez de descartar en silencio — un typo no debe cambiar el agente sin decirlo. */
function warnIgnored(field: string, value: unknown, allowed: readonly string[]): void {
  console.error(
    `[config] ignorando ${field}: '${String(value)}' no es un valor válido — ` +
      `se usará el default. Valores permitidos: ${allowed.join(', ')}.`,
  )
}

// CC.D1 — mapeo de migración desde los dos campos viejos. `executor_mode` tenía prioridad
// sobre `executorEngine` en la precedencia de BB.1 (task.engine → executor_mode →
// executorEngine) — se conserva ese orden acá: si ambos están presentes en un YAML viejo,
// gana lo que vendría de executor_mode.
const LEGACY_EXECUTOR_MODE_TO_AGENT: Record<string, AgentChoice> = {
  'cli-claude': 'claude',
  'cli-opencode': 'opencode',
  'cli-codex': 'codex',
  local: 'local',
  api: 'api',
}
const LEGACY_EXECUTOR_ENGINE_TO_AGENT: Record<string, AgentChoice> = {
  external: 'claude',
  opencode: 'opencode',
  codex: 'codex',
}

function resolveAgent(raw: Record<string, unknown>): AgentChoice | undefined {
  if (raw.agent !== undefined && raw.agent !== null) {
    if ((AGENT_CHOICES as readonly unknown[]).includes(raw.agent)) return raw.agent as AgentChoice
    warnIgnored('agent', raw.agent, AGENT_CHOICES)
    return undefined
  }
  if (typeof raw.executor_mode === 'string' && raw.executor_mode in LEGACY_EXECUTOR_MODE_TO_AGENT) {
    return LEGACY_EXECUTOR_MODE_TO_AGENT[raw.executor_mode]
  }
  if (
    typeof raw.executorEngine === 'string' &&
    raw.executorEngine in LEGACY_EXECUTOR_ENGINE_TO_AGENT
  ) {
    return LEGACY_EXECUTOR_ENGINE_TO_AGENT[raw.executorEngine]
  }
  return undefined
}

// I.3 — igual criterio defensivo que el resto de este archivo: una entrada mal
// formada se descarta con aviso (nunca rompe la carga del config entero), y
// nunca infiere un `agent` inválido a partir de basura en el YAML.
function parseTaskAgentRules(v: unknown): TaskAgentRule[] | undefined {
  if (!Array.isArray(v) || v.length === 0) return undefined
  const rules: TaskAgentRule[] = []
  for (const entry of v) {
    if (typeof entry !== 'object' || entry === null) {
      warnIgnored('taskAgentRules[]', entry, ['{ match, agent }'])
      continue
    }
    const obj = entry as Record<string, unknown>
    if (!AGENT_CHOICES.includes(obj.agent as AgentChoice)) {
      warnIgnored('taskAgentRules[].agent', obj.agent, AGENT_CHOICES)
      continue
    }
    const matchRaw = obj.match
    if (typeof matchRaw !== 'object' || matchRaw === null) {
      warnIgnored('taskAgentRules[].match', matchRaw, ['{ output?, skill? }'])
      continue
    }
    const matchObj = matchRaw as Record<string, unknown>
    const output = Array.isArray(matchObj.output)
      ? matchObj.output.filter((x): x is string => typeof x === 'string')
      : undefined
    const skill = typeof matchObj.skill === 'string' ? matchObj.skill : undefined
    if (!output?.length && !skill) {
      warnIgnored('taskAgentRules[].match', matchRaw, ['{ output: string[] }', '{ skill: string }'])
      continue
    }
    rules.push({
      match: { output, skill },
      agent: obj.agent as AgentChoice,
      cli_effort: typeof obj.cli_effort === 'string' ? obj.cli_effort : undefined,
    })
  }
  return rules.length ? rules : undefined
}

function resolveApiMode(raw: Record<string, unknown>): 'single-shot' | 'agentic' | undefined {
  if (raw.apiMode === 'single-shot' || raw.apiMode === 'agentic') return raw.apiMode
  // Legacy: executorEngine solo migra a apiMode cuando tenía uno de estos 2 valores —
  // los valores CLI (external/opencode/codex) ya se migraron a `agent` arriba.
  if (raw.executorEngine === 'single-shot' || raw.executorEngine === 'agentic')
    return raw.executorEngine
  return undefined
}

function parseAgenticConfig(v: unknown): { maxIterations?: number } | undefined {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return undefined
  const obj = v as Record<string, unknown>
  return { maxIterations: typeof obj.maxIterations === 'number' ? obj.maxIterations : undefined }
}

// B.2 — mirror of parseAgenticConfig. Mismo principio: cualquier tipo incorrecto → undefined, sin throw,
// para que una config mal escrita no rompa el proyecto entero — el engine cae a su default interno.
function parseExternalConfig(v: unknown): { timeoutMs?: number } | undefined {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return undefined
  const obj = v as Record<string, unknown>
  return { timeoutMs: typeof obj.timeoutMs === 'number' ? obj.timeoutMs : undefined }
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

# Optional: K.4b — segundo juez adversarial después de que el QA normal pase
# (VERIFIED/CAVEATS/REFUTED). Dobla el costo de QA por tarea que pasa — opt-in.
# adversarialQA: true

# Model routing por rol (MR.1); sin asignaciones por defecto.
# roles:
#   orchestrator: { agent: claude, model: claude-sonnet-4-5, effort: medium }
#   executor: { agent: codex, model: gpt-6-luna, effort: medium }
#   reviewer: { agent: api, model: openai/gpt-4.1, provider: openrouter }
#   auxiliary: { agent: opencode, model: anthropic/claude-sonnet-4-5 }

# Optional: I.3 — qué agente/CLI corre cada tarea, por proyecto (no por chat).
# Precedencia: taskAgentRules > agent (arriba) > cascada automática. Primera
# regla que matchea gana; output (glob) tiene prioridad sobre skill.
# taskAgentRules:
#   - match: { output: ["apps/api/**"] }
#     agent: codex
#   - match: { skill: "frontend-design" }
#     agent: claude
#     cli_effort: high

# Examples:
#   planner:        "anthropic/claude-opus-4-7"
#   executor_heavy: "openai/gpt-4o"
#   executor_light: "openrouter/deepseek/deepseek-v3"
#   executor_heavy: codex   # uses Codex CLI (requires OS_ENABLE_EXEC_CODEX=1)
`
}
