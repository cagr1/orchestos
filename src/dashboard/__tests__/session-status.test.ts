import { afterEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readActiveSessionStatuses, type SessionStatus } from '../../../scripts/session-status.ts'
import { withFreshClaudeQuota } from '../handlers/session-status.ts'
import { route } from '../server.ts'

const PORT = 4257
const originalTranscript = process.env.ORCHESTOS_SESSION_TRANSCRIPT
const originalOrchestosHome = process.env.ORCHESTOS_HOME
const roots: string[] = []

const quotaStatuses: SessionStatus[] = [
  {
    id: 'claude',
    label: 'Claude Code',
    binary: 'claude',
    icon: 'claude',
    readBoundary: { kind: 'none', reason: 'fixture' },
    installed: true,
    available: true,
    observedAt: null,
    context: null,
    rateLimits: { source: 'claude', windows: [] },
  },
  {
    id: 'codex',
    label: 'Codex',
    binary: 'codex',
    icon: 'codex',
    readBoundary: { kind: 'none', reason: 'fixture' },
    installed: true,
    available: true,
    observedAt: null,
    context: null,
    rateLimits: { source: 'codex', windows: [] },
  },
]

describe('withFreshClaudeQuota', () => {
  test('replaces Claude quota windows and leaves Codex untouched', () => {
    const windows = [
      { id: 'seven_day', usedPct: 18, remainingPct: 82, windowMinutes: 10080, resetsAt: null },
    ]
    const result = withFreshClaudeQuota(quotaStatuses, () => ({ windows, observedAt: 'fresh' }))

    expect(result).not.toBe(quotaStatuses)
    expect(result[0]?.rateLimits).toEqual({ source: 'claude', windows })
    expect(result[1]).toBe(quotaStatuses[1])
  })

  test('makes Claude available when the statusline has quota but no active transcript', () => {
    const claude = quotaStatuses.find((status) => status.id === 'claude')
    if (!claude) throw new Error('Claude fixture is missing')
    const unavailable = [{ ...claude, available: false, rateLimits: null }]
    const result = withFreshClaudeQuota(unavailable, () => ({
      windows: [
        { id: 'five_hour', usedPct: 20, remainingPct: 80, windowMinutes: 300, resetsAt: null },
      ],
      observedAt: 'fresh',
    }))

    expect(result[0]).toMatchObject({
      available: true,
      observedAt: 'fresh',
      context: null,
      rateLimits: { source: 'claude' },
    })
  })

  test('returns the same array when the read is null or throws', () => {
    expect(withFreshClaudeQuota(quotaStatuses, () => null)).toBe(quotaStatuses)
    expect(
      withFreshClaudeQuota(quotaStatuses, () => {
        throw new Error('unavailable')
      }),
    ).toBe(quotaStatuses)
  })
})

afterEach(() => {
  if (originalTranscript === undefined) delete process.env.ORCHESTOS_SESSION_TRANSCRIPT
  else process.env.ORCHESTOS_SESSION_TRANSCRIPT = originalTranscript
  if (originalOrchestosHome === undefined) delete process.env.ORCHESTOS_HOME
  else process.env.ORCHESTOS_HOME = originalOrchestosHome
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

describe('H.7.5 — GET /api/session/status', () => {
  test('expone contexto y cupo normalizados sin filtrar la ruta del transcript', async () => {
    const root = mkdtempSync(join(tmpdir(), 'orchestos-h75-api-'))
    roots.push(root)
    const transcript = join(root, 'codex.jsonl')
    writeFileSync(
      transcript,
      `${JSON.stringify({ payload: { type: 'token_count', model: 'gpt-test', info: { last_token_usage: { total_tokens: 60 }, model_context_window: 100 }, rate_limits: { primary: { used_percent: 44, window_minutes: 300, resets_at: 1_788_460_888 } } } })}\n`,
    )
    process.env.ORCHESTOS_SESSION_TRANSCRIPT = transcript

    const response = await route(new Request(`http://localhost:${PORT}/api/session/status`), PORT)
    expect(response.status).toBe(200)
    const body = (await response.json()) as Record<string, unknown>
    expect(body.available).toBe(true)
    const codex = (body.clis as Array<Record<string, unknown>>).find((cli) => cli.id === 'codex')
    expect(codex).toMatchObject({
      id: 'codex',
      readBoundary: { kind: 'none' },
      available: true,
      context: { source: 'codex', pct: 60, level: 'warn' },
      rateLimits: {
        source: 'codex',
        windows: [{ id: 'primary', usedPct: 44, windowMinutes: 300 }],
      },
    })
    expect(JSON.stringify(body)).not.toContain(transcript)
  })

  test('sin transcript devuelve un estado vacío explícito, no error ni 0%', async () => {
    const root = mkdtempSync(join(tmpdir(), 'orchestos-h75-api-'))
    roots.push(root)
    process.env.ORCHESTOS_SESSION_TRANSCRIPT = join(root, 'missing.jsonl')

    const response = await route(new Request(`http://localhost:${PORT}/api/session/status`), PORT)
    expect(response.status).toBe(200)
    const body = (await response.json()) as {
      available: boolean
      clis: Array<{ available: boolean; context: unknown; rateLimits: unknown }>
    }
    expect(body.available).toBe(false)
    expect(body.clis.length).toBeGreaterThan(0)
    expect(
      body.clis.every((cli) => !cli.available && cli.context === null && cli.rateLimits === null),
    ).toBe(true)
  })

  test('lee la cuota de Claude desde el payload de statusLine', async () => {
    const root = mkdtempSync(join(tmpdir(), 'orchestos-h75-statusline-'))
    roots.push(root)
    delete process.env.ORCHESTOS_SESSION_TRANSCRIPT
    process.env.ORCHESTOS_HOME = root
    writeFileSync(
      join(root, 'claude-statusline.json'),
      JSON.stringify({
        rate_limits: {
          seven_day: { used_percentage: 18, resets_at: 1_790_236_800 },
        },
      }),
    )

    const statuses = await readActiveSessionStatuses({ projectRoot: root, agentHome: root })
    const claude = statuses.find((status) => status.id === 'claude')
    expect(claude?.rateLimits).toMatchObject({
      source: 'claude',
      windows: [{ id: 'seven_day', usedPct: 18, windowMinutes: 10080 }],
    })
  })
})
