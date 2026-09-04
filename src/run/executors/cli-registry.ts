/**
 * src/run/executors/cli-registry.ts — G.4.2
 *
 * Detección GENÉRICA de CLIs instalados — registro de datos, no una función
 * `findXBinary()` por cada CLI (corrección de Carlos 2026-07-27: agregar un
 * CLI nuevo debe ser una entrada acá, no código nuevo en otro archivo).
 *
 * Detección es una capa separada de ejecución: un CLI puede aparecer
 * `installed: true` sin tener un `ExecutorEngine` real todavía (Codex hoy,
 * ver PLAN.md § G.4.2b) — `detectInstalledClis()` solo responde "¿está en
 * PATH?", nunca "¿se puede correr una tarea con esto?".
 *
 * `findClaudeBinary()`/`findOpencodeBinary()` (external.ts/opencode.ts) NO
 * se reemplazan por esto — siguen ahí con su mensaje de error específico
 * por engine. Este registro es la capa de detección que alimenta UI/cascada
 * (G.4.3/G.4.4), no el guard interno de cada executor.
 */

import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'

export interface CliDefinition {
  id: 'claude' | 'codex' | 'opencode' | 'deepseek' | 'gemini' | 'kimi' | 'glm'
  binary: string
  label: string
  icon: string
  configHome: {
    directory: string
    instructionFile: string
    settingsFile?: string
    envVar?: 'CODEX_HOME'
  }
}

export interface ProvisionedCliConfigHome {
  path: string
  settingsPath?: string
  envVar?: 'CODEX_HOME'
}

const GENERATED_INSTRUCTIONS = `# OrchestOS isolated agent home

This file is generated at runtime by OrchestOS for this project.
It contains only project-runtime rules: follow the instructions supplied by OrchestOS for the current project.
Do not load or reference user-level configuration, personal instructions, or private vaults.
`

/** Agregar un CLI nuevo = una entrada acá. `kimi` queda sin binario real
 * todavía (solo `Kimi.app`, GUI) — se detecta igual, `installed` da false
 * hasta que exista un binario alcanzable por PATH. */
export const KNOWN_CLIS: CliDefinition[] = [
  {
    id: 'claude', binary: 'claude', label: 'Claude Code', icon: 'claude',
    configHome: { directory: 'claude', instructionFile: 'CLAUDE.md', settingsFile: 'settings.json' },
  },
  {
    id: 'codex', binary: 'codex', label: 'Codex', icon: 'openai',
    configHome: { directory: 'codex', instructionFile: 'AGENTS.md', envVar: 'CODEX_HOME' },
  },
  { id: 'opencode', binary: 'opencode', label: 'opencode', icon: 'opencode', configHome: { directory: 'opencode', instructionFile: 'AGENTS.md' } },
  { id: 'deepseek', binary: 'deepseek', label: 'DeepSeek', icon: 'deepseek', configHome: { directory: 'deepseek', instructionFile: 'AGENTS.md' } },
  { id: 'gemini', binary: 'gemini', label: 'Gemini', icon: 'gemini', configHome: { directory: 'gemini', instructionFile: 'AGENTS.md' } },
  { id: 'kimi', binary: 'kimi', label: 'Kimi', icon: 'kimi', configHome: { directory: 'kimi', instructionFile: 'AGENTS.md' } },
  { id: 'glm', binary: 'glm', label: 'GLM', icon: 'glm', configHome: { directory: 'glm', instructionFile: 'AGENTS.md' } },
]

export function provisionCliConfigHome(projectRoot: string, cliId: CliDefinition['id']): ProvisionedCliConfigHome {
  const definition = KNOWN_CLIS.find((cli) => cli.id === cliId)
  if (!definition) throw new Error(`Unknown CLI: ${cliId}`)

  const path = join(projectRoot, '.orchestos', 'agent-home', definition.configHome.directory)
  mkdirSync(path, { recursive: true })
  writeFileSync(join(path, definition.configHome.instructionFile), GENERATED_INSTRUCTIONS, 'utf8')

  const settingsPath = definition.configHome.settingsFile
    ? join(path, definition.configHome.settingsFile)
    : undefined
  if (settingsPath) writeFileSync(settingsPath, '{}\n', 'utf8')

  return { path, settingsPath, envVar: definition.configHome.envVar }
}

export interface CliDetectionResult {
  id: CliDefinition['id']
  label: string
  binary: string
  icon: string
  installed: boolean
  path: string | null
}

export function detectInstalledClis(): CliDetectionResult[] {
  return KNOWN_CLIS.map((def) => {
    const path = Bun.which(def.binary)
    return { id: def.id, label: def.label, binary: def.binary, icon: def.icon, installed: !!path, path }
  })
}
