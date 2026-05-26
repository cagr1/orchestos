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
      status          TEXT NOT NULL,  -- 'done' | 'blocked' | 'failed'
      input_tokens    INTEGER DEFAULT 0,
      output_tokens   INTEGER DEFAULT 0,
      usd_cost        REAL DEFAULT 0,
      elapsed_ms      INTEGER DEFAULT 0,
      result          TEXT,
      created_at      TEXT NOT NULL
    );
  `)
}
