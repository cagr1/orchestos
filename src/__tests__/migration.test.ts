import { describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

interface ChildResult {
  tables?: string[]
  runsColumns?: string[]
  filesColumns?: string[]
  evalTrialColumns?: string[]
  schemaVersions?: Array<{ version: number; name: string }>
  runCount?: number
  ftsTriggers?: number
  schemaCount?: number
  evidence?: Array<{ version: number; name: string; applied_at: string }>
  probeCount?: number
  failedTableCount?: number
  failedVersionCount?: number
  runDefaults?: {
    input_tokens: number
    output_tokens: number
    usd_cost: number
    elapsed_ms: number
  }
  statusNotNull?: number
  duplicatePathRejected?: boolean
  uniqueFilesIndex?: boolean
  legacyTaskIdDefault?: string | null
  foreignKeys?: number
  requiredIndexes?: boolean
  invalidEvalFkRejected?: boolean
  memoryCountBefore?: number
  memoryCountAfter?: number
  ftsMatchCount?: number
  ftsRebuiltAfterCorruption?: boolean
  ftsRebuiltWithIncompatibility?: boolean
  preconditionTableCount?: number
  postconditionTableCount?: number
  recoveryCount?: number
  recoveryVersionCount?: number
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
      const result = await runMigrationProcess(
        home,
        `
        const { runMigrations, rebuildMemoryFts } = await import('./src/db/migrate.ts')
        const { db } = await import('./src/db/sqlite.ts')
        const memoryCountBefore = db.query("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'memory_entries'").get().count
        runMigrations()
        const tables = db.query("SELECT name FROM sqlite_master WHERE type IN ('table', 'virtual table') AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(row => row.name)
        const runsColumns = db.query('PRAGMA table_info(runs)').all().map(row => row.name)
        const filesColumns = db.query('PRAGMA table_info(files)').all().map(row => row.name)
        const evalTrialColumns = db.query('PRAGMA table_info(eval_trials)').all().map(row => row.name)
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
        const foreignKeys = db.query('PRAGMA foreign_keys').get().foreign_keys
        const requiredIndexes = ['idx_files_project', 'idx_edges_from', 'idx_edges_to', 'idx_memory_project_scope', 'idx_eval_trials_task_batch'].every(name => db.query("SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = ?").get(name) !== null)
        let invalidEvalFkRejected = false
        try {
          db.run('INSERT INTO eval_trials (run_id, eval_task_id, trial_index, batch_id, config_json, passed, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', ['missing-run', 'fixture-eval', 1, 'fixture-batch', '{}', 1, '2026-07-29T00:00:00.000Z'])
        } catch { invalidEvalFkRejected = true }
        db.run('INSERT INTO memory_entries (id, project_id, topic_key, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', ['fixture-memory', 'fixture-project-1', 'fixture-topic', 'recoverable fts content', '2026-07-29T00:00:00.000Z', '2026-07-29T00:00:00.000Z'])
        const memoryCountAfter = db.query('SELECT COUNT(*) AS count FROM memory_entries').get().count
        const ftsMatchCount = db.query("SELECT COUNT(*) AS count FROM memory_fts WHERE memory_fts MATCH 'recoverable'").get().count
        db.exec('DELETE FROM memory_fts')
        const ftsRebuiltAfterCorruption = rebuildMemoryFts()
        db.exec('DROP TABLE memory_fts')
        const ftsRebuiltWithIncompatibility = rebuildMemoryFts()
        process.stdout.write(JSON.stringify({ tables, runsColumns, filesColumns, evalTrialColumns, schemaVersions, runDefaults, statusNotNull, duplicatePathRejected, uniqueFilesIndex, foreignKeys, requiredIndexes, invalidEvalFkRejected, memoryCountBefore, memoryCountAfter, ftsMatchCount, ftsRebuiltAfterCorruption, ftsRebuiltWithIncompatibility }))
        db.close()
      `,
      )

      expect(result.tables).toEqual(
        expect.arrayContaining([
          'projects',
          'context_chunks',
          'runs',
          'files',
          'code_edges',
          'memory_entries',
          'memory_conflicts',
          'memory_fts',
          'chat_task_bar_events',
          'chat_sessions',
          'chat_messages',
          'instincts',
          'run_steps',
          'eval_trials',
          'schema_migrations',
        ]),
      )
      expect(result.schemaVersions).toEqual([
        { version: 1, name: 'baseline-current-schema' },
        { version: 2, name: 'chat-sessions' },
        { version: 3, name: 'eval-trials' },
      ])
      expect(result.runsColumns).toEqual(
        expect.arrayContaining([
          'task_id',
          'qa_verdict',
          'checks_json',
          'context_warnings_json',
          'cost_breakdown_json',
          'file_diffs',
          'adversarial_verdict',
        ]),
      )
      expect(result.filesColumns).toContain('embedding')
      expect(result.evalTrialColumns).toEqual(
        expect.arrayContaining([
          'run_id',
          'eval_task_id',
          'trial_index',
          'batch_id',
          'config_json',
          'passed',
          'created_at',
        ]),
      )
      expect(result.runDefaults).toEqual({
        input_tokens: 0,
        output_tokens: 0,
        usd_cost: 0,
        elapsed_ms: 0,
      })
      expect(result.statusNotNull).toBe(1)
      expect(result.duplicatePathRejected).toBe(true)
      expect(result.uniqueFilesIndex).toBe(true)
      expect(result.foreignKeys).toBe(1)
      expect(result.requiredIndexes).toBe(true)
      expect(result.invalidEvalFkRejected).toBe(true)
      expect(result.memoryCountBefore).toBe(0)
      expect(result.memoryCountAfter).toBe(1)
      expect(result.ftsMatchCount).toBe(1)
      expect(result.ftsRebuiltAfterCorruption).toBe(true)
      expect(result.ftsRebuiltWithIncompatibility).toBe(false)
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  it('adds missing columns to a legacy database without losing existing rows', async () => {
    const home = tempHome()
    try {
      mkdirSync(join(home, '.orchestos'), { recursive: true })
      const result = await runMigrationProcess(
        home,
        `
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
      `,
      )

      expect(result.runCount).toBe(1)
      expect(result.runsColumns).toContain('adversarial_reason')
      expect(result.runsColumns).toContain('context_source')
      expect(result.schemaVersions).toEqual([
        { version: 1, name: 'baseline-current-schema' },
        { version: 2, name: 'chat-sessions' },
        { version: 3, name: 'eval-trials' },
      ])
      expect(result.legacyTaskIdDefault).toBeNull()
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  it('is idempotent when run repeatedly', async () => {
    const home = tempHome()
    try {
      const result = await runMigrationProcess(
        home,
        `
        const { runMigrations } = await import('./src/db/migrate.ts')
        const { db } = await import('./src/db/sqlite.ts')
        runMigrations()
        runMigrations()
        const runCount = db.query("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'runs'").get().count
        const ftsTriggers = db.query("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'trigger' AND name LIKE 'memory_fts_%'").get().count
        const schemaCount = db.query('SELECT COUNT(*) AS count FROM schema_migrations').get().count
        process.stdout.write(JSON.stringify({ runCount, ftsTriggers, schemaCount }))
        db.close()
      `,
      )

      expect(result.runCount).toBe(1)
      expect(result.ftsTriggers).toBe(3)
      expect(result.schemaCount).toBe(3)
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  it('applies numbered steps once and records their evidence', async () => {
    const home = tempHome()
    try {
      const result = await runMigrationProcess(
        home,
        `
        const { runMigrations, applyMigrationSteps, FUTURE_MIGRATIONS } = await import('./src/db/migrate.ts')
        const { db } = await import('./src/db/sqlite.ts')
        runMigrations()
        const step = {
          version: 4,
          name: 'migration-test-probe',
          precondition(database) {
            if (database.query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'runs'").get() === null) {
              throw new Error('runs table must exist before v4')
            }
          },
          apply(database) {
            database.exec('CREATE TABLE IF NOT EXISTS migration_probe (id INTEGER PRIMARY KEY)')
          },
          postcondition(database) {
            if (database.query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'migration_probe'").get() === null) {
              throw new Error('migration_probe must exist after v4')
            }
          },
        }
        applyMigrationSteps([...FUTURE_MIGRATIONS, step])
        applyMigrationSteps([...FUTURE_MIGRATIONS, step])
        const evidence = db.query('SELECT version, name, applied_at FROM schema_migrations ORDER BY version').all()
        const probeCount = db.query("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'migration_probe'").get().count
        process.stdout.write(JSON.stringify({ evidence, probeCount }))
        db.close()
      `,
      )

      expect(result.evidence).toHaveLength(4)
      expect(result.evidence?.[3]).toMatchObject({ version: 4, name: 'migration-test-probe' })
      expect(result.evidence?.[3]?.applied_at).toEqual(expect.any(String))
      expect(result.probeCount).toBe(1)
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  it('rolls back a failed step after reopening the database', async () => {
    const home = tempHome()
    try {
      const result = await runMigrationProcess(
        home,
        `
        import { Database } from 'bun:sqlite'
        const { runMigrations, applyMigrationSteps, FUTURE_MIGRATIONS } = await import('./src/db/migrate.ts')
        const { db } = await import('./src/db/sqlite.ts')
        runMigrations()
        const failedStep = {
          version: 4,
          name: 'migration-test-failure',
          precondition() {},
          apply(database) {
            database.exec('CREATE TABLE migration_partial (id INTEGER PRIMARY KEY)')
            throw new Error('injected migration failure')
          },
          postcondition() {},
        }
        try {
          applyMigrationSteps([...FUTURE_MIGRATIONS, failedStep])
        } catch {}
        db.close()
        const reopened = new Database(process.env.ORCHESTOS_HOME + '/.orchestos/db.sqlite')
        const failedTableCount = reopened.query("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'migration_partial'").get().count
        const failedVersionCount = reopened.query('SELECT COUNT(*) AS count FROM schema_migrations WHERE version = 4').get().count
        process.stdout.write(JSON.stringify({ failedTableCount, failedVersionCount }))
        reopened.close()
      `,
      )

      expect(result.failedTableCount).toBe(0)
      expect(result.failedVersionCount).toBe(0)
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  it('rolls back precondition and postcondition failures before recovery', async () => {
    const home = tempHome()
    try {
      const result = await runMigrationProcess(
        home,
        `
        const { runMigrations, applyMigrationSteps, FUTURE_MIGRATIONS } = await import('./src/db/migrate.ts')
        const { db } = await import('./src/db/sqlite.ts')
        runMigrations()
        const preconditionFailure = {
          version: 4,
          name: 'migration-test-precondition-failure',
          precondition() { throw new Error('injected precondition failure') },
          apply(database) { database.exec('CREATE TABLE migration_precondition_partial (id INTEGER PRIMARY KEY)') },
          postcondition() {},
        }
        try { applyMigrationSteps([...FUTURE_MIGRATIONS, preconditionFailure]) } catch {}
        const preconditionTableCount = db.query("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'migration_precondition_partial'").get().count

        const postconditionFailure = {
          version: 4,
          name: 'migration-test-postcondition-failure',
          precondition() {},
          apply(database) { database.exec('CREATE TABLE migration_postcondition_partial (id INTEGER PRIMARY KEY)') },
          postcondition() { throw new Error('injected postcondition failure') },
        }
        try { applyMigrationSteps([...FUTURE_MIGRATIONS, postconditionFailure]) } catch {}
        const postconditionTableCount = db.query("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'migration_postcondition_partial'").get().count

        const recoveryStep = {
          version: 4,
          name: 'migration-test-recovery',
          precondition() {},
          apply(database) { database.exec('CREATE TABLE migration_recovery (id INTEGER PRIMARY KEY)') },
          postcondition(database) {
            if (database.query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'migration_recovery'").get() === null) throw new Error('recovery table missing')
          },
        }
        applyMigrationSteps([...FUTURE_MIGRATIONS, recoveryStep])
        const recoveryCount = db.query("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'migration_recovery'").get().count
        const recoveryVersionCount = db.query('SELECT COUNT(*) AS count FROM schema_migrations WHERE version = 4').get().count
        process.stdout.write(JSON.stringify({ preconditionTableCount, postconditionTableCount, recoveryCount, recoveryVersionCount }))
        db.close()
      `,
      )

      expect(result.preconditionTableCount).toBe(0)
      expect(result.postconditionTableCount).toBe(0)
      expect(result.recoveryCount).toBe(1)
      expect(result.recoveryVersionCount).toBe(1)
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })
})
