import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { loadOrcheConfig } from '../../config/load.ts'
import { cliChatAdapterFor } from '../../run/executors/chat-adapters.ts'
import {
  type CliDiscoveryProbe,
  cliSearchPath,
  systemCliDiscoveryProbe,
} from '../../run/executors/cli-discovery.ts'
import { configuredClis, detectInstalledClis } from '../../run/executors/cli-registry.ts'
import { taskEngineForCli } from '../../run/executors/task-engines.ts'
import { type CliModelCatalog, readCliModelCatalogsCached } from '../chat-cli-models.ts'
import { jsonResponse } from '../http.ts'

export interface ProviderAuth {
  status: 'ok' | 'missing' | 'unknown'
  account?: string
  plan?: string
}

export interface ProviderSnapshot {
  id: string
  label: string
  installed: boolean
  path: string | null
  version: string | null
  auth: ProviderAuth
  models: string[]
  defaultModel?: string
  taskEngine: boolean
  session: 'chat' | 'terminal' | null
}

export interface ProviderProbe extends CliDiscoveryProbe {
  command(binary: string, args: string[]): Promise<string | null>
  readFile(path: string): string | null
  now(): number
}

export const systemProviderProbe: ProviderProbe = {
  ...systemCliDiscoveryProbe,
  now: Date.now,
  readFile(path) {
    try {
      return readFileSync(path, 'utf8')
    } catch {
      return null
    }
  },
  async command(binary, args) {
    try {
      const proc = Bun.spawn([binary, ...args], {
        env: { ...process.env, PATH: cliSearchPath(systemCliDiscoveryProbe) },
        stdout: 'pipe',
        stderr: 'ignore',
        timeout: 3_000,
      })
      const [output, exit] = await Promise.all([new Response(proc.stdout).text(), proc.exited])
      return exit === 0 ? output : null
    } catch {
      return null
    }
  },
}

