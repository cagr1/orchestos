import { afterEach, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readCliTranscriptUsage } from './cli-transcripts.ts'

const temporary: string[] = []
afterEach(() => {
  for (const path of temporary.splice(0)) rmSync(path, { recursive: true, force: true })
})

function fixture() {
  const base = mkdtempSync(join(tmpdir(), 'orchestos-usage-'))
  temporary.push(base)
  const root = join(base, 'registered-project')
  const other = join(base, 'other-project')
  const agentHome = join(base, 'agentHome')
  mkdirSync(root)
  mkdirSync(other)
  return { base, root, other, agentHome }
}

describe('readCliTranscriptUsage', () => {
  it('deduplica ids de Claude y cuenta worktrees registrados, excluyendo otros proyectos', async () => {
    const { root, other, agentHome } = fixture()
    const key = realpathSync(root).replace(/[^a-zA-Z0-9]/g, '-')
    const claudeProjects = join(agentHome, '.claude', 'projects')
    const main = join(claudeProjects, key, 'session.jsonl')
    const worktree = join(claudeProjects, `${key}--orchestos-worktrees-x`, 'session.jsonl')
    const foreign = join(claudeProjects, other.replace(/[^a-zA-Z0-9]/g, '-'), 'foreign.jsonl')
    for (const path of [main, worktree, foreign]) mkdirSync(join(path, '..'), { recursive: true })
    const message = (id: string, sessionId: string) =>
      JSON.stringify({
        type: 'assistant',
        sessionId,
        timestamp: '2026-10-04T10:00:00Z',
        message: {
          id,
          model: 'claude-sonnet-5',
          usage: {
            input_tokens: 10,
            cache_read_input_tokens: 20,
            cache_creation_input_tokens: 13,
            cache_creation: {
              ephemeral_1h_input_tokens: 10,
              ephemeral_5m_input_tokens: 3,
            },
            output_tokens: 4,
          },
        },
      })
    writeFileSync(
      main,
      `${message('same', 'claude-session')}\n${message('same', 'claude-session')}\n`,
    )
    writeFileSync(worktree, `${message('worktree', 'worktree-session')}\n`)
    writeFileSync(foreign, `${message('foreign', 'foreign-session')}\n`)

    const rows = await readCliTranscriptUsage([root], agentHome)
    expect(rows).toHaveLength(2)
    expect(rows.map((row) => row.sessionId).sort()).toEqual(['claude-session', 'worktree-session'])
    expect(rows[0]).toMatchObject({
      inputTokens: 10,
      cacheReadTokens: 20,
      cacheWriteTokens: 13,
      cacheWrite1hTokens: 10,
      outputTokens: 4,
    })
  })

  it('filtra Codex por cwd registrado, resta caché y toma el último conteo', async () => {
    const { root, other, agentHome } = fixture()
    // The recorded worktree was removed; its resolved path still belongs to this project.
    const worktreeCwd = join(root, '.orchestos', 'worktrees', 'removed-x')
    const sessions = join(agentHome, '.codex', 'sessions', '2026', '10', '04')
    mkdirSync(sessions, { recursive: true })
    const rollout = (id: string, cwd: string) =>
      [
        { type: 'session_meta', payload: { id, cwd, originator: 'codex' } },
        { type: 'turn_context', payload: { model: 'gpt-6-luna' } },
        {
          type: 'event_msg',
          timestamp: '2026-10-04T10:00:00Z',
          payload: {
            type: 'token_count',
            info: {
              total_token_usage: {
                input_tokens: 100,
                cached_input_tokens: 20,
                cache_write_input_tokens: 5,
                output_tokens: 10,
              },
            },
          },
        },
        {
          type: 'event_msg',
          timestamp: '2026-10-04T11:00:00Z',
          payload: {
            type: 'token_count',
            info: {
              total_token_usage: {
                input_tokens: 160,
                cached_input_tokens: 40,
                cache_write_input_tokens: 8,
                output_tokens: 25,
              },
            },
          },
        },
      ]
        .map((event) => JSON.stringify(event))
        .join('\n')
    writeFileSync(join(sessions, 'rollout-a.jsonl'), rollout('codex-good', worktreeCwd))
    writeFileSync(join(sessions, 'rollout-b.jsonl'), rollout('codex-foreign', other))
    writeFileSync(join(sessions, 'rollout-copy.jsonl'), rollout('codex-good', worktreeCwd))

    // Explicit isolated agentHome represents an alternate CODEX_HOME in tests.
    const rows = await readCliTranscriptUsage([root], agentHome)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      sessionId: 'codex-good',
      model: 'gpt-6-luna',
      inputTokens: 120,
      cacheReadTokens: 40,
      cacheWriteTokens: 8,
      outputTokens: 25,
    })
  })
})
