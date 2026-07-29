import { describe, it, expect } from 'bun:test'
import { mkdtempSync, mkdirSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

interface ChildResult {
  tables?: string[]
  runsColumns?: string[]
  filesColumns?: string[]
  runCount?: number
  ftsTriggers?: number
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
        process.stdout.write(JSON.stringify({ tables, runsColumns, filesColumns }))
        db.close()
      `)

      expect(result.tables).toEqual(expect.arrayContaining([
        'projects', 'context_chunks', 'runs', 'files', 'code_edges',
        'memory_entries', 'memory_conflicts', 'memory_fts', 'chat_task_bar_events',
        'instincts', 'run_steps',
      ]))
      expect(result.runsColumns).toEqual(expect.arrayContaining([
        'task_id', 'qa_verdict', 'checks_json', 'context_warnings_json',
        'cost_breakdown_json', 'file_diffs', 'adversarial_verdict',
      ]))
      expect(result.filesColumns).toContain('embedding')
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
        process.stdout.write(JSON.stringify({ runCount: row ? 1 : 0, runsColumns }))
        db.close()
      `)

      expect(result.runCount).toBe(1)
      expect(result.runsColumns).toContain('adversarial_reason')
      expect(result.runsColumns).toContain('context_source')
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
        process.stdout.write(JSON.stringify({ runCount, ftsTriggers }))
        db.close()
      `)

      expect(result.runCount).toBe(1)
      expect(result.ftsTriggers).toBe(3)
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })
})