function object(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function readAuth(id: string, probe: ProviderProbe): ProviderAuth {
  if (id !== 'claude' && id !== 'codex') return { status: 'unknown' }
  const path =
    id === 'claude'
      ? join(probe.home, '.claude.json')
      : join(probe.env.CODEX_HOME || join(probe.home, '.codex'), 'auth.json')
  const raw = probe.readFile(path)
  if (raw === null) return { status: 'missing' }
  try {
    const data = object(JSON.parse(raw))
    if (!data) return { status: 'unknown' }
    let identity = id === 'claude' ? object(data.oauthAccount) : undefined
    if (id === 'codex') {
      const idToken = object(data.tokens)?.id_token
      if (typeof idToken === 'string') {
        try {
          identity = object(
            JSON.parse(Buffer.from(idToken.split('.')[1] ?? '', 'base64url').toString('utf8')),
          )
        } catch {
          // Malformed identity claims must not expose any part of the token.
        }
      }
    }
    if (id === 'claude' && !identity) return { status: 'missing' }
    // Explicit allowlist: neither token objects nor arbitrary auth fields reach the response.
    const account =
      id === 'claude' && typeof identity?.emailAddress === 'string'
        ? identity.emailAddress
        : typeof identity?.email === 'string'
          ? identity.email
          : undefined
    const planValue =
      id === 'claude'
        ? identity?.organizationType
        : object(identity?.['https://api.openai.com/auth'])?.chatgpt_plan_type
    const plan =
      typeof planValue === 'string'
        ? id === 'claude'
          ? planValue.replace(/^claude_/, '')
          : planValue
        : undefined
    const hasAuth =
      id === 'claude'
        ? Boolean(account)
        : Boolean(
            account ||
              data.auth_mode === 'apikey' ||
              object(data.tokens) ||
              (typeof data.OPENAI_API_KEY === 'string' && data.OPENAI_API_KEY),
          )
    return {
      status: hasAuth ? 'ok' : 'missing',
      ...(account ? { account } : {}),
      ...(plan ? { plan } : {}),
    }
  } catch {
    return { status: 'unknown' }
  }
}

/** Isolated instances keep fake probes and their caches out of the process-wide reader. */
export function createProviderReader(
  probe: ProviderProbe = systemProviderProbe,
  dependencies: {
    detect?: () => ReturnType<typeof detectInstalledClis>
    models?: (clis: ReturnType<typeof detectInstalledClis>) => Promise<CliModelCatalog[]>
    executor?: (root: string) => { agent?: string; model?: string } | undefined
    customClis?: () => ReturnType<
      typeof import('../../run/executors/cli-registry.ts').configuredClis
    >
  } = {},
) {
  const cache = new Map<string, { expires: number; value: ProviderSnapshot }>()
  let pending: Promise<ProviderSnapshot[]> | undefined
  let generation = 0
  const detect = dependencies.detect ?? (() => detectInstalledClis(() => null, probe))
  const models =
    dependencies.models ??
    (async (clis) =>
      (await readCliModelCatalogsCached()).filter((catalog) =>
        clis.some((cli) => cli.id === catalog.id),
      ))
  return async (root: string, refresh = false): Promise<ProviderSnapshot[]> => {
    if (refresh) {
      cache.clear()
      pending = undefined
    }
    const detected = detect()
    if (detected.some((cli) => (cache.get(cli.id)?.expires ?? -1) <= probe.now())) {
      if (!pending) {
        const currentGeneration = ++generation
        const cached = new Map(cache)
        const request = (async () => {
          const clis = detected.filter((cli) => (cache.get(cli.id)?.expires ?? -1) <= probe.now())
          const [catalogs, versions] = await Promise.all([
            models(clis).catch(() => [] as CliModelCatalog[]),
            Promise.all(
              clis.map(async (cli) => {
                if (!cli.path) return null
                const output = await probe.command(cli.path, ['--version'])
                const line = output?.split(/\r?\n/, 1)[0]?.trim()
                return line?.match(/\d+\.\d+(\.\d+)?([-+.][\w.]+)?/)?.[0] || line || null
              }),
            ),
          ])
          const custom = (dependencies.customClis ?? configuredClis)()
          const fresh = clis.map((cli, index): ProviderSnapshot => {
            const own = custom.find((entry) => entry.id === cli.id)
            return {
              id: cli.id,
              label: cli.label,
              installed: cli.installed,
              path: cli.path,
              version: versions[index] ?? null,
              auth: readAuth(cli.id, probe),
              models: own
                ? [
                    'default',
                    ...(own.modelArgs ? (own.models ?? []).filter((id) => id !== 'default') : []),
                  ]
                : (catalogs.find((entry) => entry.id === cli.id)?.models.map((model) => model.id) ??
                  []),
              taskEngine: taskEngineForCli(cli.id) !== undefined,
              session: cliChatAdapterFor(cli.id)?.terminal
                ? 'terminal'
                : cliChatAdapterFor(cli.id)?.chat
                  ? 'chat'
                  : null,
            }
          })
          if (generation === currentGeneration) {
            for (const value of fresh) {
              const catalog = catalogs.find((entry) => entry.id === value.id)
              if (!value.installed || (value.models.length > 0 && !catalog?.error))
                cache.set(value.id, { value, expires: probe.now() + 30_000 })
              else cache.delete(value.id)
            }
          }
          return detected.map(
            (cli) => fresh.find((value) => value.id === cli.id) ?? cached.get(cli.id)!.value,
          )
        })()
        pending = request
        void request
          .finally(() => {
            if (pending === request) pending = undefined
          })
          .catch(() => {})
      }
      const value = await pending
      // A refreshed request may have replaced the pending read. Use this request's result.
      return withDefault(value, root)
    }
    return withDefault(
      detected.map((cli) => cache.get(cli.id)!.value),
      root,
    )
  }

  function withDefault(value: ProviderSnapshot[], root: string): ProviderSnapshot[] {
    const executor = (
      dependencies.executor ?? ((directory) => loadOrcheConfig(directory).roles.executor)
    )(root)
    return value.map((cli) => ({
      ...cli,
      ...(executor?.agent === cli.id && executor.model ? { defaultModel: executor.model } : {}),
    }))
  }
}

const readProviders = createProviderReader()

export async function handleApiProviders(
  url: URL,
  root = process.cwd(),
  reader = readProviders,
): Promise<Response> {
  return jsonResponse({ providers: await reader(root, url.searchParams.get('refresh') === '1') })
}
