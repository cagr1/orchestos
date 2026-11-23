import { delimiter } from 'node:path'
import { listTaskRunWatch, type TaskRunWatchRow } from '../../db/task-run-watch.ts'
import { cliSearchPath, systemCliDiscoveryProbe } from '../../run/executors/cli-discovery.ts'
import { invalidateCliHealth, readCliHealth } from '../../run/executors/cli-health.ts'
import { cliInstallReason, detectCliInstall } from '../../run/executors/cli-install-method.ts'
import { allClis } from '../../run/executors/cli-registry.ts'
import { cliForTaskEngine } from '../../run/executors/task-engines.ts'
import { spawnTree } from '../../run/process-tree.ts'
import { loadTasks } from '../../tasks/loader.ts'
import { resetCliModelCatalogCache } from '../chat-cli-models.ts'
import { jsonResponse } from '../http.ts'
import { activeChatTurnAgents } from './chat-turn-registry.ts'
import { handleApiCliUpdates } from './cli-update-status.ts'
import { readProviders } from './providers.ts'
import { psRunnerProbe, type RunnerProbe } from './task-run-reconcile.ts'

export interface CliUpdateResult {
  ok: boolean
  exitCode: number | null
  output: string
}

export async function spawnCliUpdate(
  command: string[],
  options: { env: NodeJS.ProcessEnv; timeout: number },
): Promise<CliUpdateResult> {
  const proc = spawnTree(command, { ...options, stdout: 'pipe', stderr: 'pipe' })
  let output = ''
  async function consume(stream: ReadableStream<Uint8Array>) {
    const decoder = new TextDecoder()
    for await (const chunk of stream)
      output = (output + decoder.decode(chunk, { stream: true })).slice(-4_000)
    output = (output + decoder.decode()).slice(-4_000)
  }
  const [exitCode] = await Promise.all([proc.exited, consume(proc.stdout), consume(proc.stderr)])
  return { ok: exitCode === 0 && !proc.signalCode, exitCode, output }
}

export function createProviderUpdater(
  dependencies: {
    detect?: typeof detectCliInstall
    inUse?: (id: string) => string | null
    refreshUpdates?: () => Promise<void>
    definitions?: typeof allClis
    health?: typeof readCliHealth
    spawn?: typeof spawnCliUpdate
    searchPath?: () => string
    invalidateHealth?: () => void
    invalidateProviders?: () => void
    invalidateModels?: () => void
  } = {},
) {
  let running = false
  const health = dependencies.health ?? readCliHealth
  return async (id: string): Promise<Response> => {
    const cli = (dependencies.definitions ?? allClis)().find((entry) => entry.id === id)
    if (!cli || !['claude', 'codex', 'opencode'].includes(id))
      return jsonResponse({ error: 'CLI update is not supported' }, 404)
    if (running) return jsonResponse({ error: 'A CLI update is already running' }, 409)
    running = true
    try {
      const state = (await health()).find((entry) => entry.id === id)
      if (!state?.installed || !state.path)
        return jsonResponse({ error: 'CLI is not installed' }, 404)
      const install = (dependencies.detect ?? detectCliInstall)(id, state.path)
      if (!install.command)
        return jsonResponse(
          { ok: false, error: cliInstallReason(cli.label, install.realPath) },
          409,
        )
      const busy = (dependencies.inUse ?? cliInUse)(id)
      if (busy)
        return jsonResponse(
          {
            ok: false,
            error: `${cli.label} is in use by a running ${busy}. Update it when it finishes.`,
          },
          409,
        )
      let result: CliUpdateResult
      try {
        result = await (dependencies.spawn ?? spawnCliUpdate)(install.command, {
          env: {
            ...process.env,
            PATH: [
              install.managerDir,
              (dependencies.searchPath ?? (() => cliSearchPath(systemCliDiscoveryProbe)))(),
            ]
              .filter(Boolean)
              .join(delimiter),
          },
          timeout: 5 * 60_000,
        })
      } catch (error) {
        result = { ok: false, exitCode: null, output: String(error) }
      }
      ;(dependencies.invalidateHealth ?? invalidateCliHealth)()
      ;(dependencies.invalidateProviders ?? readProviders.invalidate)()
      ;(dependencies.invalidateModels ?? resetCliModelCatalogCache)()
      const version =
        (await health(true).catch(() => [])).find((entry) => entry.id === id)?.version ?? null
      await (dependencies.refreshUpdates ?? handleApiCliUpdates.refreshNow)()
      return jsonResponse({
        ...result,
        output: result.output.slice(-4_000),
        method: install.method,
        version,
      })
    } catch (error) {
      return jsonResponse({ ok: false, exitCode: null, output: String(error).slice(-4_000) })
    } finally {
      running = false
    }
  }
}

export function cliInUse(
  id: string,
  deps: {
    rows?: () => TaskRunWatchRow[]
    runner?: RunnerProbe
    alive?: (pid: number) => boolean
    tasks?: (root: string) => Array<{ id: string; engine?: string }>
    chatAgents?: () => Array<string | undefined>
  } = {},
): string | null {
  if (
    (deps.chatAgents ?? activeChatTurnAgents)().some((agent) => agent === undefined || agent === id)
  )
    return 'chat turn'
  try {
    for (const row of (deps.rows ?? listTaskRunWatch)()) {
      // Fail closed: a live PID whose command line can't be read or matched still counts as a running task.
      if (
        !(deps.runner ?? psRunnerProbe)(row.pid, row.task_id) &&
        !(deps.alive ?? pidAlive)(row.pid)
      )
        continue
      const task = (deps.tasks ?? ((root) => loadTasks(root).tasks))(row.root).find(
        (entry) => entry.id === row.task_id,
      )
      const cli = cliForTaskEngine(task?.engine)
      if (!task || !cli || cli === id) return 'task'
    }
  } catch {
    return 'task'
  }
  return null
}

function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

export const handleApiProviderUpdate = createProviderUpdater()
