import { describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

async function readContextRuns(): Promise<{
  projectClasses: Array<string | null>
  allRuns: Array<{ project_id: string | null; task_class: string | null }>
  limited: Array<{ project_id: string | null; task_class: string | null }>
}> {
  const home = mkdtempSync(join(tmpdir(), 'orchestos-context-runs-'))
  try {
    const script = `
      const { runMigrations } = await import('./src/db/migrate.ts')
      const { db } = await import('./src/db/sqlite.ts')
      const { listContextRuns } = await import('./src/db/runs.ts')
      runMigrations()
      const now = new Date().toISOString()
      for (const id of ['project-a', 'project-b']) db.run(
        'INSERT INTO projects (id, path, stack_profile, agents_md, last_updated) VALUES (?, ?, ?, ?, ?)',
        [id, process.env.ORCHESTOS_HOME + '/' + id, '{}', '', now],
      )
      const rows = [
        ['chat-a', 'project-a', 'chat', '2026-01-04T00:00:00.000Z'],
        ['task-a', 'project-a', 'implement', '2026-01-03T00:00:00.000Z'],
        ['chat-b', 'project-b', 'chat', '2026-01-02T00:00:00.000Z'],
        ['task-b', 'project-b', 'implement', '2026-01-01T00:00:00.000Z'],
        ['legacy', null, 'implement', '2025-12-31T00:00:00.000Z'],
      ]
      for (const [id, project, taskClass, createdAt] of rows) db.run(
        'INSERT INTO runs (id, project_id, prompt, task_class, model, provider, status, input_tokens, output_tokens, usd_cost, elapsed_ms, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [id, project, 'fixture', taskClass, 'model', 'provider', 'done', 0, 0, 0, 0, createdAt],
      )
      const result = {
        projectClasses: listContextRuns('project-a').map((run) => run.task_class),
        allRuns: listContextRuns(null).map(({ project_id, task_class }) => ({ project_id, task_class })),
        limited: listContextRuns(null, 1).map(({ project_id, task_class }) => ({ project_id, task_class })),
      }
      process.stdout.write(JSON.stringify(result))
      db.close()
    `
    const proc = Bun.spawn(['bun', '-e', script], {
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
    return JSON.parse(stdout) as Awaited<ReturnType<typeof readContextRuns>>
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
}

describe('listContextRuns', () => {
  it('excludes chat runs for project, global, and limited queries', async () => {
    const result = await readContextRuns()
    expect(result.projectClasses).toEqual(['implement'])
    expect(result.allRuns).toEqual([
      { project_id: 'project-a', task_class: 'implement' },
      { project_id: 'project-b', task_class: 'implement' },
      { project_id: null, task_class: 'implement' },
    ])
    expect(result.limited).toEqual([{ project_id: 'project-a', task_class: 'implement' }])
  })
})
