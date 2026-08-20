import { afterEach, describe, expect, it } from 'bun:test'
import { Database } from 'bun:sqlite'
import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  databasePathForHome,
  exportRunEvidence,
  normalizeEvidenceLabel,
  runEvidenceGate,
} from './run-evidence-gate.ts'

const cleanupPaths: string[] = []

afterEach(() => {
  for (const path of cleanupPaths.splice(0)) rmSync(path, { recursive: true, force: true })
})

function temp(prefix: string): string {
  const path = mkdtempSync(join(tmpdir(), prefix))
  cleanupPaths.push(path)
  return path
}

function createRunsDb(path: string): Database {
  const database = new Database(path, { create: true })
  database.exec(`
    CREATE TABLE runs (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      prompt TEXT NOT NULL,
      task_class TEXT NOT NULL,
      model TEXT NOT NULL,
      provider TEXT NOT NULL,
      qa_verdict TEXT,
      status TEXT NOT NULL,
      input_tokens INTEGER DEFAULT 0,
      output_tokens INTEGER DEFAULT 0,
      usd_cost REAL DEFAULT 0,
      elapsed_ms INTEGER DEFAULT 0,
      result TEXT,
      created_at TEXT NOT NULL
    )
  `)
  return database
}

function insertFixture(database: Database, id: string, taskClass: string): void {
  database.run(
    `INSERT INTO runs (id, project_id, prompt, task_class, model, provider, qa_verdict, status,
       input_tokens, output_tokens, usd_cost, elapsed_ms, result, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, 'temporary-project', `prompt-${id}`, taskClass, 'test/model', 'test', 'pass', 'done', 10, 5, 0.25, 100, `result-${id}`, '2026-08-20T00:00:00.000Z'],
  )
}

function evidenceTempNames(label: string): Set<string> {
  return new Set(readdirSync(tmpdir()).filter(name => name.startsWith(`orchestos-evidence-${label}-`)))
}

describe('CC.0-D6 — exportRunEvidence', () => {
  it('copia solo runs del harness, elimina project_id temporal y marca procedencia', () => {
    const root = temp('orchestos-evidence-copy-')
    const sourcePath = join(root, 'source.sqlite')
    const targetPath = join(root, 'target.sqlite')
    const source = createRunsDb(sourcePath)
    const target = createRunsDb(targetPath)
    insertFixture(source, 'task-1', 'implement')
    insertFixture(source, 'chat-1', 'chat')
    insertFixture(source, 'old-gate-1', 'gate:old:fix')
    source.close()
    target.close()

    const result = exportRunEvidence(sourcePath, targetPath, 'BB.4')
    const verify = new Database(targetPath, { readonly: true })
    const rows = verify.query<Record<string, unknown>, []>('SELECT * FROM runs ORDER BY id').all()
    verify.close()

    expect(result).toEqual({ discovered: 1, exported: 1, duplicates: 0 })
    expect(rows).toEqual([expect.objectContaining({
      id: 'task-1',
      project_id: null,
      task_class: 'gate:bb.4:implement',
      prompt: 'prompt-task-1',
      qa_verdict: 'pass',
      usd_cost: 0.25,
    })])
  })

  it('es idempotente por run id y no duplica evidencia al reintentar', () => {
    const root = temp('orchestos-evidence-dedupe-')
    const sourcePath = join(root, 'source.sqlite')
    const targetPath = join(root, 'target.sqlite')
    const source = createRunsDb(sourcePath)
    const target = createRunsDb(targetPath)
    insertFixture(source, 'same-run', 'fix')
    source.close()
    target.close()

    expect(exportRunEvidence(sourcePath, targetPath, 'live').exported).toBe(1)
    expect(exportRunEvidence(sourcePath, targetPath, 'live')).toEqual({ discovered: 1, exported: 0, duplicates: 1 })
  })

  it('rechaza labels ambiguos y nunca permite source=target', () => {
    const root = temp('orchestos-evidence-guard-')
    const dbPath = join(root, 'runs.sqlite')
    createRunsDb(dbPath).close()
    expect(() => normalizeEvidenceLabel('../escape')).toThrow()
    expect(() => exportRunEvidence(dbPath, dbPath, 'gate')).toThrow('must be different')
  })
})

describe('CC.0-D6 — gate:evidence lifecycle', () => {
  it('exporta evidencia aunque el gate falle y borra el home temporal solo después', () => {
    const evidenceHome = temp('orchestos-evidence-home-')
    const before = evidenceTempNames('failed-gate')
    const script = `
      const { runMigrations } = await import('./src/db/migrate.ts')
      const { insertRun } = await import('./src/db/runs.ts')
      const { db } = await import('./src/db/sqlite.ts')
      runMigrations()
      insertRun({ project_id: null, prompt: 'live gate', task_class: 'implement', model: 'test/model', provider: 'test', skill_id: null, task_id: null, allowed_outputs: null, files_attempted: null, files_authorized: null, files_blocked: null, snapshot_before: null, snapshot_after: null, qa_verdict: 'pass', qa_reason: null, status: 'failed', input_tokens: 4, output_tokens: 2, usd_cost: 0.1, elapsed_ms: 9, result: 'gate failed after run' })
      db.close()
      process.exit(7)
    `
    const exitCode = runEvidenceGate({
      label: 'failed-gate',
      command: ['bun', '-e', script],
      evidenceHome,
      cwd: process.cwd(),
    })
    const after = evidenceTempNames('failed-gate')
    const durable = new Database(databasePathForHome(evidenceHome), { readonly: true })
    const row = durable.query<{ task_class: string; result: string }, []>('SELECT task_class, result FROM runs').get()
    durable.close()

    expect(exitCode).toBe(7)
    expect(row).toEqual({ task_class: 'gate:failed-gate:implement', result: 'gate failed after run' })
    expect(after).toEqual(before)
  })

  it('preserva el temporal si no puede exportar la única evidencia', () => {
    const invalidHome = join(temp('orchestos-evidence-invalid-parent-'), 'not-a-directory')
    writeFileSync(invalidHome, 'file')
    const before = evidenceTempNames('preserve')
    const script = `
      const { runMigrations } = await import('./src/db/migrate.ts')
      const { db } = await import('./src/db/sqlite.ts')
      runMigrations(); db.close()
    `
    const exitCode = runEvidenceGate({ label: 'preserve', command: ['bun', '-e', script], evidenceHome: invalidHome })
    const created = [...evidenceTempNames('preserve')].filter(name => !before.has(name))

    expect(exitCode).toBe(1)
    expect(created).toHaveLength(1)
    const preserved = join(tmpdir(), created[0]!)
    expect(existsSync(databasePathForHome(preserved))).toBe(true)
    cleanupPaths.push(preserved)
  })
})
