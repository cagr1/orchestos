import type { Database } from 'bun:sqlite'
import { db } from './sqlite.ts'

export const CURRENT_SCHEMA_VERSION = 1
const BASELINE_NAME = 'baseline-current-schema'

export interface SchemaMigrationStep {
  version: number
  name: string
  precondition: (database: Database) => void
  apply: (database: Database) => void
  postcondition: (database: Database) => void
}

// Future schema changes belong here as numbered, independently verifiable steps.
// The current schema remains the v1 baseline; no historical transformation is
// fabricated for installations that predate this ledger.
export const FUTURE_MIGRATIONS: readonly SchemaMigrationStep[] = [
  {
    version: 2,
    name: 'chat-sessions',
    precondition: (database) => {
      const projects =
        database
          .query<{ count: number }, []>(
            "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'projects'",
          )
          .get()?.count ?? 0
      if (projects !== 1) throw new Error('Migration 2 requires projects table')
    },
    apply: (database) => {
      database.exec(`
        CREATE TABLE chat_sessions (
          id         TEXT PRIMARY KEY,
          project_id TEXT REFERENCES projects(id) ON DELETE SET NULL,
          agent      TEXT NOT NULL CHECK(agent IN ('local', 'claude', 'opencode', 'codex', 'api')),
          mode       TEXT NOT NULL CHECK(mode IN ('chat', 'code')),
          title      TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
        CREATE INDEX idx_chat_sessions_project_updated
          ON chat_sessions(project_id, updated_at DESC);

        CREATE TABLE chat_messages (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
          role       TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
          content    TEXT NOT NULL,
          model      TEXT,
          task_id    TEXT,
          ocr_used   TEXT,
          created_at TEXT NOT NULL
        );
        CREATE INDEX idx_chat_messages_session_id
          ON chat_messages(session_id, id);
      `)
    },
    postcondition: (database) => {
      const tables = database
        .query<{ name: string }, []>(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('chat_sessions', 'chat_messages') ORDER BY name",
        )
        .all()
        .map((row) => row.name)
      if (tables.join(',') !== 'chat_messages,chat_sessions') {
        throw new Error('Migration 2 did not create chat session tables')
      }
    },
  },
  {
    version: 3,
    name: 'eval-trials',
    precondition: (database) => {
      const runs =
        database
          .query<{ count: number }, []>(
            "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'runs'",
          )
          .get()?.count ?? 0
      if (runs !== 1) throw new Error('Migration 3 requires runs table')
    },
    apply: (database) => {
      database.exec(`
        CREATE TABLE IF NOT EXISTS eval_trials (
          id           INTEGER PRIMARY KEY AUTOINCREMENT,
          run_id       TEXT NOT NULL REFERENCES runs(id),
          eval_task_id TEXT NOT NULL,
          trial_index  INTEGER NOT NULL,
          batch_id     TEXT NOT NULL,
          config_json  TEXT NOT NULL,
          passed       INTEGER NOT NULL CHECK(passed IN (0, 1)),
          created_at   TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_eval_trials_task_batch
          ON eval_trials(eval_task_id, batch_id);
      `)
    },
    postcondition: (database) => {
      const table = database
        .query<{ count: number }, []>(
          "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'eval_trials'",
        )
        .get()?.count
      const index = database
        .query<{ count: number }, []>(
          "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'index' AND name = 'idx_eval_trials_task_batch'",
        )
        .get()?.count
      if (table !== 1 || index !== 1) {
        throw new Error('Migration 3 did not create eval_trials and its index')
      }
    },
  },
  {
    // R.4-bis (2026-09-07) — un mensaje assistant que creó una tarea "held"
    // (existingFiles, sin correr) solo guardaba su task_id plano; al recargar,
    // el cliente no podía distinguirla de una tarea normal ya en ejecución y
    // perdía el control inline [Ver]/[Cancelar]. Estas dos columnas persisten
    // lo que la respuesta en vivo ya conocía (chat.ts: autoTask.held/existingFiles).
    version: 4,
    name: 'chat-messages-held-task',
    precondition: (database) => {
      const messages =
        database
          .query<{ count: number }, []>(
            "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'chat_messages'",
          )
          .get()?.count ?? 0
      if (messages !== 1) throw new Error('Migration 4 requires chat_messages table')
    },
    apply: (database) => {
      database.exec(`
        ALTER TABLE chat_messages ADD COLUMN task_held INTEGER;
        ALTER TABLE chat_messages ADD COLUMN existing_files TEXT;
      `)
    },
    postcondition: (database) => {
      const columns = database
        .query<{ name: string }, []>('PRAGMA table_info(chat_messages)')
        .all()
        .map((row) => row.name)
      if (!columns.includes('task_held') || !columns.includes('existing_files')) {
        throw new Error('Migration 4 did not add task_held/existing_files to chat_messages')
      }
    },
  },
  {
    // R.5 — a chat response, its evidence run and its persisted exchange are
    // one outcome. This ledger lets the handler claim that outcome before it
    // calls a provider, so a retried HTTP request cannot silently bill twice.
    version: 5,
    name: 'chat-turns',
    precondition: (database) => {
      const tables =
        database
          .query<{ count: number }, []>(
            "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name IN ('chat_sessions', 'runs')",
          )
          .get()?.count ?? 0
      if (tables !== 2) throw new Error('Migration 5 requires chat_sessions and runs tables')
    },
    apply: (database) => {
      database.exec(`
        CREATE TABLE chat_turns (
          id                     TEXT PRIMARY KEY,
          session_id             TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
          project_id             TEXT,
          request_key            TEXT NOT NULL,
          input_fingerprint      TEXT NOT NULL,
          status                 TEXT NOT NULL CHECK(status IN ('pending','completed','failed','interrupted')),
          owner                  TEXT,
          owner_expires_at       TEXT,
          run_id                 TEXT REFERENCES runs(id),
          response_envelope_json TEXT,
          error                  TEXT,
          created_at             TEXT NOT NULL,
          updated_at             TEXT NOT NULL
        );
        CREATE UNIQUE INDEX idx_chat_turns_session_request_key ON chat_turns(session_id, request_key);
        CREATE INDEX idx_chat_turns_session_status ON chat_turns(session_id, status);
      `)
    },
    postcondition: (database) => {
      const objects = database
        .query<{ name: string }, []>(
          "SELECT name FROM sqlite_master WHERE name IN ('chat_turns', 'idx_chat_turns_session_request_key', 'idx_chat_turns_session_status') ORDER BY name",
        )
        .all()
        .map((row) => row.name)
      if (
        objects.join(',') !==
        'chat_turns,idx_chat_turns_session_request_key,idx_chat_turns_session_status'
      ) {
        throw new Error('Migration 5 did not create chat_turns and its indexes')
      }
    },
  },
  {
    // R.5 (decisión 8, hallazgo #7) — un turno reclamado dos veces (el mismo
    // request_key con el lease vencido, reclamado de nuevo tras un reinicio o
    // una caída) volvía a ejecutar el bloque completo de creación de tarea:
    // SQLite+YAML+git+spawn no son una transacción, así que un segundo claim
    // creaba una SEGUNDA tarea para el mismo mensaje. Esta columna es la
    // reserva: se graba el task_id apenas createTaskRecord() tiene éxito,
    // ANTES de spawnTaskRun() — así incluso si el proceso muere entre crear
    // y correr, el próximo claim del mismo turno ve la reserva y no repite.
    version: 6,
    name: 'chat-turns-task-reservation',
    precondition: (database) => {
      const tables =
        database
          .query<{ count: number }, []>(
            "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'chat_turns'",
          )
          .get()?.count ?? 0
      if (tables !== 1) throw new Error('Migration 6 requires chat_turns table')
    },
    apply: (database) => {
      database.exec('ALTER TABLE chat_turns ADD COLUMN task_id TEXT;')
    },
    postcondition: (database) => {
      const columns = database
        .query<{ name: string }, []>('PRAGMA table_info(chat_turns)')
        .all()
        .map((row) => row.name)
      if (!columns.includes('task_id')) {
        throw new Error('Migration 6 did not add task_id to chat_turns')
      }
    },
  },
  {
    version: 7,
    name: 'plan-items',
    precondition: (database) => {
      const schemaMigrations =
        database
          .query<{ count: number }, []>(
            "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'",
          )
          .get()?.count ?? 0
      if (schemaMigrations !== 1) throw new Error('Migration 7 requires schema_migrations table')
    },
    apply: (database) => {
      database.exec(`
        CREATE TABLE plan_items (
          id          TEXT PRIMARY KEY,
          sprint      TEXT NOT NULL,
          block       TEXT,
          delegation  TEXT NOT NULL CHECK(delegation IN ('🧠','⚡','🔍')),
          title       TEXT NOT NULL,
          body        TEXT NOT NULL DEFAULT '',
          status      TEXT NOT NULL CHECK(status IN ('open','done')),
          commit_sha  TEXT,
          closed_at   TEXT,
          position    INTEGER NOT NULL,
          CHECK (status = 'open' OR commit_sha IS NOT NULL)
        );
        CREATE INDEX idx_plan_items_status ON plan_items(status, sprint);

        CREATE TABLE plan_item_deps (
          item_id    TEXT NOT NULL REFERENCES plan_items(id) ON DELETE CASCADE,
          depends_on TEXT NOT NULL REFERENCES plan_items(id) ON DELETE RESTRICT,
          PRIMARY KEY (item_id, depends_on),
          CHECK (item_id <> depends_on)
        );
      `)
    },
    postcondition: (database) => {
      const objects = database
        .query<{ name: string }, []>(
          "SELECT name FROM sqlite_master WHERE name IN ('plan_items', 'plan_item_deps', 'idx_plan_items_status') ORDER BY name",
        )
        .all()
        .map((row) => row.name)
      if (objects.join(',') !== 'idx_plan_items_status,plan_item_deps,plan_items') {
        throw new Error('Migration 7 did not create plan item tables and index')
      }
    },
  },
  {
    version: 8,
    name: 'plan-doc-segments',
    precondition: (database) => {
      const planItems =
        database
          .query<{ count: number }, []>(
            "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'plan_items'",
          )
          .get()?.count ?? 0
      if (planItems !== 1) throw new Error('Migration 8 requires plan_items table')
    },
    apply: (database) => {
      database.exec(`
        CREATE TABLE plan_doc_segments (
          doc       TEXT NOT NULL,
          position  INTEGER NOT NULL,
          kind      TEXT NOT NULL CHECK(kind IN ('prose', 'item')),
          text      TEXT,
          item_id   TEXT,
          PRIMARY KEY (doc, position),
          CHECK (
            (kind = 'prose' AND text IS NOT NULL AND item_id IS NULL)
            OR
            (kind = 'item' AND text IS NOT NULL AND item_id IS NOT NULL)
          )
        );
        CREATE INDEX idx_plan_doc_segments_doc_position
          ON plan_doc_segments(doc, position);
      `)
    },
    postcondition: (database) => {
      const table =
        database
          .query<{ count: number }, []>(
            "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'plan_doc_segments'",
          )
          .get()?.count ?? 0
      if (table !== 1) throw new Error('Migration 8 did not create plan_doc_segments')
    },
  },
]

