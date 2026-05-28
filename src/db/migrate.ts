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

    CREATE TABLE IF NOT EXISTS files (
      id INTEGER PRIMARY KEY,
      project_id INTEGER NOT NULL,
      path TEXT NOT NULL,
      language TEXT NOT NULL,
      sha1 TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      indexed_at TEXT NOT NULL,
      UNIQUE(project_id, path)
    );
    CREATE INDEX IF NOT EXISTS idx_files_project ON files(project_id);

    CREATE TABLE IF NOT EXISTS code_edges (
      id INTEGER PRIMARY KEY,
      project_id INTEGER NOT NULL,
      from_file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
      to_path TEXT NOT NULL,
      to_file_id INTEGER,
      kind TEXT NOT NULL,
      raw TEXT NOT NULL,
      UNIQUE(from_file_id, raw)
    );
    CREATE INDEX IF NOT EXISTS idx_edges_from ON code_edges(from_file_id);
    CREATE INDEX IF NOT EXISTS idx_edges_to ON code_edges(to_file_id);

    CREATE TABLE IF NOT EXISTS memory_entries (
      id          TEXT PRIMARY KEY,
      project_id  TEXT NOT NULL,
      topic_key   TEXT NOT NULL,
      scope       TEXT NOT NULL DEFAULT 'session',
      content     TEXT NOT NULL,
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL,
      UNIQUE(project_id, topic_key)
    );
    CREATE INDEX IF NOT EXISTS idx_memory_project_scope ON memory_entries(project_id, scope);
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
  safeAddColumn('runs', 'checks_json',        'TEXT')
  safeAddColumn('runs', 'constitution_rules', 'INTEGER')  // S17: number of rules loaded, null if no CONSTITUTION.md
  safeAddColumn('runs', 'context_source',     'TEXT')     // S18: 'CONTEXT.md' | 'AGENTS.md'
  safeAddColumn('runs', 'context_tokens',     'INTEGER')  // S18: estimated token count of context used
  safeAddColumn('files', 'embedding',         'TEXT')     // S24.1: JSON array of float[] for semantic search
  safeAddColumn('runs', 'embed_hits',         'INTEGER')  // S24.5: count of embedding-suggested files used in this run
}
