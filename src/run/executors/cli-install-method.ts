import { existsSync, realpathSync } from 'node:fs'
import { homedir } from 'node:os'

export type CliLatestSource = { kind: 'npm'; pkg: string } | { kind: 'github'; repo: string }
export type CliInstallMethod = 'npm' | 'bun' | 'brew' | 'curl' | 'standalone' | 'native' | 'unknown'
export interface CliInstall {
  method: CliInstallMethod
  command: string[] | null
  latest: CliLatestSource | null
  realPath: string
  managerDir?: string
}
export interface CliInstallProbe {
  realpath(path: string): string
  exists(path: string): boolean
  platform: NodeJS.Platform
  home: string
}
const systemProbe: CliInstallProbe = {
  realpath: realpathSync,
  exists: existsSync,
  platform: process.platform,
  home: homedir(),
}
const packages: Record<string, string> = {
  claude: '@anthropic-ai/claude-code',
  codex: '@openai/codex',
  opencode: 'opencode-ai',
}

export function detectCliInstall(
  cliId: string,
  binaryPath: string,
  probe = systemProbe,
): CliInstall {
  let realPath = binaryPath
  let resolved = false
  try {
    realPath = probe.realpath(binaryPath).replaceAll('\\', '/')
    resolved = true
  } catch {}
  const pkg = Object.hasOwn(packages, cliId) ? packages[cliId] : undefined
  const result: CliInstall = { method: 'unknown', command: null, latest: null, realPath }
  if (!pkg) return result
  const finish = () => {
    result.latest =
      cliId === 'opencode' && result.method !== 'npm' && result.method !== 'bun'
        ? { kind: 'github', repo: 'anomalyco/opencode' }
        : { kind: 'npm', pkg }
    if (cliId === 'opencode' && result.command)
      result.command = [binaryPath, 'upgrade', '--method', result.method]
    return result
  }
  if (!resolved) return finish()
  const npmMarker = `/lib/node_modules/${pkg}/`
  const npmIndex = realPath.indexOf(npmMarker)
  const bunMarker = `/.bun/install/global/node_modules/${pkg}/`
  const bunIndex = realPath.indexOf(bunMarker)
  const brew = realPath.match(/^(.*)\/(Cellar|Caskroom)\/([^/]+)\//)
  if (npmIndex >= 0 && probe.exists(`${realPath.slice(0, npmIndex)}/bin/npm`)) {
    result.method = 'npm'
    result.managerDir = `${realPath.slice(0, npmIndex)}/bin`
    result.command =
      cliId === 'claude'
        ? [binaryPath, 'update']
        : [`${result.managerDir}/npm`, 'install', '-g', `${pkg}@latest`]
  } else if (bunIndex >= 0 && probe.exists(`${realPath.slice(0, bunIndex)}/.bun/bin/bun`)) {
    result.method = 'bun'
    result.managerDir = `${realPath.slice(0, bunIndex)}/.bun/bin`
    result.command = [`${result.managerDir}/bun`, 'add', '-g', `${pkg}@latest`]
  } else if (brew?.[3] && probe.exists(`${brew[1]}/bin/brew`)) {
    result.method = 'brew'
    result.managerDir = `${brew[1]}/bin`
    result.command = [
      `${result.managerDir}/brew`,
      'upgrade',
      ...(brew[2] === 'Caskroom' ? ['--cask'] : []),
      brew[3],
    ]
  } else {
    const home = probe.home.replaceAll('\\', '/').replace(/\/$/, '')
    if (cliId === 'claude' && realPath.startsWith(`${home}/.local/share/claude/versions/`)) {
      result.method = 'native'
      result.command = [binaryPath, 'update']
    } else if (cliId === 'codex' && realPath.startsWith(`${home}/.codex/packages/standalone/`)) {
      result.method = 'standalone'
      result.command = [binaryPath, 'update']
    } else if (cliId === 'opencode' && realPath.startsWith(`${home}/.opencode/bin/`)) {
      result.method = 'curl'
      result.command = [binaryPath, 'upgrade', '--method', 'curl']
    }
  }
  return finish()
}

export function cliInstallReason(label: string, realPath: string): string {
  return `OrchestOS can't tell how ${label} was installed (${realPath}). Update it the way you installed it.`
}
