import { db } from './sqlite.ts'

export function runMigrations(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id          TEXT PRIMARY KEY,
      path        TEXT UNIQUE NOT NULL,
      stack_profile JSON NOT NULL,
      agents_md   TEXT NOT NULL,
      last_updated TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS context_chunks (
      id          TEXT PRIMARY KEY,
      project_id  TEXT NOT NULL,
      key         TEXT NOT NULL,
      value       TEXT NOT NULL,
      updated_at  TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );

    CREATE TABLE IF NOT EXISTS runs (
      id              TEXT PRIMARY KEY,
      project_id      TEXT,
      prompt          TEXT NOT NULL,
      task_class      TEXT NOT NULL,
      model           TEXT NOT NULL,
      provider        TEXT NOT NULL,
      skill_id        TEXT,
      allowed_outputs TEXT,           -- JSON array of declared output paths
      files_attempted TEXT,           -- JSON array
      files_authorized TEXT,          -- JSON array
      files_blocked   TEXT,           -- JSON array — non-empty = contract violation
      checks_json     TEXT,           -- JSON array of deterministic check results
      status          TEXT NOT NULL,  -- 'done' | 'blocked' | 'failed'
      input_tokens    INTEGER DEFAULT 0,
      output_tokens   INTEGER DEFAULT 0,
      usd_cost        REAL DEFAULT 0,
      elapsed_ms      INTEGER DEFAULT 0,
      result          TEXT,
      created_at      TEXT NOT NULL
    );
  `)

  // ALTER TABLE guards — add missing columns to existing DBs without dropping data
  const safeAddColumn = (table: string, column: string, def: string) => {
    const cols = db.query<{ name: string }, string>(
      `PRAGMA table_info(${table})`
    ).all(table).map(r => r.name)
    if (!cols.includes(column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`)
    }
  }
  safeAddColumn('runs', 'skill_id',         'TEXT')
  safeAddColumn('runs', 'allowed_outputs',  'TEXT')
  safeAddColumn('runs', 'files_attempted',  'TEXT')
  safeAddColumn('runs', 'files_authorized', 'TEXT')
  safeAddColumn('runs', 'files_blocked',    'TEXT')
  safeAddColumn('runs', 'status',           "TEXT NOT NULL DEFAULT 'done'")
  safeAddColumn('runs', 'task_id',          'TEXT')
  safeAddColumn('runs', 'snapshot_before',  'TEXT')   // JSON {path: sha1}
  safeAddColumn('runs', 'snapshot_after',   'TEXT')   // JSON {path: sha1}
  safeAddColumn('runs', 'qa_verdict',       'TEXT')   // 'pass' | 'fail'
  safeAddColumn('runs', 'qa_reason',        'TEXT')
  safeAddColumn('runs', 'checks_json',      'TEXT')
}