function appliedVersions(database: Database): Set<number> {
  return new Set(
    database
      .query<{ version: number }, []>('SELECT version FROM schema_migrations ORDER BY version')
      .all()
      .map((row) => row.version),
  )
}

export function applyMigrationSteps(
  steps: readonly SchemaMigrationStep[] = FUTURE_MIGRATIONS,
  database: Database = db,
): void {
  const applied = appliedVersions(database)
  let expectedVersion = CURRENT_SCHEMA_VERSION + 1

  for (const step of steps) {
    if (!Number.isInteger(step.version) || step.version !== expectedVersion) {
      throw new Error(`Migration sequence must start at ${expectedVersion}`)
    }
    if (!step.name.trim()) throw new Error(`Migration ${step.version} requires a name`)
    expectedVersion += 1

    if (applied.has(step.version)) continue

    // The schema change and its evidence must commit together. Bun rolls the
    // transaction back if any contract check or the evidence insert throws.
    const applyStep = database.transaction(() => {
      step.precondition(database)
      step.apply(database)
      step.postcondition(database)
      database.run('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)', [
        step.version,
        step.name,
        new Date().toISOString(),
      ])
    })
    applyStep()
    applied.add(step.version)
  }
}

export function rebuildMemoryFts(database: Database = db): boolean {
  try {
    database.exec(`INSERT INTO memory_fts(memory_fts) VALUES('rebuild')`)
    return true
  } catch {
    return false
  }
}

