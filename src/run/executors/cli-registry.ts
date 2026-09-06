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

export type CliReadBoundary =
  // H.9.2 (reabierto 2026-09-06) — `project-root` ya no es una promesa del
  // registro: declara QUÉ mecanismo la sostiene y ese mecanismo se verifica
  // contra el binario instalado antes de spawnear (`readBoundaryFor()` abajo).
  // El cierre anterior daba por buena la frontera por estar escrita acá; las
  // sondas de PLAN.md § R.2-bis mostraron que no existía en ninguna dirección.
  | { kind: 'project-root'; mechanism: 'restricted-flag' }
  | { kind: 'none'; reason: string }

export interface CliDefinition {
  id: 'claude' | 'codex' | 'opencode' | 'deepseek' | 'gemini' | 'kimi' | 'glm'
  binary: string
  label: string
  icon: string
  readBoundary: CliReadBoundary
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
    readBoundary: { kind: 'project-root', mechanism: 'restricted-flag' },
    configHome: { directory: 'claude', instructionFile: 'CLAUDE.md', settingsFile: 'settings.json' },
  },
  {
    id: 'codex', binary: 'codex', label: 'Codex', icon: 'openai',
    readBoundary: { kind: 'none', reason: 'Codex no ofrece hoy un sandbox que acote paths de lectura.' },
    configHome: { directory: 'codex', instructionFile: 'AGENTS.md', envVar: 'CODEX_HOME' },
  },
  { id: 'opencode', binary: 'opencode', label: 'opencode', icon: 'opencode', readBoundary: { kind: 'none', reason: 'No hay un contrato verificado de frontera de lectura para este CLI.' }, configHome: { directory: 'opencode', instructionFile: 'AGENTS.md' } },
  { id: 'deepseek', binary: 'deepseek', label: 'DeepSeek', icon: 'deepseek', readBoundary: { kind: 'none', reason: 'No hay un contrato verificado de frontera de lectura para este CLI.' }, configHome: { directory: 'deepseek', instructionFile: 'AGENTS.md' } },
  { id: 'gemini', binary: 'gemini', label: 'Gemini', icon: 'gemini', readBoundary: { kind: 'none', reason: 'No hay un contrato verificado de frontera de lectura para este CLI.' }, configHome: { directory: 'gemini', instructionFile: 'AGENTS.md' } },
  { id: 'kimi', binary: 'kimi', label: 'Kimi', icon: 'kimi', readBoundary: { kind: 'none', reason: 'No hay un contrato verificado de frontera de lectura para este CLI.' }, configHome: { directory: 'kimi', instructionFile: 'AGENTS.md' } },
  { id: 'glm', binary: 'glm', label: 'GLM', icon: 'glm', readBoundary: { kind: 'none', reason: 'No hay un contrato verificado de frontera de lectura para este CLI.' }, configHome: { directory: 'glm', instructionFile: 'AGENTS.md' } },
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
  if (settingsPath) {
    // H.9.2 (reabierto 2026-09-06) — acá vivía `permissions.deny: ['Read(//*)']`,
    // que NO acotaba la lectura al proyecto: bloqueaba TODO, incluido el propio
    // root (sonda 1, PLAN.md § R.2-bis) — el chat de proyecto no podía leer ni un
    // archivo. La frontera real la da `--restricted` en el spawn
    // (`CLAUDE_CHAT_BOUNDARY_FLAGS`, external.ts), no un patrón de permisos: no
    // existe un `deny` que exprese "todo salvo X" (deny gana sobre allow siempre).
    // Este settings queda deliberadamente vacío — su función es aislar el config
    // home (H.9.3), no fijar permisos.
    writeFileSync(settingsPath, `${JSON.stringify({})}\n`, 'utf8')
  }

  return { path, settingsPath, envVar: definition.configHome.envVar }
}

