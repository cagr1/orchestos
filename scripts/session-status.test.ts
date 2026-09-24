import { afterEach, describe, expect, test } from 'bun:test'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  discoverSessionTranscripts,
  readActiveSessionStatus,
  readActiveSessionStatuses,
  readClaudeStatuslineRateLimits,
} from './session-status.ts'

const roots: string[] = []
const originalStatuslineHome = process.env.ORCHESTOS_CLAUDE_STATUSLINE_HOME
const temp = (prefix: string) => {
  const path = mkdtempSync(join(tmpdir(), prefix))
  roots.push(path)
  return path
}

afterEach(() => {
  if (originalStatuslineHome === undefined) delete process.env.ORCHESTOS_CLAUDE_STATUSLINE_HOME
  else process.env.ORCHESTOS_CLAUDE_STATUSLINE_HOME = originalStatuslineHome
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('session status', () => {
  test('descubre Claude y Codex solo para el proyecto solicitado y ordena por mtime', () => {
    const agentHome = temp('orchestos-h75-home-')
    const project = realpathSync(temp('orchestos-h75-project-'))
    const claudeDir = join(agentHome, '.claude', 'projects', project.replace(/[\\/]/g, '-'))
    const codexDir = join(agentHome, '.codex', 'sessions', '2026', '09', '03')
    mkdirSync(claudeDir, { recursive: true })
    mkdirSync(codexDir, { recursive: true })
    const claude = join(claudeDir, 'claude.jsonl')
    const codex = join(codexDir, 'rollout-current.jsonl')
    const other = join(codexDir, 'rollout-other.jsonl')
    writeFileSync(claude, '{}\n')
    writeFileSync(codex, `${JSON.stringify({ type: 'session_meta', payload: { cwd: project } })}\n`)
    writeFileSync(
      other,
      `${JSON.stringify({ type: 'session_meta', payload: { cwd: '/other' } })}\n`,
    )
    utimesSync(claude, new Date(1_700_000_000_000), new Date(1_700_000_000_000))
    utimesSync(codex, new Date(1_700_000_001_000), new Date(1_700_000_001_000))

    expect(discoverSessionTranscripts(project, agentHome)).toEqual([codex, claude])
  })

  test('devuelve contexto y cupo mediante el mismo contrato sin revelar el path', async () => {
    const project = temp('orchestos-h75-project-')
    const transcript = join(project, 'session.jsonl')
    writeFileSync(
      transcript,
      `${JSON.stringify({ payload: { type: 'token_count', model: 'gpt-test', info: { last_token_usage: { total_tokens: 25 }, model_context_window: 100 }, rate_limits: { primary: { used_percent: 40, window_minutes: 300, resets_at: 1_788_460_888 } } } })}\n`,
    )

    const result = await readActiveSessionStatus({
      projectRoot: project,
      transcriptPath: transcript,
    })
    expect(result).toMatchObject({
      available: true,
      context: { source: 'codex', pct: 25, level: 'ok' },
      rateLimits: {
        source: 'codex',
        windows: [{ id: 'primary', usedPct: 40, windowMinutes: 300 }],
      },
    })
    expect(result).not.toHaveProperty('transcriptPath')
  })

  test('un transcript ausente falla abierto', async () => {
    const project = temp('orchestos-h75-project-')
    expect(
      await readActiveSessionStatus({
        projectRoot: project,
        transcriptPath: join(project, 'missing.jsonl'),
      }),
    ).toBeNull()
  })

  test('lee cada transcript como máximo una vez aunque no encuentre un CLI', async () => {
    const agentHome = temp('orchestos-at4-home-')
    const project = realpathSync(temp('orchestos-at4-project-'))
    const claudeDir = join(agentHome, '.claude', 'projects', project.replace(/[\\/]/g, '-'))
    mkdirSync(claudeDir, { recursive: true })
    const paths = ['one.jsonl', 'two.jsonl', 'three.jsonl'].map((name) => join(claudeDir, name))
    for (const path of paths) writeFileSync(path, '{}\n')

    let reads = 0
    await readActiveSessionStatuses({
      projectRoot: project,
      agentHome,
      adapters: [
        {
          id: 'never-matches',
          thresholds: { warn: 60, critical: 65 },
          async read() {
            reads += 1
            return null
          },
        },
      ],
    })

    expect(reads).toBe(paths.length)
  })

  test('combina statuslines de varias sesiones por ventana y descarta lecturas viejas', async () => {
    const home = temp('orchestos-statusline-merge-')
    const directory = join(home, 'claude-statusline')
    mkdirSync(directory)
    const reset = Math.floor(Date.now() / 1000) + 3600
    const write = (session: string, used: number, resetsAt = reset) =>
      writeFileSync(
        join(directory, `${session}.json`),
        JSON.stringify({
          rate_limits: { five_hour: { used_percentage: used, resets_at: resetsAt } },
        }),
      )
    write('old-session', 33)
    write('new-session', 39)
    write('reset-session', 10, reset + 3600)

    process.env.ORCHESTOS_CLAUDE_STATUSLINE_HOME = home
    const result = readClaudeStatuslineRateLimits(home)
    expect(result?.windows).toEqual([
      expect.objectContaining({ usedPct: 10, resetsAt: reset + 3600, remainingPct: 90 }),
    ])
  })

  test('conserva una ventana de Claude vencida para que el cliente la pinte libre', () => {
    const home = temp('orchestos-statusline-expired-')
    writeFileSync(
      join(home, 'claude-statusline.json'),
      JSON.stringify({ rate_limits: { five_hour: { used_percentage: 80, resets_at: 1 } } }),
    )
    process.env.ORCHESTOS_CLAUDE_STATUSLINE_HOME = home

    expect(readClaudeStatuslineRateLimits(home)?.windows).toEqual([
      expect.objectContaining({ usedPct: 80, remainingPct: 20, resetsAt: 1 }),
    ])
  })

  test('lee la cuota de Codex de la cuenta aunque el proyecto no tenga transcript', async () => {
    const project = temp('orchestos-codex-project-')
    const agentHome = temp('orchestos-codex-home-')
    const codex = (
      await readActiveSessionStatuses({
        projectRoot: project,
        agentHome,
        detectClis: () => [
          {
            id: 'claude',
            label: 'Claude Code',
            binary: 'claude',
            icon: 'claude',
            readBoundary: { kind: 'none', reason: 'test' },
            installed: false,
            path: null,
          },
          {
            id: 'codex',
            label: 'Codex',
            binary: 'codex',
            icon: 'codex',
            readBoundary: { kind: 'none', reason: 'test' },
            installed: true,
            path: '/fake/codex',
          },
          {
            id: 'opencode',
            label: 'OpenCode',
            binary: 'opencode',
            icon: 'opencode',
            readBoundary: { kind: 'none', reason: 'test' },
            installed: false,
            path: null,
          },
        ],
        readCodexRateLimits: async () => [
          {
            id: 'primary',
            usedPct: 14,
            remainingPct: 86,
            windowMinutes: 300,
            resetsAt: 4_102_444_800,
          },
        ],
      })
    ).find((status) => status.id === 'codex')
    expect(codex).toMatchObject({
      installed: true,
      available: true,
      context: null,
      rateLimits: {
        source: 'codex',
        windows: [{ id: 'primary', usedPct: 14, windowMinutes: 300 }],
      },
    })
  })

  test('con el mismo reset gana el mayor uso y borra sesiones de más de 7 días', async () => {
    const home = temp('orchestos-statusline-same-reset-')
    const directory = join(home, 'claude-statusline')
    mkdirSync(directory)
    const reset = Math.floor(Date.now() / 1000) + 3600
    const write = (session: string, used: number) =>
      writeFileSync(
        join(directory, `${session}.json`),
        JSON.stringify({ rate_limits: { five_hour: { used_percentage: used, resets_at: reset } } }),
      )
    write('old-session', 33)
    write('new-session', 39)
    write('stale-session', 90)
    const eightDaysAgo = (Date.now() - 8 * 24 * 60 * 60 * 1000) / 1000
    utimesSync(join(directory, 'stale-session.json'), eightDaysAgo, eightDaysAgo)

    process.env.ORCHESTOS_CLAUDE_STATUSLINE_HOME = home
    const result = readClaudeStatuslineRateLimits(home)
    expect(result?.windows).toEqual([expect.objectContaining({ usedPct: 39, remainingPct: 61 })])
    expect(existsSync(join(directory, 'stale-session.json'))).toBe(false)
  })

  test('mantiene el archivo legacy cuando no existen archivos por sesión', async () => {
    const home = temp('orchestos-statusline-legacy-')
    writeFileSync(
      join(home, 'claude-statusline.json'),
      JSON.stringify({ rate_limits: { five_hour: { used_percentage: 39 } } }),
    )
    process.env.ORCHESTOS_CLAUDE_STATUSLINE_HOME = home
    const result = readClaudeStatuslineRateLimits(home)
    expect(result?.windows[0]).toMatchObject({ usedPct: 39, remainingPct: 61 })
  })
})
