import { homedir } from 'node:os'
import { delimiter, join } from 'node:path'

export interface CliDiscoveryProbe {
  env: Record<string, string | undefined>
  home: string
  loginPath(shell: string): string | null
  which(binary: string, path: string): string | null
}

let loginPath: string | null | undefined
export const systemCliDiscoveryProbe: CliDiscoveryProbe = {
  env: process.env,
  home: homedir(),
  loginPath(shell) {
    if (loginPath !== undefined) return loginPath
    loginPath = null
    try {
      const result = Bun.spawnSync([shell, '-lic', 'printenv PATH'], {
        env: process.env,
        timeout: 3_000,
        stderr: 'ignore',
      })
      if (result.exitCode === 0)
        loginPath = result.stdout.toString().trim().split(/\r?\n/).at(-1) ?? null
    } catch {}
    return loginPath
  },
  which: (binary, path) => Bun.which(binary, { PATH: path }),
}

export function cliSearchPath(probe: CliDiscoveryProbe = systemCliDiscoveryProbe): string {
  const shellPath = probe.env.SHELL ? probe.loginPath(probe.env.SHELL) : null
  return [
    ...new Set(
      [
        ...(probe.env.PATH ?? '').split(delimiter),
        ...(shellPath ?? '').split(delimiter),
        join(probe.home, '.local/bin'),
        join(probe.home, '.bun/bin'),
        '/opt/homebrew/bin',
        '/usr/local/bin',
        join(probe.home, '.opencode/bin'),
      ].filter(Boolean),
    ),
  ].join(delimiter)
}

let searchPathApplied = false

const SEARCH_PATH_MARKER = 'ORCHESTOS_CLI_SEARCH_PATH'

/** Deja el PATH de detección como PATH del proceso, para que lo que se detecta se lance por nombre. Con la sonda del sistema, una vez por proceso. El marcador evita repetir el login shell (0,64 s) en procesos hijos que ya heredan el PATH ampliado. */
export function applyCliSearchPath(probe: CliDiscoveryProbe = systemCliDiscoveryProbe): void {
  const isSystem = probe === systemCliDiscoveryProbe
  if (isSystem) {
    if (searchPathApplied) return
    searchPathApplied = true
  }
  const inherited = probe.env[SEARCH_PATH_MARKER] === '1'
  process.env.PATH = cliSearchPath(inherited ? { ...probe, loginPath: () => null } : probe)
  if (isSystem) process.env[SEARCH_PATH_MARKER] = '1'
}

/** `Bun.which` con el PATH actual de `process.env` (Bun no lo relee solo en runtime). */
export function whichCli(binary: string): string | null {
  return Bun.which(binary, { PATH: process.env.PATH ?? '' })
}
