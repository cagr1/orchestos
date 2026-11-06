import { describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

async function runIsolated(body: string): Promise<Record<string, unknown>> {
  const home = mkdtempSync(join(tmpdir(), 'orchestos-project-lifecycle-'))
  try {
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
    return JSON.parse(stdout) as Record<string, unknown>
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
}

describe('UI.9.9 project lifecycle', () => {
  it('soft-deletes only the workspace registration and purges all project rows explicitly', async () => {
    const result = await runIsolated(`
      const { existsSync, mkdirSync } = await import('node:fs')
      const { join } = await import('node:path')
      const { runMigrations } = await import('./src/db/migrate.ts')
      const { db } = await import('./src/db/sqlite.ts')
      const projects = await import('./src/db/projects.ts')
      const sessions = await import('./src/db/chat-sessions.ts')
      const { route } = await import('./src/dashboard/server.ts')
      runMigrations()
      const root = join(process.env.ORCHESTOS_HOME, 'project')
      mkdirSync(root, { recursive: true })
      const now = new Date().toISOString()
      db.run('INSERT INTO projects (id, path, stack_profile, agents_md, last_updated) VALUES (?, ?, ?, ?, ?)', ['p1', root, '{}', '', now])
      const session = sessions.createChatSession({ projectId: 'p1', agent: 'api', title: 'kept chat' })
      sessions.appendChatExchange({ sessionId: session.id, userContent: 'hello', assistantContent: 'world' })
      db.run('INSERT INTO runs (id, project_id, prompt, task_class, model, provider, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', ['run-1', 'p1', 'prompt', 'test', 'model', 'provider', 'done', now])
      db.run('INSERT INTO context_chunks (id, project_id, key, value, updated_at) VALUES (?, ?, ?, ?, ?)', ['ctx-1', 'p1', 'key', 'value', now])
      db.run('INSERT INTO files (project_id, path, language, sha1, size_bytes, indexed_at) VALUES (?, ?, ?, ?, ?, ?)', ['p1', 'src/main.ts', 'typescript', 'sha', 1, now])
      db.run('INSERT INTO memory_entries (id, project_id, topic_key, scope, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)', ['mem-1', 'p1', 'topic', 'project', 'content', now, now])

      const beforeDelete = { session, sessions: db.query('SELECT id, project_id FROM chat_sessions').all(), chatCount: db.query('SELECT COUNT(*) AS count FROM chat_sessions WHERE project_id = ?').get('p1').count, runCount: db.query('SELECT COUNT(*) AS count FROM runs WHERE project_id = ?').get('p1').count }
      const deleted = await route(new Request('http://localhost/api/projects/p1', { method: 'DELETE' }), 4242)
      const afterDelete = {
        status: deleted.status,
        projects: projects.listProjects().map((row) => row.id),
        chatCount: db.query('SELECT COUNT(*) AS count FROM chat_sessions WHERE project_id = ?').get('p1').count,
        runCount: db.query('SELECT COUNT(*) AS count FROM runs WHERE project_id = ?').get('p1').count,
        folderExists: existsSync(root),
      }

      projects.upsertProject(root, {}, '')
      const restored = projects.listProjects()
      const purge = await route(new Request('http://localhost/api/projects/p1/purge', { method: 'POST' }), 4242)
      const projectTables = db.query("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all().filter(({ name }) => db.query("PRAGMA table_info('" + name + "')").all().some((column) => column.name === 'project_id'))
      const remaining = projectTables.map(({ name }) => ({ name, count: db.query("SELECT COUNT(*) AS count FROM '" + name + "' WHERE project_id = ?").get('p1').count })).filter(({ count }) => count !== 0)
      process.stdout.write(JSON.stringify({ beforeDelete, afterDelete, restored: restored.map((row) => row.id), purgeStatus: purge.status, remaining, projectRow: db.query('SELECT COUNT(*) AS count FROM projects WHERE id = ?').get('p1').count }))
      db.close()
    `)

    expect(result.afterDelete).toEqual({
      status: 200,
      projects: [],
      chatCount: 1,
      runCount: 1,
      folderExists: true,
    })
    expect(result.restored).toEqual(['p1'])
    expect(result.purgeStatus).toBe(200)
    expect(result.remaining).toEqual([])
    expect(result.projectRow).toBe(0)
  })
})
