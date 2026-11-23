import type { CliModelCatalog } from '../../api/chat'
import type { ExecutorMode } from '../../api/settings'
import { isFunctionalDevCli } from '../dev/new-session-agent'
import { cliDisplayName } from './AgentComposer'

export interface LaunchOption {
  id: string
  label: string
  mode: ExecutorMode
  state: 'ready' | 'not-installed' | 'setup-required'
  shortcut?: string
}

export function buildLaunchOptions(
  modes: ExecutorMode[],
  catalogs: CliModelCatalog[],
  lastAgent?: string,
): LaunchOption[] {
  return (
    modes
      .filter((mode) => mode.session != null)
      .map((mode): LaunchOption => {
        const catalog = catalogs.find((catalog) => catalog.id === mode.id)
        return {
          id: mode.id,
          label: cliDisplayName(mode.id, mode.label),
          mode,
          state: !mode.detected
            ? 'not-installed'
            : catalog && !isFunctionalDevCli(catalog)
              ? 'setup-required'
              : 'ready',
        }
      })
      .sort((a, b) => Number(b.id === lastAgent) - Number(a.id === lastAgent))
      // Instalados primero; `sort` es estable y conserva el orden dentro de cada grupo (USO.42).
      .sort((a, b) => Number(a.state === 'not-installed') - Number(b.state === 'not-installed'))
  )
}

export function filterLaunchOptions(options: LaunchOption[], query: string): LaunchOption[] {
  const search = query.toLowerCase()
  return options.filter((option) =>
    [option.id, option.label].some((value) => value.toLowerCase().includes(search)),
  )
}

export function nextLaunchIndex(options: LaunchOption[], current: number, delta: number): number {
  for (let offset = 1; offset <= options.length; offset++) {
    const index = (((current + delta * offset) % options.length) + options.length) % options.length
    if (options[index].state === 'ready') return index
  }
  return -1
}
