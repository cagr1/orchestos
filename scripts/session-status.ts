#!/usr/bin/env bun
/**
 * H.7.5 — lectura normalizada de la sesión interactiva más reciente del proyecto.
 *
 * Descubre transcripts; el significado de sus datos sigue perteneciendo al registro
 * de `context-adapters.ts`. El dashboard y la CLI consumen esta misma función para no
 * mantener dos cálculos que puedan divergir.
 */
import {
  closeSync,
  existsSync,
  openSync,
  readFileSync,
  readSync,
  realpathSync,
  statSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { globSync } from 'glob'
import { type CliDetectionResult, detectInstalledClis } from '../src/run/executors/cli-registry.ts'
import {
  type ContextAdapter,
  DEFAULT_ADAPTERS,
  readCodexRateLimitsLive,
  readSessionMetrics,
  type SessionMetrics,
} from './context-adapters.ts'

export interface SessionStatus {
  id: CliDetectionResult['id']
  label: string
  binary: string
  icon: string
  readBoundary: CliDetectionResult['readBoundary']
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

function readClaudeStatuslineRateLimits(agentHome = homedir()): {
  windows: import('./context-adapters.ts').RateLimitWindow[]
  observedAt: string
} | null {
  const path = join(
    process.env.ORCHESTOS_HOME ?? join(agentHome, '.orchestos'),
    'claude-statusline.json',
  )
  try {
    const stat = statSync(path)
    const payload = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>
    const limits = payload.rate_limits
    if (typeof limits !== 'object' || limits === null || Array.isArray(limits)) return null
    const windows = ['five_hour', 'seven_day'].flatMap((id) => {
      const raw = (limits as Record<string, unknown>)[id]
      if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return []
      const record = raw as Record<string, unknown>
      const usedPct = record.used_percentage
      if (typeof usedPct !== 'number' || !Number.isFinite(usedPct) || usedPct < 0 || usedPct > 100)
        return []
      return [
        {
          id,
          usedPct,
          remainingPct: 100 - usedPct,
          windowMinutes: id === 'five_hour' ? 300 : 10080,
          resetsAt:
            typeof record.resets_at === 'number' && Number.isFinite(record.resets_at)
              ? record.resets_at
              : null,
        },
      ]
    })
    return windows.length > 0 ? { windows, observedAt: stat.mtime.toISOString() } : null
  } catch {
    return null
  }
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
    ? existsSync(explicit)
      ? [realpathSync(explicit)]
      : []
    : discoverSessionTranscripts(projectRoot, options.agentHome)
  const adapters = options.adapters ?? DEFAULT_ADAPTERS
  const detections = detectInstalledClis()
  const found = new Map<CliDetectionResult['id'], SessionStatus>()
  const candidates = (
    await Promise.all(
      paths.map(async (transcriptPath) => ({
        transcriptPath,
        metrics: await readSessionMetrics(transcriptPath, adapters),
      })),
    )
  )
    .filter((candidate) => candidate.metrics)
    .sort((a, b) => statSync(b.transcriptPath).mtimeMs - statSync(a.transcriptPath).mtimeMs)

  const selected = new Map<CliDetectionResult['id'], (typeof candidates)[number]>()
  for (const candidate of candidates) {
    const source = candidate.metrics?.context.source
    const cli = detections.find((detection) => detection.id === source)
    if (cli && !selected.has(cli.id)) selected.set(cli.id, candidate)
  }
  const liveCodex = [...selected.entries()].find(([id]) => id === 'codex')
  const claudeStatusline = readClaudeStatuslineRateLimits(options.agentHome)
  const liveWindows =
    !explicit && liveCodex
      ? await readCodexRateLimitsLive({
          binary: detections.find((detection) => detection.id === 'codex')?.binary,
        })
      : []

  for (const [id, candidate] of selected) {
    const cli = detections.find((detection) => detection.id === id)
    if (!cli || !candidate.metrics) continue
    const normalized =
      id === 'codex' && liveWindows.length > 0
        ? { ...candidate.metrics, rateLimits: { source: 'codex' as const, windows: liveWindows } }
        : id === 'claude' && claudeStatusline
          ? {
              ...candidate.metrics,
              rateLimits: { source: 'claude' as const, windows: claudeStatusline.windows },
            }
          : candidate.metrics
    found.set(id, {
      id: cli.id,
      label: cli.label,
      binary: cli.binary,
      icon: cli.icon,
      readBoundary: cli.readBoundary,
      installed: cli.installed,
      available: true,
      observedAt: statSync(candidate.transcriptPath).mtime.toISOString(),
      ...normalized,
    })
  }

  if (claudeStatusline && !found.has('claude')) {
    const cli = detections.find((detection) => detection.id === 'claude')
    if (cli) {
      found.set('claude', {
        id: cli.id,
        label: cli.label,
        binary: cli.binary,
        icon: cli.icon,
        readBoundary: cli.readBoundary,
        installed: cli.installed,
        available: true,
        observedAt: claudeStatusline.observedAt,
        context: null,
        rateLimits: { source: 'claude', windows: claudeStatusline.windows },
      })
    }
  }

  return detections.map(
    (cli) =>
      found.get(cli.id) ?? {
        id: cli.id,
        label: cli.label,
        binary: cli.binary,
        icon: cli.icon,
        readBoundary: cli.readBoundary,
        installed: cli.installed,
        available: false,
        observedAt: null,
        context: null,
        rateLimits: null,
      },
  )
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
