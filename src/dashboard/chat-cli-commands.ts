import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, join, relative } from 'node:path'
import { parseJson, parseYamlText, z } from '../boundary'
import { findClaudeBinary } from '../run/executors/external.ts'
import { safeChildEnv } from '../run/path-policy.ts'
import { killTree, spawnTree } from '../run/process-tree.ts'
import type { CliCommand } from './types.ts'

export const ORCHESTOS_COMMAND_NAMES = new Set(['rename', 'usage', 'model', 'archive'])
// review/start emits a turn outside the registered chat turn: its events are currently dropped.
export const CODEX_COMMANDS: CliCommand[] = [
  {
    name: 'compact',
    description: 'Compact this conversation',
    cli: 'codex',
    kind: 'rpc',
    source: 'builtin',
  },
]

const commandEntrySchema = z.union([
  z.string(),
  z.object({ name: z.string(), description: z.string().optional() }).passthrough(),
])
const claudeInitSchema = z
  .object({
    type: z.literal('system'),
    subtype: z.literal('init'),
    slash_commands: z.array(commandEntrySchema).optional(),
    skills: z.array(commandEntrySchema).optional(),
    terminal_slash_commands: z.array(commandEntrySchema).optional(),
  })
  .passthrough()
const claudeDescriptionSchema = z.object({ description: z.string().optional() }).passthrough()

export function parseClaudeCommands(raw: string): CliCommand[] {
  for (const line of raw.split('\n')) {
    const parsed = parseJson(claudeInitSchema, line)
    if (!parsed.ok) continue
    const event = parsed.data
    const nameOf = (entry: unknown): string => {
      if (typeof entry === 'string') return entry.replace(/^\//, '')
      if (entry && typeof entry === 'object' && 'name' in entry && typeof entry.name === 'string')
        return entry.name.replace(/^\//, '')
      return ''
    }
    const terminal = new Set(
      (Array.isArray(event.terminal_slash_commands) ? event.terminal_slash_commands : []).map(
        nameOf,
      ),
    )
    const skills = new Set((event.skills ?? []).map(nameOf))
    const commands = new Map<string, CliCommand>()
    for (const entry of [
      ...(Array.isArray(event.slash_commands) ? event.slash_commands : []),
      ...(Array.isArray(event.skills) ? event.skills : []),
    ]) {
      const name = nameOf(entry)
      if (
        !name ||
        name.startsWith('_') ||
        /\s/.test(name) ||
        terminal.has(name) ||
        ORCHESTOS_COMMAND_NAMES.has(name)
      )
        continue
      const description =
        typeof entry === 'object' && typeof entry.description === 'string' ? entry.description : ''
      const existing = commands.get(name)
      if (existing) {
        if (!existing.description) existing.description = description
        continue
      }
      commands.set(name, {
        name,
        description,
        cli: 'claude',
        kind: 'prompt',
        source: name.includes(':') ? 'plugin' : skills.has(name) ? 'skill' : 'builtin',
        ...(name.includes(':') ? { plugin: name.split(':')[0] } : {}),
      })
    }
    return [...commands.values()]
  }
  return []
}

const CLAUDE_DESCRIPTIONS: Record<string, string> = {
  compact: 'Compact this conversation',
  context: 'Show context usage',
  config: 'Configure Claude',
  clear: 'Clear this conversation',
  init: 'Initialize project instructions',
  review: 'Review code changes',
  'security-review': 'Review changes for security issues',
  mcp: 'Manage MCP servers',
  agents: 'Manage agents',
  effort: 'Set reasoning effort',
  fast: 'Toggle fast mode',
  'output-style': 'Choose an output style',
  recap: 'Recap this conversation',
  insights: 'Explore usage insights',
  goal: 'Set a conversation goal',
  loop: 'Repeat a prompt on an interval',
  schedule: 'Schedule a task',
  batch: 'Run changes in parallel',
  simplify: 'Simplify changed code',
  debug: 'Debug a problem',
  verify: 'Verify changes',
  'code-review': 'Review code',
  autocompact: 'Configure automatic compaction',
  'plugin-authoring': 'Create a Claude plugin',
  'auto-mode-setup': 'Configure auto mode',
  heapdump: 'Save a memory diagnostic',
  'workflow-launch-exec': 'Run a workflow',
  'reload-skills': 'Reload available skills',
  'design-consent': 'Enable design tools',
  'design-revoke': 'Revoke design tools',
  'list-agents': 'List available agents',
  'team-onboarding': 'Set up your team',
}

type ClaudeCommandMetadata = Pick<CliCommand, 'source' | 'plugin'> & { description?: string }

function claudeDescriptions(cwd: string, home: string): Map<string, ClaudeCommandMetadata> {
  const descriptions = new Map<string, ClaudeCommandMetadata>()
  const collect = (root: string, pattern: string, plugin = false) => {
    try {
      for (const file of new Bun.Glob(pattern).scanSync({
        cwd: root,
        onlyFiles: true,
        followSymlinks: true,
      })) {
        try {
          const name =
            basename(file) === 'SKILL.md' ? basename(dirname(file)) : basename(file, '.md')
          const parts = relative(root, join(root, file)).split('/')
          const category = parts.findIndex((part) => part === 'commands' || part === 'skills')
          // Cache layout: cache/<marketplace>/<plugin>/<version>/{commands,skills}/...
          const pluginName = plugin
            ? parts[0] === 'cache'
              ? parts[2]
              : parts[category - 1]
            : undefined
          const metadata: ClaudeCommandMetadata = {
            source: plugin ? 'plugin' : basename(file) === 'SKILL.md' ? 'skill' : 'custom',
            ...(pluginName ? { plugin: pluginName } : {}),
          }
          const raw = readFileSync(join(root, file), 'utf8')
          const header = raw.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1]
          if (header) {
            const parsed = parseYamlText(claudeDescriptionSchema, header)
            if (parsed.ok && parsed.data.description)
              metadata.description = parsed.data.description.replace(/\s+/g, ' ').trim()
          }
          if (!descriptions.has(name)) descriptions.set(name, metadata)
          if (pluginName && !descriptions.has(`${pluginName}:${name}`))
            descriptions.set(`${pluginName}:${name}`, metadata)
        } catch {
          /* A missing or malformed frontmatter falls back to the built-in description. */
        }
      }
    } catch {
      /* Command directories are optional. */
    }
  }
  for (const root of [join(cwd, '.claude'), join(home, '.claude')]) {
    collect(root, 'commands/**/*.md')
    collect(root, 'skills/*/SKILL.md')
  }
  collect(join(home, '.claude/plugins'), '**/commands/**/*.md', true)
  collect(join(home, '.claude/plugins'), '**/skills/*/SKILL.md', true)
  return descriptions
}

export interface CliCommandProbe {
  findBinary(): string | null
  run(binary: string, args: string[], cwd: string, timeoutMs: number): Promise<string>
}

export const systemCliCommandProbe: CliCommandProbe = {
  findBinary: findClaudeBinary,
  async run(binary, args, cwd, timeoutMs) {
    const child = spawnTree([binary, ...args], {
      cwd,
      env: safeChildEnv(),
      stdin: 'ignore',
      stdout: 'pipe',
      stderr: 'ignore',
    })
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      return await Promise.race([
        Promise.all([new Response(child.stdout).text(), child.exited]).then(([stdout]) => stdout),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            killTree(child, 'SIGKILL')
            reject(new Error('CLI command discovery timed out'))
          }, timeoutMs)
        }),
      ])
    } finally {
      if (timer) clearTimeout(timer)
    }
  },
}

