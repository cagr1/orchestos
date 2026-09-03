#!/usr/bin/env bun
/**
 * H.7.5 — lectura normalizada de la sesión interactiva más reciente del proyecto.
 *
 * Descubre transcripts; el significado de sus datos sigue perteneciendo al registro
 * de `context-adapters.ts`. El dashboard y la CLI consumen esta misma función para no
 * mantener dos cálculos que puedan divergir.
 */
import { closeSync, existsSync, openSync, readSync, realpathSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { globSync } from 'glob'
import {
  type ContextAdapter,
  DEFAULT_ADAPTERS,
  readSessionMetrics,
  type SessionMetrics,
  readCodexRateLimitsLive,
} from './context-adapters.ts'
import { detectInstalledClis, type CliDetectionResult } from '../src/run/executors/cli-registry.ts'

export interface SessionStatus {
  id: CliDetectionResult['id']
  label: string
  binary: string
  installed: boolean
  available: boolean
  /** Momento de la última escritura del transcript, no la hora del request. */
  observedAt: string | null
  context: SessionMetrics['context'] | null
  rateLimits: SessionMetrics['rateLimits']
}

export interface SessionStatusResponse {
  available: boolean
  clis: SessionStatus[]
}

interface SessionStatusOptions {
  projectRoot?: string
  transcriptPath?: string
  agentHome?: string
  adapters?: ContextAdapter[]
}

/** No expone paths ni contenido del transcript: solo métricas normalizadas. */
export async function readActiveSessionStatus(
  options: SessionStatusOptions = {},
): Promise<SessionStatus | null> {
  const statuses = await readActiveSessionStatuses(options)
  return statuses.find((status) => status.available) ?? null
}

/** Devuelve una tarjeta por CLI conocido, incluso cuando no hay telemetría disponible. */
export async function readActiveSessionStatuses(
  options: SessionStatusOptions = {},
): Promise<SessionStatus[]> {
  const projectRoot = realProjectRoot(options.projectRoot ?? process.cwd())
  const explicit = options.transcriptPath ?? process.env.ORCHESTOS_SESSION_TRANSCRIPT
  const paths = explicit
    ? existsSync(explicit) ? [realpathSync(explicit)] : []
    : discoverSessionTranscripts(projectRoot, options.agentHome)
  const adapters = options.adapters ?? DEFAULT_ADAPTERS
  const detections = detectInstalledClis()
  const result: SessionStatus[] = []

  for (const cli of detections) {
    let found: SessionStatus | null = null
    for (const transcriptPath of paths) {
      const metrics = await readSessionMetrics(transcriptPath, adapters)
      if (!metrics || metrics.context.source !== cli.id) continue
      let normalized = metrics
      if (!explicit && cli.id === 'codex') {
        const liveWindows = await readCodexRateLimitsLive({ binary: cli.binary })
        if (liveWindows.length > 0) normalized = { ...metrics, rateLimits: { source: 'codex', windows: liveWindows } }
      }
      found = {
        id: cli.id,
        label: cli.label,
        binary: cli.binary,
        installed: cli.installed,
        available: true,
        observedAt: statSync(transcriptPath).mtime.toISOString(),
        ...normalized,
      }
      break
    }
    result.push(found ?? {
      id: cli.id,
      label: cli.label,
      binary: cli.binary,
      installed: cli.installed,
      available: false,
      observedAt: null,
  context: null,
      rateLimits: null,
    })
  }
  return result
}

/**
 * Claude ya separa los proyectos por carpeta. Codex usa un árbol global, por lo que
 * se confirma el `cwd` del propio JSONL antes de aceptar un archivo.
 */
export function discoverSessionTranscripts(projectRoot: string, agentHome = homedir()): string[] {
  const root = realProjectRoot(projectRoot)
  const claudeKey = root.replace(/[\\/]/g, '-')
  const claude = globSync('*.jsonl', {
    cwd: join(agentHome, '.claude', 'projects', claudeKey),
    absolute: true,
    nodir: true,
  })
  const codex = globSync('**/rollout-*.jsonl', {
    cwd: join(agentHome, '.codex', 'sessions'),
    absolute: true,
    nodir: true,
  }).filter((path) => transcriptDeclaresProject(path, root))

  return [...claude, ...codex].sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)
}

function transcriptDeclaresProject(path: string, projectRoot: string): boolean {
  let fd: number | null = null
  try {
    fd = openSync(path, 'r')
    const buffer = Buffer.alloc(128 * 1024)
    const bytes = readSync(fd, buffer, 0, buffer.length, 0)
    for (const line of buffer.toString('utf8', 0, bytes).split('\n')) {
      try {
        const parsed = JSON.parse(line) as Record<string, unknown>
        const payload = recordAt(parsed, 'payload')
        if (parsed.cwd === projectRoot || payload?.cwd === projectRoot) return true
      } catch {
        // La última línea del bloque puede estar cortada: seguir con las completas.
      }
    }
  } catch {
    return false
  } finally {
    if (fd !== null) closeSync(fd)
  }
  return false
}

function realProjectRoot(path: string): string {
  try {
    return realpathSync(resolve(path))
  } catch {
    return resolve(path)
  }
}

function recordAt(value: Record<string, unknown>, key: string): Record<string, unknown> | null {
  const found = value[key]
  return typeof found === 'object' && found !== null && !Array.isArray(found)
    ? (found as Record<string, unknown>)
    : null
}

if (import.meta.main) {
  const transcriptFlag = process.argv.indexOf('--transcript')
  const projectFlag = process.argv.indexOf('--project')
  const status = await readActiveSessionStatus({
    transcriptPath: transcriptFlag >= 0 ? process.argv[transcriptFlag + 1] : undefined,
    projectRoot: projectFlag >= 0 ? process.argv[projectFlag + 1] : undefined,
  })
  console.log(
    JSON.stringify(
      status ?? { available: false, observedAt: null, context: null, rateLimits: null },
    ),
  )
}
