import { describe, it, expect } from 'bun:test'
import { mkdtempSync, mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

interface ChildResult {
  tables?: string[]
  runsColumns?: string[]
  filesColumns?: string[]
  schemaVersions?: Array<{ version: number; name: string }>
  runCount?: number
  ftsTriggers?: number
  schemaCount?: number
  evidence?: Array<{ version: number; name: string; applied_at: string }>
  probeCount?: number
  failedTableCount?: number
  failedVersionCount?: number
  runDefaults?: { input_tokens: number; output_tokens: number; usd_cost: number; elapsed_ms: number }
  statusNotNull?: number
  duplicatePathRejected?: boolean
  uniqueFilesIndex?: boolean
  legacyTaskIdDefault?: string | null
  error?: string
}

async function runMigrationProcess(home: string, body: string): Promise<ChildResult> {
  const proc = Bun.spawn(['bun', '-e', body], {
    cwd: process.cwd(),
    env: { ...process.env, ORCHESTOS_HOME: home },
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const [exitCode, stdout, stderr] = await Promise.all([
    proc.exited,
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ])
  expect(exitCode, stderr).toBe(0)
  return JSON.parse(stdout) as ChildResult
}

function tempHome(): string {
  return mkdtempSync(join(tmpdir(), 'orchestos-migration-test-'))
}

describe('SQLite migrations', () => {
  it('creates the complete schema from an empty database', async () => {
    const home = tempHome()
    try {
      const result = await runMigrationProcess(home, `
        const { runMigrations } = await import('./src/db/migrate.ts')
        const { db } = await import('./src/db/sqlite.ts')
        runMigrations()
        const tables = db.query("SELECT name FROM sqlite_master WHERE type IN ('table', 'virtual table') AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(row => row.name)
        const runsColumns = db.query('PRAGMA table_info(runs)').all().map(row => row.name)
        const filesColumns = db.query('PRAGMA table_info(files)').all().map(row => row.name)
        const schemaVersions = db.query('SELECT version, name FROM schema_migrations ORDER BY version').all()
        db.run('INSERT INTO runs (id, prompt, task_class, model, provider, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', ['fixture-run', 'fixture', 'test', 'model', 'provider', 'done', '2026-07-29T00:00:00.000Z'])
        const runDefaults = db.query('SELECT input_tokens, output_tokens, usd_cost, elapsed_ms FROM runs WHERE id = ?').get('fixture-run')
        const statusNotNull = db.query('PRAGMA table_info(runs)').all().find(row => row.name === 'status').notnull
        let duplicatePathRejected = false
        db.run('INSERT INTO projects (id, path, stack_profile, agents_md, last_updated) VALUES (?, ?, ?, ?, ?)', ['fixture-project-1', '/fixture', '{}', '', '2026-07-29T00:00:00.000Z'])
        try {
          db.run('INSERT INTO projects (id, path, stack_profile, agents_md, last_updated) VALUES (?, ?, ?, ?, ?)', ['fixture-project-2', '/fixture', '{}', '', '2026-07-29T00:00:00.000Z'])
        } catch { duplicatePathRejected = true }
        const uniqueFilesIndex = db.query('PRAGMA index_list(files)').all().some(row => row.unique === 1)
        process.stdout.write(JSON.stringify({ tables, runsColumns, filesColumns, schemaVersions, runDefaults, statusNotNull, duplicatePathRejected, uniqueFilesIndex }))
        db.close()
      `)

      expect(result.tables).toEqual(expect.arrayContaining([
        'projects', 'context_chunks', 'runs', 'files', 'code_edges',
        'memory_entries', 'memory_conflicts', 'memory_fts', 'chat_task_bar_events',
        'instincts', 'run_steps', 'schema_migrations',
      ]))
      expect(result.schemaVersions).toEqual([{ version: 1, name: 'baseline-current-schema' }])
      expect(result.runsColumns).toEqual(expect.arrayContaining([
        'task_id', 'qa_verdict', 'checks_json', 'context_warnings_json',
        'cost_breakdown_json', 'file_diffs', 'adversarial_verdict',
      ]))
      expect(result.filesColumns).toContain('embedding')
      expect(result.runDefaults).toEqual({ input_tokens: 0, output_tokens: 0, usd_cost: 0, elapsed_ms: 0 })
      expect(result.statusNotNull).toBe(1)
      expect(result.duplicatePathRejected).toBe(true)
      expect(result.uniqueFilesIndex).toBe(true)
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  it('adds missing columns to a legacy database without losing existing rows', async () => {
    const home = tempHome()
    try {
      mkdirSync(join(home, '.orchestos'), { recursive: true })
      const result = await runMigrationProcess(home, `
        import { Database } from 'bun:sqlite'
        const legacy = new Database(process.env.ORCHESTOS_HOME + '/.orchestos/db.sqlite')
        legacy.exec('CREATE TABLE runs (id TEXT PRIMARY KEY, prompt TEXT NOT NULL, task_class TEXT NOT NULL, model TEXT NOT NULL, provider TEXT NOT NULL, status TEXT NOT NULL, input_tokens INTEGER DEFAULT 0, output_tokens INTEGER DEFAULT 0, usd_cost REAL DEFAULT 0, elapsed_ms INTEGER DEFAULT 0, result TEXT, created_at TEXT NOT NULL)')
        legacy.run('INSERT INTO runs (id, prompt, task_class, model, provider, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', ['legacy-1', 'legacy prompt', 'implement', 'old-model', 'test', 'done', '2026-01-01T00:00:00.000Z'])
        legacy.close()
        const { runMigrations } = await import('./src/db/migrate.ts')
        const { db } = await import('./src/db/sqlite.ts')
        runMigrations()
        const row = db.query('SELECT prompt, status FROM runs WHERE id = ?').get('legacy-1')
        const runsColumns = db.query('PRAGMA table_info(runs)').all().map(row => row.name)
        const schemaVersions = db.query('SELECT version, name FROM schema_migrations ORDER BY version').all()
        const legacyTaskIdDefault = db.query('PRAGMA table_info(runs)').all().find(row => row.name === 'task_id').dflt_value
        process.stdout.write(JSON.stringify({ runCount: row ? 1 : 0, runsColumns, schemaVersions, legacyTaskIdDefault }))
        db.close()
      `)

      expect(result.runCount).toBe(1)
      expect(result.runsColumns).toContain('adversarial_reason')
      expect(result.runsColumns).toContain('context_source')
      expect(result.schemaVersions).toEqual([{ version: 1, name: 'baseline-current-schema' }])
      expect(result.legacyTaskIdDefault).toBeNull()
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  it('is idempotent when run repeatedly', async () => {
    const home = tempHome()
    try {
      const result = await runMigrationProcess(home, `
        const { runMigrations } = await import('./src/db/migrate.ts')
        const { db } = await import('./src/db/sqlite.ts')
        runMigrations()
        runMigrations()
        const runCount = db.query("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'runs'").get().count
        const ftsTriggers = db.query("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'memory_fts_%'").get().count
        const schemaCount = db.query('SELECT COUNT(*) AS count FROM schema_migrations').get().count
        process.stdout.write(JSON.stringify({ runCount, ftsTriggers, schemaCount }))
        db.close()
      `)

      expect(result.runCount).toBe(1)
      expect(result.ftsTriggers).toBe(3)
      expect(result.schemaCount).toBe(1)
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  it('applies numbered steps once and records their evidence', async () => {
    const home = tempHome()
    try {
      const result = await runMigrationProcess(home, `
        const { runMigrations, applyMigrationSteps } = await import('./src/db/migrate.ts')
        const { db } = await import('./src/db/sqlite.ts')
        runMigrations()
        const step = {
          version: 2,
          name: 'migration-test-probe',
          precondition(database) {
            if (database.query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'runs'").get() === null) {
              throw new Error('runs table must exist before v2')
            }
          },
          apply(database) {
            database.exec('CREATE TABLE IF NOT EXISTS migration_probe (id INTEGER PRIMARY KEY)')
          },
          postcondition(database) {
            if (database.query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'migration_probe'").get() === null) {
              throw new Error('migration_probe must exist after v2')
            }
          },
        }
        applyMigrationSteps([step])
        applyMigrationSteps([step])
        const evidence = db.query('SELECT version, name, applied_at FROM schema_migrations ORDER BY version').all()
        const probeCount = db.query("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'migration_probe'").get().count
        process.stdout.write(JSON.stringify({ evidence, probeCount }))
        db.close()
      `)

      expect(result.evidence).toHaveLength(2)
      expect(result.evidence?.[1]).toMatchObject({ version: 2, name: 'migration-test-probe' })
      expect(result.evidence?.[1]?.applied_at).toEqual(expect.any(String))
      expect(result.probeCount).toBe(1)
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  it('rolls back a failed step after reopening the database', async () => {
    const home = tempHome()
    try {
      const result = await runMigrationProcess(home, `
        import { Database } from 'bun:sqlite'
        const { runMigrations, applyMigrationSteps } = await import('./src/db/migrate.ts')
        const { db } = await import('./src/db/sqlite.ts')
        runMigrations()
        const failedStep = {
          version: 2,
          name: 'migration-test-failure',
          precondition() {},
          apply(database) {
            database.exec('CREATE TABLE migration_partial (id INTEGER PRIMARY KEY)')
            throw new Error('injected migration failure')
          },
          postcondition() {},
        }
        try {
          applyMigrationSteps([failedStep])
        } catch {}
        db.close()
        const reopened = new Database(process.env.ORCHESTOS_HOME + '/.orchestos/db.sqlite')
        const failedTableCount = reopened.query("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'migration_partial'").get().count
        const failedVersionCount = reopened.query('SELECT COUNT(*) AS count FROM schema_migrations WHERE version = 2').get().count
        process.stdout.write(JSON.stringify({ failedTableCount, failedVersionCount }))
        reopened.close()
      `)

      expect(result.failedTableCount).toBe(0)
      expect(result.failedVersionCount).toBe(0)
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })
})