export function createCliCommandReader(
  deps: {
    probe?: CliCommandProbe
    now?: () => number
    log?: (message: string) => void
    home?: string
  } = {},
) {
  const probe = deps.probe ?? systemCliCommandProbe
  const now = deps.now ?? Date.now
  const log = deps.log ?? console.warn
  const cache = new Map<string, { expiresAt: number; commands: Promise<CliCommand[]> }>()
  return async (cli: string, cwd: string): Promise<CliCommand[]> => {
    if (cli === 'codex') return CODEX_COMMANDS
    if (cli !== 'claude') return []
    const existing = cache.get(cwd)
    if (existing && existing.expiresAt > now()) return existing.commands
    const commands = Promise.resolve().then(async () => {
      try {
        const binary = probe.findBinary()
        if (!binary) return []
        const discovered = parseClaudeCommands(
          await probe.run(
            binary,
            [
              '-p',
              '/context',
              '--output-format',
              'stream-json',
              '--verbose',
              '--no-session-persistence',
            ],
            cwd,
            10_000,
          ),
        )
        const descriptions = claudeDescriptions(cwd, deps.home ?? homedir())
        return discovered.map((command) => ({
          ...command,
          ...descriptions.get(command.name),
          ...(command.name.includes(':')
            ? { source: 'plugin' as const, plugin: command.name.split(':')[0] }
            : {}),
          description:
            command.description ||
            descriptions.get(command.name)?.description ||
            (Object.hasOwn(CLAUDE_DESCRIPTIONS, command.name)
              ? CLAUDE_DESCRIPTIONS[command.name]
              : undefined) ||
            'Claude command',
        }))
      } catch (error) {
        log(`[cli-commands] ${error instanceof Error ? error.message : String(error)}`)
        return []
      }
    })
    const entry = { expiresAt: Number.POSITIVE_INFINITY, commands }
    cache.set(cwd, entry)
    void commands.then(() => {
      entry.expiresAt = now() + 5 * 60_000
    })
    return commands
  }
}

export const readCliCommands = createCliCommandReader()
