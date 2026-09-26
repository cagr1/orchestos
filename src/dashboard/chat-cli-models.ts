import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { registerNativeOpencodeModels } from '../router/opencode-catalog.ts'
import { detectInstalledClis } from '../run/executors/cli-registry.ts'

export interface CliModelOption {
  id: string
  name: string
  short: string
  efforts?: string[]
}

export interface CliModelCatalog {
  id: string
  models: CliModelOption[]
  efforts: string[]
  error?: string
}

type CommandRunner = (
  command: string,
  args: string[],
) => Promise<{ stdout: string; exitCode: number }>

const defaultRunner: CommandRunner = async (command, args) => {
  const process = Bun.spawn([command, ...args], { stdout: 'pipe', stderr: 'ignore' })
  const [stdout, exitCode] = await Promise.all([
    new Response(process.stdout).text(),
    process.exited,
  ])
  return { stdout, exitCode }
}

export function parseCodexModelsCache(raw: string): CliModelOption[] {
  try {
    const parsed = JSON.parse(raw) as { models?: unknown }
    if (!Array.isArray(parsed.models)) return []
    return parsed.models.flatMap((entry) => {
      if (!entry || typeof entry !== 'object') return []
      const model = entry as {
        slug?: unknown
        display_name?: unknown
        supported_reasoning_levels?: unknown
      }
      if (typeof model.slug !== 'string' || !model.slug) return []
      const efforts = Array.isArray(model.supported_reasoning_levels)
        ? model.supported_reasoning_levels.flatMap((level) => {
            if (!level || typeof level !== 'object') return []
            const effort = (level as { effort?: unknown }).effort
            return typeof effort === 'string' && effort ? [effort] : []
          })
        : []
      const name = typeof model.display_name === 'string' ? model.display_name : model.slug
      return [{ id: model.slug, name, short: name, efforts }]
    })
  } catch {
    return []
  }
}

export function parseClaudeHelp(raw: string): { models: CliModelOption[]; efforts: string[] } {
  const aliasMatch = raw.match(/--model[\s\S]{0,320}?\(e\.g\.[\s\S]*?\)/i)
  const models = aliasMatch
    ? [...aliasMatch[0].matchAll(/['"]([^'"]+)['"]/g)].map((match) => {
        const id = match[1] ?? ''
        return { id, name: id, short: id }
      })
    : []
  const effortMatch = raw.match(/--effort[\s\S]{0,240}?\(([^)]+)\)/i)
  const efforts = effortMatch
    ? (effortMatch[1] ?? '')
        .split(/[|,\s]+/)
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean)
    : []
  return { models, efforts: [...new Set(efforts)] }
}

export function formatClaudeModelIds(ids: string[]): CliModelOption[] {
  const normalized = new Map<string, string>()
  for (const id of ids.filter((value) => value.startsWith('claude-'))) {
    const key = id.replace(/-\d{8}$/, '')
    const existing = normalized.get(key)
    if (!existing || /-\d{8}$/.test(id)) normalized.set(key, id)
  }
  const familyOrder = ['fable', 'opus', 'sonnet', 'haiku']
  return [...normalized.entries()]
    .map(([key, id]) => {
      const [, family = 'model', ...version] = key.split('-')
      const label = `${family[0]?.toUpperCase() ?? ''}${family.slice(1)}${version.length ? ` ${version.join('.')}` : ''}`
      return { id, name: label, short: label, family, version }
    })
    .sort((a, b) => {
      const family = familyOrder.indexOf(a.family) - familyOrder.indexOf(b.family)
      if (family !== 0) return family
      return b.version.join('.').localeCompare(a.version.join('.'), undefined, { numeric: true })
    })
    .map(({ id, name, short }) => ({ id, name, short }))
}

function readClaudeModelIds(home: string): CliModelOption[] {
  const ids = new Set<string>()
  try {
    const stats = JSON.parse(readFileSync(`${home}/.claude/stats-cache.json`, 'utf8')) as {
      modelUsage?: Record<string, unknown>
    }
    for (const id of Object.keys(stats.modelUsage ?? {})) if (id.startsWith('claude-')) ids.add(id)
  } catch {
    // Optional source: statusLine is checked independently below.
  }
  try {
    const status = JSON.parse(
      readFileSync(`${home}/.orchestos/claude-statusline.json`, 'utf8'),
    ) as {
      model?: { id?: unknown }
    }
    if (typeof status.model?.id === 'string' && status.model.id.startsWith('claude-'))
      ids.add(status.model.id)
  } catch {
    // No statusLine payload is a valid no-data state.
  }
  return formatClaudeModelIds([...ids])
}

export function parseOpencodeModels(raw: string): CliModelOption[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('Warning:') && !line.startsWith('Error:'))
    .flatMap((line) => {
      const id = line.match(/^([\w.-]+\/[\w./:@-]+)(?:\s|$)/)?.[1] ?? line
      if (!id.includes('/')) return []
      return [{ id, name: id, short: id }]
    })
}

async function readCliCatalog(
  id: string,
  binary: string,
  runner: CommandRunner,
  home = homedir(),
): Promise<CliModelCatalog> {
  if (id === 'codex') {
    const path = `${home}/.codex/models_cache.json`
    const models = existsSync(path) ? parseCodexModelsCache(readFileSync(path, 'utf8')) : []
    return { id, models, efforts: [...new Set(models.flatMap((model) => model.efforts ?? []))] }
  }
  if (id === 'claude') {
    const result = await runner(binary, ['--help'])
    const parsed = parseClaudeHelp(result.stdout)
    const versions = readClaudeModelIds(home)
    return { id, models: versions.length ? versions : parsed.models, efforts: parsed.efforts }
  }
  if (id === 'opencode') {
    const [modelsResult] = await Promise.all([
      runner(binary, ['models']),
      runner(binary, ['run', '--help']),
    ])
    return { id, models: parseOpencodeModels(modelsResult.stdout), efforts: [] }
  }
  return { id, models: [], efforts: [] }
}

export async function readCliModelCatalogs(
  runner: CommandRunner = defaultRunner,
  detectedClis = detectInstalledClis(),
): Promise<CliModelCatalog[]> {
  const installed = detectedClis.filter((cli) => cli.installed)
  const catalogs = await Promise.all(
    installed.map(async (cli): Promise<CliModelCatalog> => {
      try {
        return await readCliCatalog(cli.id, cli.binary, runner)
      } catch (error) {
        return {
          id: cli.id,
          models: [],
          efforts: [],
          error: error instanceof Error ? error.message : String(error),
        }
      }
    }),
  )
  const opencode = catalogs.find((catalog) => catalog.id === 'opencode')
  if (opencode) registerNativeOpencodeModels(opencode.models.map((model) => model.id))
  return catalogs
}
