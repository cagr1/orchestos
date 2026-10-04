import { realpathSync, statSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { globSync } from 'glob'

export interface CliTranscriptUsage {
  date: string
  provider: 'claude' | 'codex'
  model: string
  sessionId: string
  inputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  cacheWrite1hTokens: number
  outputTokens: number
}

type ParsedFile = { size: number; mtimeMs: number; rows: CliTranscriptUsage[] }
const parsedFiles = new Map<string, ParsedFile>()

const object = (value: unknown): Record<string, any> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, any>)
    : null
const nonNegative = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0
const dateOf = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const time = Date.parse(value)
  return Number.isFinite(time) ? new Date(time).toISOString().slice(0, 10) : null
}

function claudeKey(root: string): string {
  return root.replace(/[^a-zA-Z0-9]/g, '-')
}

function belongsToProject(cwd: unknown, roots: string[]): boolean {
  if (typeof cwd !== 'string') return false
  let real: string | undefined
  try {
    real = realpathSync(cwd)
  } catch {
    /* A removed worktree can still be attributed by its recorded path. */
  }
  const absolute = resolve(cwd)
  return roots.some((root) =>
    [root, resolve(root)].some((candidate) =>
      [real, absolute].some((path) => path === candidate || path?.startsWith(`${candidate}${sep}`)),
    ),
  )
}

async function cachedParse(path: string, parser: (content: string) => CliTranscriptUsage[]) {
  try {
    const stat = statSync(path)
    const cached = parsedFiles.get(path)
    if (cached?.size === stat.size && cached.mtimeMs === stat.mtimeMs) return cached.rows
    const rows = parser(await readFile(path, 'utf8'))
    parsedFiles.set(path, { size: stat.size, mtimeMs: stat.mtimeMs, rows })
    return rows
  } catch {
    return []
  }
}

function parseClaude(content: string): CliTranscriptUsage[] {
  let sessionId: string | undefined
  const seen = new Set<string>()
  const rows: CliTranscriptUsage[] = []
  for (const line of content.split('\n')) {
    try {
      const entry = object(JSON.parse(line))
      if (!entry) continue
      if (!sessionId && typeof entry.sessionId === 'string') sessionId = entry.sessionId
      const message = object(entry.message)
      if (entry.type !== 'assistant' || !message || typeof message.id !== 'string') continue
      if (seen.has(message.id)) continue
      seen.add(message.id)
      const usage = object(message.usage)
      const date = dateOf(entry.timestamp)
      if (!usage || !date || !sessionId || typeof message.model !== 'string') continue
      const creation = object(usage.cache_creation)
      const cacheWrite1hTokens = creation ? nonNegative(creation.ephemeral_1h_input_tokens) : 0
      const cacheWriteTokens =
        usage.cache_creation_input_tokens !== undefined
          ? nonNegative(usage.cache_creation_input_tokens)
          : creation
            ? nonNegative(creation.ephemeral_1h_input_tokens) +
              nonNegative(creation.ephemeral_5m_input_tokens)
            : 0
      rows.push({
        date,
        provider: 'claude',
        model: message.model,
        sessionId,
        inputTokens: nonNegative(usage.input_tokens),
        cacheReadTokens: nonNegative(usage.cache_read_input_tokens),
        cacheWriteTokens,
        cacheWrite1hTokens,
        outputTokens: nonNegative(usage.output_tokens),
      })
    } catch {
      // Ignore malformed or partial JSONL records.
    }
  }
  return rows
}

