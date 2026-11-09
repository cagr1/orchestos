/**
 * G.3.3 — db/run-steps.ts: persistencia de pasos en vivo de los executors CLI.
 * `db` no honra ORCHESTOS_HOME (siempre ~/.orchestos/db.sqlite, ver
 * sqlite.ts) — mismo patrón que harness-engine-persistence.test.ts: task_id
 * propio del test + cleanup explícito en afterAll.
 */
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { clearRunSteps, getRunSteps, insertRunStep } from '../db/run-steps.ts'
import { db } from '../db/sqlite.ts'

const TASK_ID = 'g33-run-steps-test'

beforeAll(async () => {
  const { runMigrations } = await import('../db/migrate.ts')
  runMigrations()
})

afterAll(() => {
  db.run('DELETE FROM run_steps WHERE task_id = ?', [TASK_ID])
})

describe('run-steps', () => {
  it('insertRunStep asigna seq incremental por task_id', () => {
    clearRunSteps(TASK_ID)
    insertRunStep(TASK_ID, { type: 'tool_use', label: 'Bash', detail: 'ls' })
    insertRunStep(TASK_ID, { type: 'text', label: 'text', detail: 'hola' })
    const steps = getRunSteps(TASK_ID)
    expect(steps).toHaveLength(2)
    expect(steps[0]!.seq).toBe(1)
    expect(steps[1]!.seq).toBe(2)
    expect(steps[0]!.label).toBe('Bash')
  })

  it('ignora reasoning porque run_steps no lo admite', () => {
    clearRunSteps(TASK_ID)
    insertRunStep(TASK_ID, { type: 'reasoning', label: 'reasoning', detail: 'plan' })
    expect(getRunSteps(TASK_ID)).toHaveLength(0)
  })

  it('getRunSteps(taskId, sinceSeq) devuelve solo lo nuevo', () => {
    clearRunSteps(TASK_ID)
    insertRunStep(TASK_ID, { type: 'tool_use', label: 'a' })
    insertRunStep(TASK_ID, { type: 'tool_use', label: 'b' })
    const all = getRunSteps(TASK_ID)
    const sinceFirst = getRunSteps(TASK_ID, all[0]!.seq)
    expect(sinceFirst).toHaveLength(1)
    expect(sinceFirst[0]!.label).toBe('b')
  })

  it('persiste notice con mensaje, kind y detalle sin perder redacción', () => {
    clearRunSteps(TASK_ID)
    const secret = ['sk', 'proj', '0123456789abcdefghijklmnopqrstuvwxyz'].join('-')
    insertRunStep(TASK_ID, {
      type: 'notice',
      label: 'notice',
      notice: { kind: 'auth', message: 'Sign in again', detail: `Authorization: Bearer ${secret}` },
    })
    const [step] = getRunSteps(TASK_ID)
    expect(step!.type).toBe('notice')
    expect(step!.label).toBe('Sign in again')
    expect(JSON.parse(step!.detail!)).toMatchObject({ kind: 'auth', message: 'Sign in again' })
    expect(step!.detail).not.toContain(secret)
  })

  it('persiste notices sin detalle y sin payload estructurado', () => {
    clearRunSteps(TASK_ID)
    insertRunStep(TASK_ID, {
      type: 'notice',
      label: 'Quota reached',
      notice: { kind: 'quota', message: 'Quota reached' },
    })
    insertRunStep(TASK_ID, { type: 'notice', label: 'Retrying', detail: 'Attempt 2' })
    const steps = getRunSteps(TASK_ID)
    expect(JSON.parse(steps[0]!.detail!)).toEqual({ kind: 'quota', message: 'Quota reached' })
    expect(steps[1]).toMatchObject({ type: 'notice', label: 'Retrying', detail: 'Attempt 2' })
  })

  it('costUsd/tokens se persisten y se leen de vuelta', () => {
    clearRunSteps(TASK_ID)
    insertRunStep(TASK_ID, {
      type: 'step_finish',
      label: 'step_finish',
      costUsd: 0.0041,
      tokens: { input: 100, output: 20 },
    })
    const [step] = getRunSteps(TASK_ID)
    expect(step!.cost_usd).toBe(0.0041)
    expect(JSON.parse(step!.tokens_json!)).toEqual({ input: 100, output: 20 })
  })

  it('clearRunSteps borra todo lo previo de ese task_id', () => {
    insertRunStep(TASK_ID, { type: 'text', label: 'text' })
    clearRunSteps(TASK_ID)
    expect(getRunSteps(TASK_ID)).toHaveLength(0)
  })

  it('task_id distinto no se mezcla (seq es por task, no global)', () => {
    clearRunSteps(TASK_ID)
    clearRunSteps(`${TASK_ID}-other`)
    insertRunStep(TASK_ID, { type: 'text', label: 'x' })
    insertRunStep(`${TASK_ID}-other`, { type: 'text', label: 'y' })
    expect(getRunSteps(TASK_ID)).toHaveLength(1)
    expect(getRunSteps(`${TASK_ID}-other`)).toHaveLength(1)
    db.run('DELETE FROM run_steps WHERE task_id = ?', [`${TASK_ID}-other`])
  })
})