/**
 * H.9.2 (reabierto 2026-09-06) — la frontera declarada en KNOWN_CLIS es una
 * INTENCIÓN; esto verifica si el binario instalado la sostiene de verdad.
 *
 * Motivo concreto, medido en la máquina de Carlos: convivían dos instalaciones
 * de Claude Code (2.1.234 en `~/.local/bin` sombreando a 2.1.263 de npm) y solo
 * una soporta `--restricted`. Asumir la capability por "el CLI se llama claude"
 * habría corrido el chat de proyecto SIN frontera y sin decirlo — exactamente el
 * fallo que reabrió este ítem.
 *
 * Sonda inyectable, nunca un spawn directo dentro del test: es la misma regla que
 * `ToolchainProbe` (`detect/roadmap-profile.ts`), impuesta tras el incidente de
 * CI del 2026-08-01 (un test que afirmaba sobre el PATH del host).
 */
export type CliCapabilityProbe = (binary: string, args: string[]) => string | null

export const spawnCliCapabilityProbe: CliCapabilityProbe = (binary, args) => {
  try {
    const proc = Bun.spawnSync([binary, ...args])
    return proc.exitCode === 0 ? proc.stdout.toString() : null
  } catch {
    return null /* binario ausente o no ejecutable — se trata como "sin capability" */
  }
}

/** Cache por binario: `--help` es barato pero está en el camino caliente del chat. */
const capabilityCache = new Map<string, boolean>()

/** Solo para tests — evita que una entrada cacheada filtre entre casos. */
export function _resetCliCapabilityCache(): void {
  capabilityCache.clear()
}

export function supportsRestrictedMode(
  binary: string,
  probe: CliCapabilityProbe = spawnCliCapabilityProbe,
): boolean {
  // Solo se cachea el resultado de la sonda REAL. Cachear también las inyectadas
  // hacía que una sonda distinta devolviera el valor de la anterior — detectado
  // en el gate en vivo del 2026-09-06, donde simular un binario viejo devolvió
  // `project-root` porque la llamada anterior ya había cacheado `true`. Un cache
  // que ignora su entrada es peor que no tener cache: miente en silencio.
  const useCache = probe === spawnCliCapabilityProbe
  if (useCache) {
    const cached = capabilityCache.get(binary)
    if (cached !== undefined) return cached
  }
  const help = probe(binary, ['--help'])
  // Se busca el flag en su forma declarada, no una subcadena suelta: `--restricted`
  // aparece en la línea de opciones seguida de espacios y su descripción.
  const supported = help !== null && /^\s*--restricted(\s|$)/m.test(help)
  if (useCache) capabilityCache.set(binary, supported)
  return supported
}

/**
 * Frontera EFECTIVA de un CLI: la declarada, degradada a `none` si el binario
 * instalado no sostiene su mecanismo. Fail-closed por diseño — quien consuma
 * esto y reciba `none` debe rechazar el chat de proyecto, nunca correrlo igual.
 */
export function readBoundaryFor(
  definition: CliDefinition,
  probe: CliCapabilityProbe = spawnCliCapabilityProbe,
): CliReadBoundary {
  if (definition.readBoundary.kind !== 'project-root') return definition.readBoundary
  if (definition.readBoundary.mechanism === 'restricted-flag') {
    if (!supportsRestrictedMode(definition.binary, probe)) {
      return {
        kind: 'none',
        reason: `El binario \`${definition.binary}\` instalado no soporta \`--restricted\` (requiere Claude Code 2.1.248 o superior), que es lo que sostiene su frontera de lectura. Actualizá el CLI para habilitar el chat de proyecto.`,
      }
    }
  }
  return definition.readBoundary
}

export interface CliDetectionResult {
  id: CliDefinition['id']
  label: string
  binary: string
  icon: string
  readBoundary: CliReadBoundary
  installed: boolean
  path: string | null
}

export function detectInstalledClis(
  probe: CliCapabilityProbe = spawnCliCapabilityProbe,
): CliDetectionResult[] {
  return KNOWN_CLIS.map((def) => {
    const path = Bun.which(def.binary)
    // H.9.2 — se expone la frontera EFECTIVA (verificada contra el binario), no la
    // declarada: si la UI mostrara `project-root` sobre un binario que no la
    // sostiene, estaría prometiendo un aislamiento inexistente.
    const readBoundary = path ? readBoundaryFor(def, probe) : def.readBoundary
    return { id: def.id, label: def.label, binary: def.binary, icon: def.icon, readBoundary, installed: !!path, path }
  })
}
