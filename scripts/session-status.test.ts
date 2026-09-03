import { afterEach, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, realpathSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { discoverSessionTranscripts, readActiveSessionStatus } from './session-status.ts'

const roots: string[] = []
const temp = (prefix: string) => {
  const path = mkdtempSync(join(tmpdir(), prefix))
  roots.push(path)
  return path
}

afterEach(() => {
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
})
