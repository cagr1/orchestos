import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { type CliDiscoveryProbe, cliSearchPath, systemCliDiscoveryProbe } from './cli-discovery.ts'
import { allClis, type CliDefinition } from './cli-registry.ts'

export type CliAuthStatus = 'ok' | 'missing' | 'unknown'
export interface CliHealth {
  id: string
  installed: boolean
  path: string | null
  version: string | null
  auth: CliAuthStatus
  authDetail?: string
  checkedAt: number
  functional: boolean
}

export interface CliHealthProbe extends CliDiscoveryProbe {
  readFile(path: string): string | null
  command(binary: string, args: string[]): Promise<string | null>
  authCommand(
    binary: string,
    args: string[],
  ): Promise<{
    stdout: string
    stderr?: string
    exitCode: number
  }>
  now(): number
}

async function command(binary: string, args: string[]) {
  const proc = Bun.spawn([binary, ...args], {
    env: { ...process.env, PATH: cliSearchPath(systemCliDiscoveryProbe) },
    stdout: 'pipe',
    stderr: 'pipe',
    timeout: 5_000,
  })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  if (proc.signalCode) throw new Error('CLI probe timed out or was terminated')
  return { stdout, stderr, exitCode }
}

export const systemCliHealthProbe: CliHealthProbe = {
  ...systemCliDiscoveryProbe,
  now: Date.now,
  authCommand: command,
  readFile(path) {
    try {
      return readFileSync(path, 'utf8')
    } catch {
      return null
    }
  },
  async command(binary, args) {
    try {
      const result = await command(binary, args)
      return result.exitCode === 0 ? result.stdout : null
    } catch {
      return null
    }
  },
}

const PROVIDER_KEYS = [
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
  'OPENROUTER_API_KEY',
  'GOOGLE_API_KEY',
  'GEMINI_API_KEY',
  'DEEPSEEK_API_KEY',
  'GROQ_API_KEY',
  'MISTRAL_API_KEY',
  'XAI_API_KEY',
]

async function authFor(
  cli: CliDefinition,
  path: string,
  probe: CliHealthProbe,
): Promise<Pick<CliHealth, 'auth' | 'authDetail'>> {
  if (cli.generic) return { auth: 'unknown' }
  if (cli.id === 'opencode') {
    try {
      const dataHome = probe.env.XDG_DATA_HOME || join(probe.env.HOME || homedir(), '.local/share')
      const contents = probe.readFile(join(dataHome, 'opencode/auth.json'))
      if (contents?.trim()) {
        const credentials = JSON.parse(contents)
        if (!credentials || typeof credentials !== 'object' || Array.isArray(credentials)) {
          return { auth: 'unknown', authDetail: 'Invalid OpenCode credentials format' }
        }
        if (Object.keys(credentials).length > 0) return { auth: 'ok' }
      }
      return { auth: PROVIDER_KEYS.some((key) => probe.env[key]?.trim()) ? 'unknown' : 'missing' }
    } catch {
      return { auth: 'unknown', authDetail: 'Unable to read OpenCode credentials' }
    }
  }
  const args =
    cli.id === 'claude' ? ['auth', 'status'] : cli.id === 'codex' ? ['login', 'status'] : null
  if (!args) return { auth: 'unknown' }
  try {
    const result = await probe.authCommand(path, args)
    const text = `${result.stdout}\n${result.stderr ?? ''}`.replace(/\x1b\[[0-9;]*m/g, '')
    if (cli.id === 'codex') {
      if (/not logged in/i.test(text) || result.exitCode !== 0) return { auth: 'missing' }
      if (/logged in/i.test(text)) return { auth: 'ok' }
    } else if (cli.id === 'claude') {
      const data = JSON.parse(result.stdout)
      if (typeof data?.loggedIn === 'boolean' && (!data.loggedIn || result.exitCode === 0)) {
        const detail = [data.authMethod, data.subscriptionType]
          .filter((value) => typeof value === 'string')
          .join(' · ')
        return {
          auth: data.loggedIn ? 'ok' : 'missing',
          ...(detail ? { authDetail: detail } : {}),
        }
      }
    }
    return { auth: 'unknown', authDetail: `Unrecognized auth response (exit ${result.exitCode})` }
  } catch (error) {
    return { auth: 'unknown', authDetail: error instanceof Error ? error.message : String(error) }
  }
}

/** Each reader owns its cache; injected probes never share host state. */
export function createCliHealthReader(
  probe: CliHealthProbe = systemCliHealthProbe,
  definitions: () => CliDefinition[] = allClis,
) {
  const cache = new Map<string, { expires: number; value: Promise<CliHealth> }>()
  return async (refresh = false): Promise<CliHealth[]> => {
    if (refresh) cache.clear()
    const searchPath = cliSearchPath(probe)
    return Promise.all(
      definitions().map((cli) => {
        const path = probe.which(cli.binary, searchPath)
        const key = JSON.stringify([cli.id, cli.binary, cli.generic, path])
        const cached = cache.get(key)
        if (cached && cached.expires > probe.now()) return cached.value
        const value = (async (): Promise<CliHealth> => {
          const checkedAt = probe.now()
          if (!path)
            return {
              id: cli.id,
              installed: false,
              path,
              version: null,
              auth: 'unknown',
              checkedAt,
              functional: false,
            }
          const [output, auth] = await Promise.all([
            probe.command(path, ['--version']).catch(() => null),
            authFor(cli, path, probe),
          ])
          const line = output?.split(/\r?\n/, 1)[0]?.trim()
          const version = line?.match(/\d+\.\d+(\.\d+)?([-+.][\w.]+)?/)?.[0] || line || null
          return {
            id: cli.id,
            installed: true,
            path,
            version,
            ...auth,
            checkedAt,
            functional: auth.auth !== 'missing',
          }
        })()
        cache.set(key, { expires: probe.now() + 5 * 60_000, value })
        return value
      }),
    )
  }
}

export const readCliHealth = createCliHealthReader()
