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
  readClaudeStatuslineWiring,
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
  test('diagnostica tee presente, ausente, inexistente y Orca solo sin cambiar settings', () => {
    const home = temp('orchestos-wiring-')
    mkdirSync(join(home, '.claude'))
    const settings = join(home, '.claude/settings.json')
    const tee = join(home, 'path with spaces', 'claude-statusline-tee.sh')
    mkdirSync(join(home, 'path with spaces'))
    writeFileSync(tee, '#!/bin/sh\n')
    writeFileSync(join(home, 'claude-statusline-tee.sh'), '#!/bin/sh\n')
    for (const [command, wired] of [
      [`ORCHESTOS_STATUSLINE_NEXT="/orca/statusline.sh" /bin/sh "${tee}"`, true],
      ['sh "$HOME/path with spaces/claude-statusline-tee.sh"', true],
      [`sh "\${HOME}/path with spaces/claude-statusline-tee.sh"`, true],
      ['sh ~/claude-statusline-tee.sh', true],
      ['sh $HOME/claude-statusline-tee.sh', true],
      [`sh \${HOME}/claude-statusline-tee.sh`, true],
      ['sh "~/claude-statusline-tee.sh"', false],
      ["sh '~/claude-statusline-tee.sh'", false],
      [`sh '\${HOME}/claude-statusline-tee.sh'`, false],
      [`echo "${tee}"`, false],
      ["sh '$HOME/path with spaces/claude-statusline-tee.sh'", false],
      [undefined, false],
      ['/missing/claude-statusline-tee.sh', false],
      ['/orca/claude-statusline.sh', false],
    ] as const) {
      writeFileSync(settings, JSON.stringify({ statusLine: { command } }))
      expect(readClaudeStatuslineWiring(settings)).toBe(wired)
    }
    writeFileSync(settings, '{broken')
    expect(readClaudeStatuslineWiring(settings)).toBe(false)
    expect(readClaudeStatuslineWiring(join(home, 'absent.json'))).toBe(false)
  })

  test('la fecha de cuota viene del statusline aunque el transcript sea reciente', async () => {
    const home = temp('orchestos-statusline-date-')
    const project = realpathSync(temp('orchestos-statusline-project-'))
    const transcript = join(project, 'claude.jsonl')
    writeFileSync(transcript, '{}\n')
    const reading = join(home, 'claude-statusline.json')
    writeFileSync(
      reading,
      JSON.stringify({ rate_limits: { five_hour: { used_percentage: 80, resets_at: 1 } } }),
    )
    const old = new Date('2026-09-28T12:00:00Z')
    utimesSync(reading, old, old)
    process.env.ORCHESTOS_CLAUDE_STATUSLINE_HOME = home
    const statuses = await readActiveSessionStatuses({
      projectRoot: project,
      agentHome: home,
      transcriptPath: transcript,
      adapters: [
        {
          id: 'claude',
          thresholds: { warn: 40, critical: 65 },
          async read() {
            return { used: 1, window: 100, model: null }
          },
        },
      ],
    })
    const claude = statuses.find((cli) => cli.id === 'claude')
    expect(claude?.observedAt).toBe(old.toISOString())
    expect(claude?.rateLimits?.windows[0]?.observedAt).toBe(old.toISOString())
    expect(claude?.statuslineWired).toBe(false)
  })
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
          thresholds: { warn: 40, critical: 65 },
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

  test('conserva una ventana vencida con la fecha real de lectura para el cliente', () => {
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

  test.each([false, true])(
    'a igual reset y uso gana la observación más reciente (orden %s)',
    (reverse) => {
      const home = temp('orchestos-statusline-tie-')
      const directory = join(home, 'claude-statusline')
      mkdirSync(directory)
      const now = Math.floor(Date.now() / 1000)
      const old = new Date((now - 3600) * 1000)
      const fresh = new Date(now * 1000)
      const dates = reverse ? [fresh, old] : [old, fresh]
      dates.forEach((date, index) => {
        const path = join(directory, `${index}.json`)
        writeFileSync(
          path,
          JSON.stringify({
            rate_limits: { five_hour: { used_percentage: 80, resets_at: now - 1800 } },
          }),
        )
        utimesSync(path, date, date)
      })
      process.env.ORCHESTOS_CLAUDE_STATUSLINE_HOME = home
      expect(readClaudeStatuslineRateLimits(home)?.windows[0]?.observedAt).toBe(fresh.toISOString())
    },
  )

  test('la fecha de otra sesión reciente no rejuvenece una ventana antigua', () => {
    const home = temp('orchestos-statusline-window-date-')
    const directory = join(home, 'claude-statusline')
    mkdirSync(directory)
    const oldPath = join(directory, 'old.json')
    const old = new Date(Date.now() - 3_600_000)
    writeFileSync(
      oldPath,
      JSON.stringify({
        rate_limits: {
          five_hour: { used_percentage: 80, resets_at: Math.floor(Date.now() / 1000) - 1800 },
        },
      }),
    )
    utimesSync(oldPath, old, old)
    writeFileSync(
      join(directory, 'fresh.json'),
      JSON.stringify({
        rate_limits: {
          seven_day: { used_percentage: 10, resets_at: Math.floor(Date.now() / 1000) + 3600 },
        },
      }),
    )
    process.env.ORCHESTOS_CLAUDE_STATUSLINE_HOME = home
    const result = readClaudeStatuslineRateLimits(home)
    expect(result?.windows.find((window) => window.id === 'five_hour')?.observedAt).toBe(
      old.toISOString(),
    )
    expect(result?.observedAt).not.toBe(old.toISOString())
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
