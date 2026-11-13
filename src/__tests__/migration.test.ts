import { describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

interface ChildResult {
  tables?: string[]
  runsColumns?: string[]
  filesColumns?: string[]
  evalTrialColumns?: string[]
  chatTurnColumns?: string[]
  chatMessageColumns?: string[]
  chatSessionColumns?: string[]
  planItemColumns?: string[]
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
    cache_read_tokens: number
    cache_write_tokens: number
  }
  statusNotNull?: number
  duplicatePathRejected?: boolean
  uniqueFilesIndex?: boolean
  legacyTaskIdDefault?: string | null
  foreignKeys?: number
  requiredIndexes?: boolean
  invalidEvalFkRejected?: boolean
  donePlanItemWithoutCommitRejected?: boolean
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
  it('migration 38 adds nullable failure_kind to a version 37 database', async () => {
    const home = tempHome()
    try {
      const result = await runMigrationProcess(
        home,
        `
        const { runMigrations, applyMigrationSteps, FUTURE_MIGRATIONS } = await import('./src/db/migrate.ts')
        const { db } = await import('./src/db/sqlite.ts')
        runMigrations()
        db.exec('ALTER TABLE runs DROP COLUMN failure_kind')
        db.run('DELETE FROM schema_migrations WHERE version = 38')
        db.run("INSERT INTO runs (id, prompt, task_class, model, provider, status, created_at) VALUES ('legacy', 'legacy', 'test', 'test', 'test', 'failed', '2000-01-01')")
        applyMigrationSteps(FUTURE_MIGRATIONS)
        process.stdout.write(JSON.stringify({
          runsColumns: db.query('PRAGMA table_info(runs)').all().map(c => c.name),
          legacyTaskIdDefault: db.query("SELECT failure_kind FROM runs WHERE id = 'legacy'").get().failure_kind,
        }))
      `,
      )
      expect(result.runsColumns).toContain('failure_kind')
      expect(result.legacyTaskIdDefault).toBeNull()
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  it('migration 36 persists phase evaluations through insertRun and survives reopening', async () => {
    const home = tempHome()
    try {
      const result = (await runMigrationProcess(
        home,
        `
        import { Database } from 'bun:sqlite'
        const { runMigrations } = await import('./src/db/migrate.ts')
        const { db } = await import('./src/db/sqlite.ts')
        const { insertRun } = await import('./src/db/runs.ts')
        runMigrations()
        const phases = JSON.stringify([{ id: 'tdd', applied: true, reason: 'phase match' }, { id: 'large', applied: false, reason: 'omitted: skill context budget (48000 chars)' }])
        const record = {
          project_id: null, prompt: 'phase fixture', task_class: 'fix', model: 'fixture', provider: 'fixture', skill_id: null,
          task_id: null, allowed_outputs: null, files_attempted: null, files_authorized: null, files_blocked: null,
          snapshot_before: null, snapshot_after: null, qa_verdict: null, qa_reason: null,
          status: 'done', input_tokens: 0, output_tokens: 0, usd_cost: 0, elapsed_ms: 0, result: null,
        }
        const id = insertRun({ ...record, phase_skills_json: phases })
        const legacy = insertRun(record)
        runMigrations()
        db.close()
        const reopened = new Database(process.env.ORCHESTOS_HOME + '/.orchestos/db.sqlite')
        const row = reopened.query('SELECT phase_skills_json FROM runs WHERE id = ?').get(id)
        const empty = reopened.query('SELECT phase_skills_json FROM runs WHERE id = ?').get(legacy)
        const evidence = reopened.query('SELECT version, name FROM schema_migrations WHERE version = 36').all()
        process.stdout.write(JSON.stringify({ phases: JSON.parse(row.phase_skills_json), empty: empty.phase_skills_json, evidence }))
        reopened.close()
      `,
      )) as unknown as { phases: unknown[]; empty: null; evidence: unknown[] }
      expect(result.phases).toEqual([
        { id: 'tdd', applied: true, reason: 'phase match' },
        { id: 'large', applied: false, reason: 'omitted: skill context budget (48000 chars)' },
      ])
      expect(result.empty).toBeNull()
      expect(result.evidence).toEqual([{ version: 36, name: 'run-phase-skills' }])
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  it('migration 35 preserves legacy run steps and enables notices with their index', async () => {
    const home = tempHome()
    try {
      const result = (await runMigrationProcess(
        home,
        `
        const { runMigrations, applyMigrationSteps, FUTURE_MIGRATIONS } = await import('./src/db/migrate.ts')
        const { db } = await import('./src/db/sqlite.ts')
        runMigrations()
        db.exec('DROP TABLE run_steps; DELETE FROM schema_migrations WHERE version = 35')
        db.exec(\`CREATE TABLE run_steps (
          id INTEGER PRIMARY KEY AUTOINCREMENT, task_id TEXT NOT NULL, seq INTEGER NOT NULL,
          type TEXT NOT NULL CHECK(type IN ('tool_use', 'text', 'step_finish')),
          label TEXT NOT NULL, detail TEXT, cost_usd REAL, tokens_json TEXT, created_at TEXT NOT NULL
        ); CREATE INDEX idx_run_steps_task_id ON run_steps(task_id, seq)\`)
        for (const [seq, type] of ['tool_use', 'text', 'step_finish'].entries()) {
          db.run('INSERT INTO run_steps VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [seq + 7, 'legacy-run', seq + 1, type, 'label', 'detail', 0.02, '{"input":12}', 'created'])
        }
        const before = db.query('SELECT * FROM run_steps ORDER BY id').all()
        applyMigrationSteps(FUTURE_MIGRATIONS)
        applyMigrationSteps(FUTURE_MIGRATIONS)
        const after = db.query('SELECT * FROM run_steps ORDER BY id').all()
        db.run("INSERT INTO run_steps (task_id, seq, type, label, detail, created_at) VALUES (?, 4, 'notice', ?, ?, ?)",
          ['legacy-run', 'Quota reached', '{"kind":"quota","detail":"raw cause"}', 'now'])
        const notice = db.query("SELECT * FROM run_steps WHERE type = 'notice'").get()
        const index = db.query("SELECT sql FROM sqlite_master WHERE name = 'idx_run_steps_task_id'").get()
        const evidence = db.query('SELECT * FROM schema_migrations WHERE version = 35').all()
        process.stdout.write(JSON.stringify({ before, after, notice, index, evidence }))
        db.close()
      `,
      )) as unknown as {
        before: unknown[]
        after: unknown[]
        notice: { id: number; label: string; detail: string }
        index: { sql: string }
        evidence: Array<{ version: number; name: string }>
      }
      expect(result.before).toHaveLength(3)
      expect(result.after).toEqual(result.before)
      expect(result.notice).toMatchObject({ id: 10, label: 'Quota reached' })
      expect(JSON.parse(result.notice.detail)).toEqual({ kind: 'quota', detail: 'raw cause' })
      expect(result.index.sql).toContain('run_steps(task_id, seq)')
      expect(result.evidence).toHaveLength(1)
      expect(result.evidence[0]).toMatchObject({ version: 35, name: 'run-step-notices' })
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  it('migration 34 removes delegation while preserving rows, indexes, dependencies and segments', async () => {
    const home = tempHome()
    try {
      const result = (await runMigrationProcess(
        home,
        `
        const { runMigrations, applyMigrationSteps, FUTURE_MIGRATIONS } = await import('./src/db/migrate.ts')
        const { db } = await import('./src/db/sqlite.ts')
        runMigrations()
        // Restore the v33 column and ledger to exercise the upgrade with populated tables.
        db.exec("ALTER TABLE plan_items ADD COLUMN delegation TEXT NOT NULL DEFAULT '⚡' CHECK(delegation IN ('🧠','⚡','🔍'))")
        db.exec('DELETE FROM schema_migrations WHERE version = 34')
        db.exec("INSERT INTO plan_items (id, sprint, block, delegation, title, body, status, commit_sha, closed_at, position) VALUES ('open', 'Sprint', 'Block', '⚡', 'Open item', 'Open body', 'open', NULL, NULL, 0), ('done', 'Sprint', NULL, '🧠', 'Done item', 'Literal evidence', 'done', 'fixture-sha', '2026-11-03', 1)")
        db.exec("INSERT INTO plan_item_deps VALUES ('open', 'done')")
        db.exec("INSERT INTO plan_doc_segments VALUES ('PLAN.md', 0, 'item', '- [ ] **open — ⚡ Open item.**', 'open')")
        db.exec('CREATE INDEX idx_plan_items_title_fixture ON plan_items(title)')
        const rows = () => db.query('SELECT id, sprint, block, title, body, status, commit_sha, closed_at, position FROM plan_items ORDER BY position').all()
        const indexes = () => db.query("SELECT name, sql FROM sqlite_master WHERE type = 'index' AND tbl_name = 'plan_items' ORDER BY name").all()
        const before = rows()
        const indexesBefore = indexes()
        const depsBefore = db.query('SELECT * FROM plan_item_deps').all()
        const segmentsBefore = db.query('SELECT * FROM plan_doc_segments').all()
        applyMigrationSteps(FUTURE_MIGRATIONS, db)
        applyMigrationSteps(FUTURE_MIGRATIONS, db)
        process.stdout.write(JSON.stringify({ before, after: rows(), indexesBefore, indexesAfter: indexes(),
          depsBefore, depsAfter: db.query('SELECT * FROM plan_item_deps').all(),
          segmentsBefore, segmentsAfter: db.query('SELECT * FROM plan_doc_segments').all(),
          columns: db.query('PRAGMA table_info(plan_items)').all().map(row => row.name),
          versions: db.query('SELECT * FROM schema_migrations WHERE version = 34').all(),
          foreignKeyCheck: db.query('PRAGMA foreign_key_check').all(),
          foreignKeys: db.query('PRAGMA foreign_keys').get().foreign_keys }))
        db.close()
        `,
      )) as ChildResult & {
        before: unknown[]
        after: unknown[]
        indexesBefore: unknown[]
        indexesAfter: unknown[]
        depsBefore: unknown[]
        depsAfter: unknown[]
        segmentsBefore: unknown[]
        segmentsAfter: unknown[]
        columns: string[]
        versions: Array<{ version: number; name: string }>
        foreignKeyCheck: unknown[]
      }
      expect(result.before).toHaveLength(2)
      expect(result.after).toEqual(result.before)
      expect(result.indexesAfter).toEqual(result.indexesBefore)
      expect(result.depsBefore).toHaveLength(1)
      expect(result.depsAfter).toEqual(result.depsBefore)
      expect(result.segmentsBefore).toHaveLength(1)
      expect(result.segmentsAfter).toEqual(result.segmentsBefore)
      expect(result.columns).not.toContain('delegation')
      expect(result.versions).toEqual([
        expect.objectContaining({ version: 34, name: 'plan-items-without-delegation' }),
      ])
      expect(result.foreignKeyCheck).toEqual([])
      expect(result.foreignKeys).toBe(1)
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  it('migrates v29 chat sessions without losing children or restricting adapter ids', async () => {
    const home = tempHome()
    try {
      const result = (await runMigrationProcess(
        home,
        `
        const { runMigrations, applyMigrationSteps, FUTURE_MIGRATIONS } = await import('./src/db/migrate.ts')
        const { db } = await import('./src/db/sqlite.ts')
        runMigrations()
        // Restore the v29 agent CHECK and ledger before seeding the upgrade fixture.
        const legacy = db
        const sessionsSql = db.query("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'chat_sessions'").get().sql
        db.exec('PRAGMA foreign_keys = OFF')
        db.exec('DROP TABLE chat_sessions')
        db.exec(sessionsSql.replace('agent TEXT NOT NULL', "agent TEXT NOT NULL CHECK(agent IN ('local', 'claude', 'opencode', 'codex', 'api'))"))
        db.exec('CREATE INDEX idx_chat_sessions_project_updated ON chat_sessions(project_id, updated_at DESC); CREATE INDEX idx_chat_sessions_archived_project_updated ON chat_sessions(archived_at, project_id, updated_at DESC)')
        db.exec('DELETE FROM schema_migrations WHERE version = 30')
        db.exec('PRAGMA foreign_keys = ON')
        legacy.exec("INSERT INTO chat_sessions VALUES ('session', NULL, 'codex', 'chat', 'preserved', 'created', 'updated', 'archived', 'thread', 'codex-hash', 'claude-session', 'claude-hash', 3)")
        legacy.exec("INSERT INTO chat_messages (session_id, role, content, created_at) VALUES ('session', 'user', 'preserved message', 'created')")
        legacy.exec("INSERT INTO chat_turns (id, session_id, request_key, input_fingerprint, status, created_at, updated_at) VALUES ('turn', 'session', 'request', 'fingerprint', 'completed', 'created', 'updated')")
        legacy.exec("INSERT INTO chat_turn_steps (session_id, turn_id, seq, type, detail, created_at) VALUES ('session', 'turn', 1, 'text', 'preserved step', 'created')")
        legacy.exec("INSERT INTO console_commands (session_id, cmd, exit_code, stdout, stderr, elapsed_ms, timed_out, created_at) VALUES ('session', 'echo test', 0, 'test', '', 1, 0, 'created')")
        const before = legacy.query('SELECT * FROM chat_sessions').all()
        const tables = ['chat_messages', 'chat_turns', 'chat_turn_steps', 'console_commands']
        const childrenBefore = tables.map(table => legacy.query('SELECT * FROM ' + table).all())
        applyMigrationSteps(FUTURE_MIGRATIONS, legacy)
        const after = legacy.query('SELECT * FROM chat_sessions').all()
        const childrenAfter = tables.map(table => legacy.query('SELECT * FROM ' + table).all())
        legacy.exec("INSERT INTO chat_sessions (id, agent, mode, title, created_at, updated_at) VALUES ('fixture', 'fixture-chat', 'chat', 'fixture', 'created', 'updated')")
        const fixture = legacy.query("SELECT agent FROM chat_sessions WHERE id = 'fixture'").get()
        let invalidModeRejected = false
        try { legacy.exec("INSERT INTO chat_sessions (id, agent, mode, title, created_at, updated_at) VALUES ('invalid', 'fixture-chat', 'invalid', 'fixture', 'created', 'updated')") } catch { invalidModeRejected = true }
        const indexes = legacy.query("SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_chat_sessions_%' ORDER BY name").all().map(row => row.name)
        process.stdout.write(JSON.stringify({ before, after, childrenBefore, childrenAfter, fixture, invalidModeRejected, indexes,
          foreignKeyCheck: legacy.query('PRAGMA foreign_key_check').all(), foreignKeys: legacy.query('PRAGMA foreign_keys').get().foreign_keys }))
        db.close()
      `,
      )) as ChildResult & {
        before: unknown[]
        after: unknown[]
        childrenBefore: unknown[][]
        childrenAfter: unknown[][]
        fixture: { agent: string }
        invalidModeRejected: boolean
        indexes: string[]
        foreignKeyCheck: unknown[]
      }
      expect(result.before).toHaveLength(1)
      expect(result.after).toEqual(result.before)
      expect(result.childrenBefore.map((rows) => rows.length)).toEqual([1, 1, 1, 1])
      expect(result.childrenAfter).toEqual(result.childrenBefore)
      expect(result.fixture.agent).toBe('fixture-chat')
      expect(result.invalidModeRejected).toBe(true)
      expect(result.indexes).toEqual([
        'idx_chat_sessions_archived_project_updated',
        'idx_chat_sessions_project_updated',
      ])
      expect(result.foreignKeyCheck).toEqual([])
      expect(result.foreignKeys).toBe(1)
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

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
        const chatTurnColumns = db.query('PRAGMA table_info(chat_turns)').all().map(row => row.name)
        const chatMessageColumns = db.query('PRAGMA table_info(chat_messages)').all().map(row => row.name)
        const chatSessionColumns = db.query('PRAGMA table_info(chat_sessions)').all().map(row => row.name)
        const planItemColumns = db.query('PRAGMA table_info(plan_items)').all().map(row => row.name)
        db.run('INSERT INTO runs (id, prompt, task_class, model, provider, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', ['fixture-run', 'fixture', 'test', 'model', 'provider', 'done', '2026-07-29T00:00:00.000Z'])
        const runDefaults = db.query('SELECT input_tokens, cache_read_tokens, cache_write_tokens, output_tokens, usd_cost, elapsed_ms FROM runs WHERE id = ?').get('fixture-run')
        const statusNotNull = db.query('PRAGMA table_info(runs)').all().find(row => row.name === 'status').notnull
        let duplicatePathRejected = false
        db.run('INSERT INTO projects (id, path, stack_profile, agents_md, last_updated) VALUES (?, ?, ?, ?, ?)', ['fixture-project-1', '/fixture', '{}', '', '2026-07-29T00:00:00.000Z'])
        try {
          db.run('INSERT INTO projects (id, path, stack_profile, agents_md, last_updated) VALUES (?, ?, ?, ?, ?)', ['fixture-project-2', '/fixture', '{}', '', '2026-07-29T00:00:00.000Z'])
        } catch { duplicatePathRejected = true }
        const uniqueFilesIndex = db.query('PRAGMA index_list(files)').all().some(row => row.unique === 1)
        const foreignKeys = db.query('PRAGMA foreign_keys').get().foreign_keys
        const requiredIndexes = ['idx_files_project', 'idx_edges_from', 'idx_edges_to', 'idx_memory_project_scope', 'idx_eval_trials_task_batch', 'idx_chat_turns_session_request_key', 'idx_chat_turns_session_status'].every(name => db.query("SELECT 1 FROM sqlite_master WHERE type = 'index' AND name = ?").get(name) !== null)
        let invalidEvalFkRejected = false
        try {
          db.run('INSERT INTO eval_trials (run_id, eval_task_id, trial_index, batch_id, config_json, passed, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)', ['missing-run', 'fixture-eval', 1, 'fixture-batch', '{}', 1, '2026-07-29T00:00:00.000Z'])
        } catch { invalidEvalFkRejected = true }
        let donePlanItemWithoutCommitRejected = false
        try {
          db.run("INSERT INTO plan_items (id, sprint, title, status, position) VALUES (?, ?, ?, 'done', ?)", ['invalid-done-item', 'fixture', 'fixture', 1])
        } catch { donePlanItemWithoutCommitRejected = true }
        db.run('INSERT INTO memory_entries (id, project_id, topic_key, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', ['fixture-memory', 'fixture-project-1', 'fixture-topic', 'recoverable fts content', '2026-07-29T00:00:00.000Z', '2026-07-29T00:00:00.000Z'])
        const memoryCountAfter = db.query('SELECT COUNT(*) AS count FROM memory_entries').get().count
        const ftsMatchCount = db.query("SELECT COUNT(*) AS count FROM memory_fts WHERE memory_fts MATCH 'recoverable'").get().count
        db.exec('DELETE FROM memory_fts')
        const ftsRebuiltAfterCorruption = rebuildMemoryFts()
        db.exec('DROP TABLE memory_fts')
        const ftsRebuiltWithIncompatibility = rebuildMemoryFts()
        process.stdout.write(JSON.stringify({ tables, runsColumns, filesColumns, evalTrialColumns, chatTurnColumns, chatMessageColumns, chatSessionColumns, planItemColumns, schemaVersions, runDefaults, statusNotNull, duplicatePathRejected, uniqueFilesIndex, foreignKeys, requiredIndexes, invalidEvalFkRejected, donePlanItemWithoutCommitRejected, memoryCountBefore, memoryCountAfter, ftsMatchCount, ftsRebuiltAfterCorruption, ftsRebuiltWithIncompatibility }))
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
          'console_commands',
          'instincts',
          'run_steps',
          'eval_trials',
          'chat_turns',
          'plan_items',
          'plan_item_deps',
          'plan_doc_segments',
          'schema_migrations',
          'orchestration_runs',
        ]),
      )
      expect(result.schemaVersions).toEqual([
        { version: 1, name: 'baseline-current-schema' },
        { version: 2, name: 'chat-sessions' },
        { version: 3, name: 'eval-trials' },
        { version: 4, name: 'chat-messages-held-task' },
        { version: 5, name: 'chat-turns' },
        { version: 6, name: 'chat-turns-task-reservation' },
        { version: 7, name: 'plan-items' },
        { version: 8, name: 'plan-doc-segments' },
        { version: 9, name: 'chat-messages-held-task-recovery' },
        { version: 10, name: 'runs-project-foreign-key' },
        { version: 11, name: 'files-and-code-edges-project-foreign-keys' },
        { version: 12, name: 'archived-chat-sessions' },
        { version: 13, name: 'console-commands' },
        { version: 14, name: 'chat-turn-details' },
        { version: 15, name: 'soft-deleted-projects' },
        { version: 16, name: 'codex-chat-thread' },
        { version: 17, name: 'associate-legacy-chat-users-with-turns' },
        { version: 18, name: 'project-scope-instincts' },
        { version: 19, name: 'orchestration-budgets' },
        { version: 20, name: 'run-cache-token-counts' },
        { version: 21, name: 'run-cli-session-id' },
        { version: 22, name: 'run-qa-criteria' },
        { version: 23, name: 'task-run-watch' },
        { version: 24, name: 'run-executor-reply' },
        { version: 25, name: 'chat-message-task-report' },
        { version: 26, name: 'claude-chat-session' },
        { version: 27, name: 'runs-context-measured' },
        { version: 28, name: 'run-commit-revert' },
        { version: 29, name: 'task-action-approvals' },
        { version: 30, name: 'chat-sessions-agent-sin-lista' },
        { version: 31, name: 'run-commit-base' },
        { version: 32, name: 'chat-turn-notices' },
        { version: 33, name: 'chat-turn-cancelled' },
        { version: 34, name: 'plan-items-without-delegation' },
        { version: 35, name: 'run-step-notices' },
        { version: 36, name: 'run-phase-skills' },
        { version: 37, name: 'local-project-settings' },
        { version: 38, name: 'run-failure-kind' },
        { version: 39, name: 'project-owned-run-steps' },
        { version: 40, name: 'chat-turn-resume-content' },
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
          'cli_session_id',
          'qa_criteria_json',
          'context_used_tokens',
          'context_window_tokens',
        ]),
      )
      expect(result.filesColumns).toContain('embedding')
      expect(result.chatSessionColumns).toEqual(
        expect.arrayContaining([
          'codex_thread_id',
          'codex_context_hash',
          'claude_session_id',
          'claude_context_hash',
          'claude_message_count',
        ]),
      )
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
      expect(result.chatTurnColumns).toEqual(
        expect.arrayContaining(['id', 'session_id', 'request_key', 'input_fingerprint', 'status']),
      )
      expect(result.chatMessageColumns).toEqual(
        expect.arrayContaining(['task_held', 'existing_files']),
      )
      expect(result.planItemColumns).toEqual(
        expect.arrayContaining([
          'id',
          'sprint',
          'block',
          'title',
          'body',
          'status',
          'commit_sha',
          'closed_at',
          'position',
        ]),
      )
      expect(result.planItemColumns).not.toContain('delegation')
      expect(result.runDefaults).toEqual({
        input_tokens: 0,
        cache_read_tokens: 0,
        cache_write_tokens: 0,
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
      expect(result.donePlanItemWithoutCommitRejected).toBe(true)
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
        { version: 4, name: 'chat-messages-held-task' },
        { version: 5, name: 'chat-turns' },
        { version: 6, name: 'chat-turns-task-reservation' },
        { version: 7, name: 'plan-items' },
        { version: 8, name: 'plan-doc-segments' },
        { version: 9, name: 'chat-messages-held-task-recovery' },
        { version: 10, name: 'runs-project-foreign-key' },
        { version: 11, name: 'files-and-code-edges-project-foreign-keys' },
        { version: 12, name: 'archived-chat-sessions' },
        { version: 13, name: 'console-commands' },
        { version: 14, name: 'chat-turn-details' },
        { version: 15, name: 'soft-deleted-projects' },
        { version: 16, name: 'codex-chat-thread' },
        { version: 17, name: 'associate-legacy-chat-users-with-turns' },
        { version: 18, name: 'project-scope-instincts' },
        { version: 19, name: 'orchestration-budgets' },
        { version: 20, name: 'run-cache-token-counts' },
        { version: 21, name: 'run-cli-session-id' },
        { version: 22, name: 'run-qa-criteria' },
        { version: 23, name: 'task-run-watch' },
        { version: 24, name: 'run-executor-reply' },
        { version: 25, name: 'chat-message-task-report' },
        { version: 26, name: 'claude-chat-session' },
        { version: 27, name: 'runs-context-measured' },
        { version: 28, name: 'run-commit-revert' },
        { version: 29, name: 'task-action-approvals' },
        { version: 30, name: 'chat-sessions-agent-sin-lista' },
        { version: 31, name: 'run-commit-base' },
        { version: 32, name: 'chat-turn-notices' },
        { version: 33, name: 'chat-turn-cancelled' },
        { version: 34, name: 'plan-items-without-delegation' },
        { version: 35, name: 'run-step-notices' },
        { version: 36, name: 'run-phase-skills' },
        { version: 37, name: 'local-project-settings' },
        { version: 38, name: 'run-failure-kind' },
        { version: 39, name: 'project-owned-run-steps' },
        { version: 40, name: 'chat-turn-resume-content' },
      ])
      expect(result.legacyTaskIdDefault).toBeNull()
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  it('repairs the historical v4 collision without rewriting its ledger entry', async () => {
    const home = tempHome()
    try {
      mkdirSync(join(home, '.orchestos'), { recursive: true })
      const result = await runMigrationProcess(
        home,
        `
        import { Database } from 'bun:sqlite'
        const legacy = new Database(process.env.ORCHESTOS_HOME + '/.orchestos/db.sqlite')
        legacy.exec(\`
          CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL);
          CREATE TABLE chat_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            model TEXT,
            task_id TEXT,
            ocr_used TEXT,
            created_at TEXT NOT NULL
          );
        \`)
        for (const [version, name] of [
          [1, 'baseline-current-schema'],
          [2, 'chat-sessions'],
          [3, 'eval-trials'],
          [4, 'run-files-read'],
          [5, 'chat-turns'],
          [6, 'chat-turns-task-reservation'],
          [7, 'plan-items'],
          [8, 'plan-doc-segments'],
        ]) {
          legacy.run('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)', [version, name, '2026-09-07T00:00:00.000Z'])
        }
        legacy.run("INSERT INTO chat_messages (session_id, role, content, created_at) VALUES ('legacy-session', 'assistant', 'preserve this message', '2026-09-07T00:00:00.000Z')")
        legacy.close()

        const { runMigrations } = await import('./src/db/migrate.ts')
        const { db } = await import('./src/db/sqlite.ts')
        runMigrations()
        const afterFirst = {
          columns: db.query('PRAGMA table_info(chat_messages)').all().map(row => row.name),
          message: db.query("SELECT content FROM chat_messages WHERE session_id = 'legacy-session'").get().content,
          v4: db.query('SELECT name FROM schema_migrations WHERE version = 4').get().name,
          v9Count: db.query('SELECT COUNT(*) AS count FROM schema_migrations WHERE version = 9').get().count,
        }
        runMigrations()
        const afterSecond = {
          v9Count: db.query('SELECT COUNT(*) AS count FROM schema_migrations WHERE version = 9').get().count,
          schemaCount: db.query('SELECT COUNT(*) AS count FROM schema_migrations').get().count,
        }
        process.stdout.write(JSON.stringify({ afterFirst, afterSecond }))
        db.close()
      `,
      )

      const first = result as ChildResult & {
        afterFirst: { columns: string[]; message: string; v4: string; v9Count: number }
        afterSecond: { v9Count: number; schemaCount: number }
      }
      expect(first.afterFirst.columns).toEqual(
        expect.arrayContaining(['task_held', 'existing_files']),
      )
      expect(first.afterFirst.message).toBe('preserve this message')
      expect(first.afterFirst.v4).toBe('run-files-read')
      expect(first.afterFirst.v9Count).toBe(1)
      expect(first.afterSecond).toEqual({ v9Count: 1, schemaCount: 40 })
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  it('adds chat_messages.task_report on a fresh database (ERP.4.13)', async () => {
    const home = tempHome()
    try {
      const result = await runMigrationProcess(
        home,
        `
        const { runMigrations } = await import('./src/db/migrate.ts')
        const { db } = await import('./src/db/sqlite.ts')
        runMigrations()
        runMigrations()
        const columns = db.query('PRAGMA table_info(chat_messages)').all().map(row => row.name)
        process.stdout.write(JSON.stringify({ chatMessageColumns: columns }))
        db.close()
      `,
      )
      expect(result.chatMessageColumns).toContain('task_report')
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  it('keeps runs.executor_reply on a fresh database and across repeated migrations', async () => {
    const home = tempHome()
    try {
      const result = await runMigrationProcess(
        home,
        `
        const { runMigrations } = await import('./src/db/migrate.ts')
        const { db } = await import('./src/db/sqlite.ts')
        const { insertRun, getRun } = await import('./src/db/runs.ts')
        runMigrations()
        runMigrations()
        const runsColumns = db.query('PRAGMA table_info(runs)').all().map(row => row.name)
        const id = insertRun({
          project_id: null, prompt: 'p', task_class: 'code', model: 'm', provider: 'codex',
          status: 'failed', result: 'missing declared output(s): a.txt', executor_reply: 'respuesta del ejecutor',
          input_tokens: 0, output_tokens: 0, usd_cost: 0, elapsed_ms: 1,
        })
        const reply = getRun(id)?.executor_reply ?? null
        process.stdout.write(JSON.stringify({ runsColumns, reply }))
        db.close()
      `,
      )

      expect(result.runsColumns).toContain('executor_reply')
      expect((result as ChildResult & { reply?: string }).reply).toBe('respuesta del ejecutor')
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
      expect(result.schemaCount).toBe(40)
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
          version: 41,
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

      expect(result.evidence).toHaveLength(41)
      expect(result.evidence?.[40]).toMatchObject({ version: 41, name: 'migration-test-probe' })
      expect(result.evidence?.[9]?.applied_at).toEqual(expect.any(String))
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
          version: 41,
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
        const failedVersionCount = reopened.query('SELECT COUNT(*) AS count FROM schema_migrations WHERE version = 41').get().count
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
          version: 41,
          name: 'migration-test-precondition-failure',
          precondition() { throw new Error('injected precondition failure') },
          apply(database) { database.exec('CREATE TABLE migration_precondition_partial (id INTEGER PRIMARY KEY)') },
          postcondition() {},
        }
        try { applyMigrationSteps([...FUTURE_MIGRATIONS, preconditionFailure]) } catch {}
        const preconditionTableCount = db.query("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'migration_precondition_partial'").get().count

        const postconditionFailure = {
          version: 41,
          name: 'migration-test-postcondition-failure',
          precondition() {},
          apply(database) { database.exec('CREATE TABLE migration_postcondition_partial (id INTEGER PRIMARY KEY)') },
          postcondition() { throw new Error('injected postcondition failure') },
        }
        try { applyMigrationSteps([...FUTURE_MIGRATIONS, postconditionFailure]) } catch {}
        const postconditionTableCount = db.query("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'migration_postcondition_partial'").get().count

        const recoveryStep = {
          version: 41,
          name: 'migration-test-recovery',
          precondition() {},
          apply(database) { database.exec('CREATE TABLE migration_recovery (id INTEGER PRIMARY KEY)') },
          postcondition(database) {
            if (database.query("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'migration_recovery'").get() === null) throw new Error('recovery table missing')
          },
        }
        applyMigrationSteps([...FUTURE_MIGRATIONS, recoveryStep])
        const recoveryCount = db.query("SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'migration_recovery'").get().count
        const recoveryVersionCount = db.query('SELECT COUNT(*) AS count FROM schema_migrations WHERE version = 41').get().count
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
