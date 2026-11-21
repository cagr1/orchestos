import { cliSearchPath, systemCliDiscoveryProbe } from '../../run/executors/cli-discovery.ts'
import { invalidateCliHealth, readCliHealth } from '../../run/executors/cli-health.ts'
import { allClis } from '../../run/executors/cli-registry.ts'
import { resetCliModelCatalogCache } from '../chat-cli-models.ts'
import { jsonResponse } from '../http.ts'
import { readProviders } from './providers.ts'

export interface CliUpdateResult {
  ok: boolean
  exitCode: number | null
  output: string
}

export async function spawnCliUpdate(
  command: string[],
  options: { env: NodeJS.ProcessEnv; timeout: number },
): Promise<CliUpdateResult> {
  const proc = Bun.spawn(command, { ...options, stdout: 'pipe', stderr: 'pipe' })
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
    if (!cli?.update) return jsonResponse({ error: 'CLI update is not supported' }, 404)
    if (running) return jsonResponse({ error: 'A CLI update is already running' }, 409)
    running = true
    try {
      const state = (await health()).find((entry) => entry.id === id)
      if (!state?.installed || !state.path)
        return jsonResponse({ error: 'CLI is not installed' }, 404)
      const result = await (dependencies.spawn ?? spawnCliUpdate)(
        [state.path, ...cli.update.args],
        {
          env: {
            ...process.env,
            PATH: (dependencies.searchPath ?? (() => cliSearchPath(systemCliDiscoveryProbe)))(),
          },
          timeout: 5 * 60_000,
        },
      )
      return jsonResponse({ ...result, output: result.output.slice(-4_000) })
    } catch (error) {
      return jsonResponse({ ok: false, exitCode: null, output: String(error).slice(-4_000) })
    } finally {
      const invalidateHealth = dependencies.invalidateHealth ?? invalidateCliHealth
      const invalidateProviders = dependencies.invalidateProviders ?? readProviders.invalidate
      const invalidateModels = dependencies.invalidateModels ?? resetCliModelCatalogCache
      invalidateHealth()
      invalidateProviders()
      invalidateModels()
      running = false
    }
  }
}

export const handleApiProviderUpdate = createProviderUpdater()
