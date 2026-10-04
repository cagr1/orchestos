/**
 * H.1 — GET /api/usage. Handler delegado a Codex (backend, mecánico,
 * cuidando cupo de Claude), tests escritos aparte tras revisar el diff.
 * Corre contra la DB real del proceso de test (misma que usa el resto de la
 * suite vía src/db/sqlite.ts) — no se sembraron filas nuevas, solo se
 * verifica el shape/tipo de la respuesta y la aritmética de los totales
 * contra las filas que la propia respuesta reporta (no un número fijo,
 * porque la DB de test comparte estado con otros archivos de la suite).
 */
import { afterAll, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { handleApiUsage } from '../dashboard/handlers/usage.ts'
import { deleteProject, getProject, upsertProject } from '../db/projects.ts'
import { insertRun } from '../db/runs.ts'
import { db } from '../db/sqlite.ts'

const agentHome = mkdtempSync(join(tmpdir(), 'orchestos-usage-endpoint-'))
const registeredRoot = mkdtempSync(join(tmpdir(), 'orchestos-registered-'))
const insertedRunIds: string[] = []
upsertProject(
  registeredRoot,
  {
    manifest: { name: 'fixture', runtime: 'unknown', framework: 'none', deps: [] },
    languages: [],
    conventions: { editorconfig: null, prettier: null, eslint: null, tsconfig: null },
    commands: [],
  },
  '',
)
afterAll(() => rmSync(agentHome, { recursive: true, force: true }))
afterAll(() => {
  for (const id of insertedRunIds) db.run('DELETE FROM runs WHERE id = ?', [id])
  const project = getProject(registeredRoot)
  if (project) deleteProject(project.id)
  rmSync(registeredRoot, { recursive: true, force: true })
})

describe('GET /api/usage', () => {
  it('devuelve el shape esperado, nunca lanza', async () => {
    const res = await handleApiUsage(agentHome)
    expect(res.status).toBe(200)
    const data = (await res.json()) as {
      byDayModel: unknown[]
      totalUsd: number
      totalRuns: number
    }
    expect(Array.isArray(data.byDayModel)).toBe(true)
    expect(typeof data.totalUsd).toBe('number')
    expect(typeof data.totalRuns).toBe('number')
  })

  it('cada fila de byDayModel tiene los 6 campos con los tipos correctos, nunca null', async () => {
    const res = await handleApiUsage(agentHome)
    const data = (await res.json()) as { byDayModel: Array<Record<string, unknown>> }
    for (const row of data.byDayModel) {
      expect(typeof row.date).toBe('string')
      expect(typeof row.model).toBe('string')
      expect(typeof row.usd).toBe('number')
      expect(typeof row.runs).toBe('number')
      expect(typeof row.inputTokens).toBe('number')
      expect(typeof row.outputTokens).toBe('number')
      expect(row.usd).not.toBeNull()
    }
  })

  it('totalUsd y totalRuns son la suma exacta de las filas de byDayModel', async () => {
    const res = await handleApiUsage(agentHome)
    const data = (await res.json()) as {
      byDayModel: Array<{ usd: number; runs: number }>
      totalUsd: number
      totalRuns: number
    }
    const sumUsd = data.byDayModel.reduce((t, r) => t + r.usd, 0)
    const sumRuns = data.byDayModel.reduce((t, r) => t + r.runs, 0)
    expect(data.totalUsd).toBeCloseTo(sumUsd, 9)
    expect(data.totalRuns).toBe(sumRuns)
  })

  it('runs de cada fila es siempre > 0 (GROUP BY nunca produce grupos vacíos)', async () => {
    const res = await handleApiUsage(agentHome)
    const data = (await res.json()) as { byDayModel: Array<{ runs: number }> }
    for (const row of data.byDayModel) {
      expect(row.runs).toBeGreaterThan(0)
    }
  })

  it('no vuelve a contar una sesión de run y deja sin precio modelos desconocidos', async () => {
    const project = getProject(registeredRoot)
    if (!project) throw new Error('Fixture project was not registered')
    const id = insertRun({
      project_id: project.id,
      prompt: 'fixture',
      task_class: 'chat',
      model: 'unknown-cli-model',
      provider: 'claude',
      skill_id: null,
      task_id: null,
      allowed_outputs: null,
      files_attempted: null,
      files_authorized: null,
      files_blocked: null,
      snapshot_before: null,
      snapshot_after: null,
      qa_verdict: null,
      qa_reason: null,
      status: 'done',
      input_tokens: 1,
      output_tokens: 1,
      usd_cost: 0.01,
      elapsed_ms: 1,
      result: null,
      cli_session_id: 'session-covered',
    })
    insertedRunIds.push(id)
    const key = realpathSync(registeredRoot).replace(/[^a-zA-Z0-9]/g, '-')
    const transcriptDir = join(agentHome, '.claude', 'projects', key)
    mkdirSync(transcriptDir, { recursive: true })
    const entry = (sessionId: string) =>
      JSON.stringify({
        type: 'assistant',
        sessionId,
        timestamp: '2026-10-04T10:00:00Z',
        message: {
          id: sessionId,
          model: 'unlisted-model-cx5',
          usage: { input_tokens: 3, output_tokens: 2 },
        },
      })
    writeFileSync(join(transcriptDir, 'covered.jsonl'), `${entry('session-covered')}\n`)
    writeFileSync(join(transcriptDir, 'unpriced.jsonl'), `${entry('session-unpriced')}\n`)

    const response = await handleApiUsage(agentHome)
    const data = await response.json()
    const cli = data.byDayModel.filter((row: { source: string }) => row.source === 'cli')
    expect(cli).toHaveLength(1)
    expect(cli[0]).toMatchObject({ model: 'unlisted-model-cx5', usd: null, priced: false })
    expect(data.totals.cli.unpricedSessions).toBe(1)
  })
})
