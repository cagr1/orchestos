/** Registro de ejecutores de tareas: CLI ↔ motor. Agregar un CLI ejecutor = una entrada acá. */

import { KNOWN_CLIS } from './cli-registry.ts'
import type { ExecutorEngine } from './types.ts'

export interface TaskEngineEntry {
  cliId: string
  /** Id persistido en tasks.yaml y runs (`external` sigue siendo Claude). */
  engineId: string
  engine: ExecutorEngine
  findBinary(): string | null
  unavailableMessage(pathHint?: string): string
}

/**
 * Los built-ins resuelven sus ejecutores bajo demanda: codex.ts importa la DB, y importar el
 * registro (config/load.ts → engine-cascade) no debe abrirla (LIMP.3).
 */
function lazyBuiltin(
  cliId: string,
  engineId: string,
  module: string,
  names: { engine: string; find: string; message: string },
): TaskEngineEntry {
  const mod = (): Record<string, any> => require(module)
  return {
    cliId,
    engineId,
    get engine() {
      return mod()[names.engine] as ExecutorEngine
    },
    findBinary: () => mod()[names.find](),
    unavailableMessage: (hint) => mod()[names.message](hint),
  }
}

const entries: TaskEngineEntry[] = [
  lazyBuiltin('claude', 'external', './external.ts', {
    engine: 'externalEngine',
    find: 'findClaudeBinary',
    message: 'claudeUnavailableMessage',
  }),
  lazyBuiltin('opencode', 'opencode', './opencode.ts', {
    engine: 'opencodeEngine',
    find: 'findOpencodeBinary',
    message: 'opencodeUnavailableMessage',
  }),
  lazyBuiltin('codex', 'codex', './codex.ts', {
    engine: 'codexEngine',
    find: 'findCodexBinary',
    message: 'codexUnavailableMessage',
  }),
]

function load(): TaskEngineEntry[] {
  return entries
}

/** Public registration used by built-in and additional CLI executors alike. */
export function registerTaskEngine(entry: TaskEngineEntry): void {
  const all = load()
  if (!KNOWN_CLIS.some((cli) => cli.id === entry.cliId))
    throw new Error(`Unknown CLI: ${entry.cliId}`)
  if (all.some((e) => e.cliId === entry.cliId))
    throw new Error(`CLI task engine already registered: ${entry.cliId}`)
  if (all.some((e) => e.engineId === entry.engineId))
    throw new Error(`Task engine id already registered: ${entry.engineId}`)
  all.push(entry)
}

/** Test helper: quita una entrada registrada (también built-ins). */
export function unregisterTaskEngine(cliId: string): void {
  const all = load()
  const i = all.findIndex((e) => e.cliId === cliId)
  if (i >= 0) all.splice(i, 1)
}

export function taskEngineForCli(cliId: string | undefined): TaskEngineEntry | undefined {
  return load().find((e) => e.cliId === cliId)
}

export function taskEngineById(engineId: string | undefined): TaskEngineEntry | undefined {
  return load().find((e) => e.engineId === engineId)
}

export function cliForTaskEngine(engineId: string | undefined): string | undefined {
  return taskEngineById(engineId)?.cliId
}

export function cliTaskEngineIds(): string[] {
  return load().map((e) => e.engineId)
}

/** Motores válidos en tasks.yaml / CLI / API de tareas. */
export function validTaskEngineIds(): string[] {
  return ['single-shot', 'agentic', ...cliTaskEngineIds()]
}

/**
 * Motor de tarea para una ruta cuyo agente es un CLI. Lanza si el CLI es conocido y no tiene
 * ejecutor de tareas; `undefined` para agentes no CLI (`api`, `local`).
 */
export function requireTaskEngineForAgent(agent: string | undefined): TaskEngineEntry | undefined {
  if (!agent) return undefined
  const cli = KNOWN_CLIS.find((c) => c.id === agent)
  if (!cli) return undefined
  const entry = taskEngineForCli(agent)
  if (!entry)
    throw new Error(
      `${cli.label} no tiene ejecutor de tareas en OrchestOS; asigna otro CLI al rol Ejecutor`,
    )
  return entry
}