export function runMigrations(): void {
  // L.5.7.1 — metadata de linaje. La baseline se registra al final, después
  // de que todas las tablas/columnas actuales hayan sido comprobadas.
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    INTEGER PRIMARY KEY,
      name       TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `)

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
    const cols = db
      .query<{ name: string }, string>(`PRAGMA table_info(${table})`)
      .all(table)
      .map((r) => r.name)
    if (!cols.includes(column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`)
    }
  }
  safeAddColumn('runs', 'skill_id', 'TEXT')
  safeAddColumn('runs', 'allowed_outputs', 'TEXT')
  safeAddColumn('runs', 'files_attempted', 'TEXT')
  safeAddColumn('runs', 'files_authorized', 'TEXT')
  safeAddColumn('runs', 'files_blocked', 'TEXT')
  safeAddColumn('runs', 'files_read', 'TEXT')
  safeAddColumn('runs', 'read_audit_json', 'TEXT')
  safeAddColumn('runs', 'status', "TEXT NOT NULL DEFAULT 'done'")
  safeAddColumn('runs', 'task_id', 'TEXT')
  safeAddColumn('runs', 'snapshot_before', 'TEXT') // JSON {path: sha1}
  safeAddColumn('runs', 'snapshot_after', 'TEXT') // JSON {path: sha1}
  safeAddColumn('runs', 'qa_verdict', 'TEXT') // 'pass' | 'fail'
  safeAddColumn('runs', 'qa_reason', 'TEXT')
  safeAddColumn('runs', 'checks_json', 'TEXT')
  safeAddColumn('runs', 'constitution_rules', 'INTEGER') // S17: number of rules loaded, null if no CONSTITUTION.md
  safeAddColumn('runs', 'context_source', 'TEXT') // S18: 'CONTEXT.md' | 'AGENTS.md'
  safeAddColumn('runs', 'context_tokens', 'INTEGER') // S18: estimated token count of context used
  safeAddColumn('files', 'embedding', 'TEXT') // S24.1: JSON array of float[] for semantic search
  safeAddColumn('runs', 'embed_hits', 'INTEGER') // S24.5: count of embedding-suggested files used in this run
  safeAddColumn('runs', 'context_warnings_json', 'TEXT') // S27.4: JSON array of ContextWarning[] fired during this run
  safeAddColumn('runs', 'cost_breakdown_json', 'TEXT') // S35.3: JSON array of CostBreakdownEntry[]
  safeAddColumn('runs', 'qa_model', 'TEXT') // F2.5: judge model resolved by resolveQAJudge(), distinct from executor `model` column
  safeAddColumn('runs', 'file_diffs', 'TEXT') // v0.12/C: JSON array of FileDiffEntry[] (docs/diff-review-design.md) — NULL para runs previos a este cambio, sin backfill
  safeAddColumn('runs', 'adversarial_verdict', 'TEXT') // K.4b: 'VERIFIED' | 'CAVEATS' | 'REFUTED' | NULL (opt-in, NULL si adversarialQA no está activado)
  safeAddColumn('runs', 'adversarial_reason', 'TEXT') // K.4b: razón del segundo juez adversarial
  safeAddColumn('runs', 'refuter_verdict', 'TEXT') // X.2 (IDEAS #33): 'CONFIRMED' | 'REFUTED' | NULL (opt-in, NULL si refuterQA no está activado)
  safeAddColumn('runs', 'refuter_reason', 'TEXT') // X.2 (IDEAS #33): razón del refuter
  safeAddColumn('runs', 'skill_gates_json', 'TEXT') // O.3: JSON [{id, candidate, applied, reason}] de resolveGates() — NULL si el run nunca llegó al stage de QA (distinto de "ninguna gate aplicaba", que es un array con applied:false)

  // S26.3 — memory conflict detection records
  db.exec(`
    CREATE TABLE IF NOT EXISTS memory_conflicts (
      id          TEXT PRIMARY KEY,
      entry_a_id  TEXT NOT NULL REFERENCES memory_entries(id),
      entry_b_id  TEXT NOT NULL REFERENCES memory_entries(id),
      relation    TEXT NOT NULL,
      confidence  TEXT NOT NULL,
      resolved_at TEXT,
      created_at  TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_memory_conflicts_unresolved
      ON memory_conflicts(resolved_at);
    CREATE INDEX IF NOT EXISTS idx_memory_conflicts_entry_a
      ON memory_conflicts(entry_a_id);
    CREATE INDEX IF NOT EXISTS idx_memory_conflicts_entry_b
      ON memory_conflicts(entry_b_id);
  `)

  // S26.1 — FTS5 virtual table + sync triggers for BM25 conflict detection
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts USING fts5(
      content,
      topic_key,
      content='memory_entries',
      content_rowid='rowid'
    );

    CREATE TRIGGER IF NOT EXISTS memory_fts_ai
    AFTER INSERT ON memory_entries BEGIN
      INSERT INTO memory_fts(rowid, content, topic_key)
      VALUES (new.rowid, new.content, new.topic_key);
    END;

    CREATE TRIGGER IF NOT EXISTS memory_fts_au
    AFTER UPDATE ON memory_entries BEGIN
      INSERT INTO memory_fts(memory_fts, rowid, content, topic_key)
      VALUES ('delete', old.rowid, old.content, old.topic_key);
      INSERT INTO memory_fts(rowid, content, topic_key)
      VALUES (new.rowid, new.content, new.topic_key);
    END;

    CREATE TRIGGER IF NOT EXISTS memory_fts_ad
    AFTER DELETE ON memory_entries BEGIN
      INSERT INTO memory_fts(memory_fts, rowid, content, topic_key)
      VALUES ('delete', old.rowid, old.content, old.topic_key);
    END;
  `)

  // B.1 (Mes 18) — instrumentación de chat-create-task-bar: registra, por mensaje
  // enviado, si la barra de 3+ mensajes se mostró y si el usuario terminó
  // usándola. Gate de evidencia antes de escribir el clasificador semántico
  // (ver docs/chat-task-detection-design.md) — sin esto no hay forma de saber
  // si la heurística de conteo genera falsos negativos reales o es solo una
  // sospecha.
  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_task_bar_events (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      kind        TEXT NOT NULL CHECK(kind IN ('message', 'click')),
      message     TEXT,
      history_len INTEGER,
      bar_shown   INTEGER,
      created_at  TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_chat_task_bar_events_kind ON chat_task_bar_events(kind);
  `)

  // S33.1 — instincts table
  db.exec(`
    CREATE TABLE IF NOT EXISTS instincts (
      id          TEXT PRIMARY KEY,
      trigger     TEXT NOT NULL,
      action      TEXT NOT NULL,
      confidence  REAL NOT NULL CHECK(confidence >= 0 AND confidence <= 1),
      source      TEXT NOT NULL CHECK(source IN ('manual', 'auto')),
      verified    INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_instincts_verified ON instincts(verified);
    CREATE INDEX IF NOT EXISTS idx_instincts_confidence ON instincts(confidence);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_instincts_trigger_unique ON instincts(trigger);
  `)

  // G.3.3 — pasos en vivo de los executors CLI (external/opencode). Keyeado
  // por task_id, NO run_id: insertRun() solo crea la fila de `runs` al final
  // del run (ver harness.ts), pero el chat conoce el task_id desde que lo
  // auto-crea — es lo único disponible mientras el CLI todavía está corriendo.
  db.exec(`
    CREATE TABLE IF NOT EXISTS run_steps (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id     TEXT NOT NULL,
      seq         INTEGER NOT NULL,
      type        TEXT NOT NULL CHECK(type IN ('tool_use', 'text', 'step_finish')),
      label       TEXT NOT NULL,
      detail      TEXT,
      cost_usd    REAL,
      tokens_json TEXT,
      created_at  TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_run_steps_task_id ON run_steps(task_id, seq);
  `)

  // Rebuild FTS5 index on every startup — keeps index consistent if rows were
  // inserted before triggers existed (first migration) or after corruption.
  // Idempotent and fast for the small memory tables this tool uses.
  rebuildMemoryFts()

  // Existing installations have no historical migration ledger. Record one
  // honest baseline only after the current schema has completed successfully;
  // future numbered migrations will extend this ledger instead of pretending
  // that CREATE IF NOT EXISTS is a historical migration system.
  const applied =
    db.query<{ count: number }, []>('SELECT COUNT(*) AS count FROM schema_migrations').get()
      ?.count ?? 0
  if (applied === 0) {
    db.run('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)', [
      CURRENT_SCHEMA_VERSION,
      BASELINE_NAME,
      new Date().toISOString(),
    ])
  }

  applyMigrationSteps()
}