function parseCodex(content: string, roots: string[]): CliTranscriptUsage[] {
  let sessionId: string | undefined
  let model: string | undefined
  let latest: { date: string; usage: Record<string, unknown> } | undefined
  let cwd: unknown
  for (const line of content.split('\n')) {
    try {
      const entry = object(JSON.parse(line))
      if (!entry) continue
      const payload = object(entry.payload)
      if (entry.type === 'session_meta' && payload) {
        if (typeof payload.id === 'string') sessionId = payload.id
        cwd = payload.cwd
      }
      if (entry.type === 'turn_context' && payload && typeof payload.model === 'string')
        model = payload.model
      if (payload?.type === 'token_count') {
        const info = object(payload.info)
        const usage = object(info?.total_token_usage)
        const date = dateOf(entry.timestamp)
        if (usage && date) latest = { date, usage }
      }
    } catch {
      // Ignore malformed or partial JSONL records.
    }
  }
  if (!sessionId || !model || !latest || !belongsToProject(cwd, roots)) return []
  const usage = latest.usage
  const cacheReadTokens = nonNegative(usage.cached_input_tokens)
  const cacheWriteTokens = nonNegative(usage.cache_write_input_tokens)
  return [
    {
      date: latest.date,
      provider: 'codex',
      model,
      sessionId,
      inputTokens: Math.max(0, nonNegative(usage.input_tokens) - cacheReadTokens),
      cacheReadTokens,
      cacheWriteTokens,
      cacheWrite1hTokens: 0,
      outputTokens: nonNegative(usage.output_tokens),
    },
  ]
}

export async function readCliTranscriptUsage(
  projectRoots: string[],
  agentHome?: string,
): Promise<CliTranscriptUsage[]> {
  const rootAliases = projectRoots.flatMap((root) => {
    try {
      return [realpathSync(root), resolve(root)]
    } catch {
      return []
    }
  })
  const roots = [...new Set(rootAliases)]
  if (!roots.length) return []
  const homes = new Set<string>()
  const addHome = (path: string) => {
    try {
      homes.add(realpathSync(path))
    } catch {
      /* Ignore absent optional homes. */
    }
  }
  if (agentHome !== undefined) {
    addHome(join(agentHome, '.claude'))
    addHome(join(agentHome, '.codex'))
  } else {
    if (process.env.CLAUDE_CONFIG_DIR) addHome(process.env.CLAUDE_CONFIG_DIR)
    addHome(join(homedir(), '.claude'))
    if (process.env.CODEX_HOME) addHome(process.env.CODEX_HOME)
    addHome(join(homedir(), '.codex'))
    for (const accountHome of globSync('*/home', {
      cwd: join(homedir(), 'Library', 'Application Support', 'orca', 'codex-accounts'),
      absolute: true,
    }))
      addHome(accountHome)
  }
  const paths = new Set<string>()
  for (const root of roots) {
    const key = claudeKey(root)
    for (const home of homes) {
      const claudeDir = join(home, 'projects')
      const projectFiles = [
        ...globSync(`${key}/**/*.jsonl`, { cwd: claudeDir, absolute: true, nodir: true }),
        ...globSync(`${key}--orchestos-worktrees-*/**/*.jsonl`, {
          cwd: claudeDir,
          absolute: true,
          nodir: true,
        }),
      ]
      for (const folder of projectFiles) paths.add(folder)
    }
  }
  const codexPaths = new Set<string>()
  for (const home of homes) {
    for (const path of globSync('**/rollout-*.jsonl', {
      cwd: join(home, 'sessions'),
      absolute: true,
      nodir: true,
    }))
      codexPaths.add(path)
  }
  for (const path of codexPaths) paths.add(path)

  const rows = await Promise.all(
    [...paths].map(async (path) => {
      const isCodex = codexPaths.has(path)
      return cachedParse(path, (content) =>
        isCodex ? parseCodex(content, roots) : parseClaude(content),
      )
    }),
  )
  const aggregated = new Map<string, CliTranscriptUsage>()
  const seenCodexSessions = new Set<string>()
  for (const row of rows.flat()) {
    if (row.provider === 'codex') {
      if (seenCodexSessions.has(row.sessionId)) continue
      seenCodexSessions.add(row.sessionId)
    }
    const key = `${row.date}\u0000${row.provider}\u0000${row.sessionId}\u0000${row.model}`
    const current = aggregated.get(key)
    if (!current) aggregated.set(key, { ...row })
    else {
      current.inputTokens += row.inputTokens
      current.cacheReadTokens += row.cacheReadTokens
      current.cacheWriteTokens += row.cacheWriteTokens
      current.cacheWrite1hTokens += row.cacheWrite1hTokens
      current.outputTokens += row.outputTokens
    }
  }
  return [...aggregated.values()]
}
