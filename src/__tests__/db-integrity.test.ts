import { describe, it, expect } from 'bun:test'
import { mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

async function spawnWriter(home: string, taskId: string, count: number): Promise<{ exitCode: number; stderr: string }> {
  const script = `
    const { runMigrations } = await import('./src/db/migrate.ts')
    const { insertRunStep } = await import('./src/db/run-steps.ts')
    runMigrations()
    for (let i = 0; i < ${count}; i++) {
      insertRunStep(${JSON.stringify(taskId)}, { type: 'text', label: 'writer-' + i })
    }
  `
  const proc = Bun.spawn(['bun', '-e', script], {
    cwd: process.cwd(),
    env: { ...process.env, ORCHESTOS_HOME: home },
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const [exitCode, stderr] = await Promise.all([
    proc.exited,
    new Response(proc.stderr).text(),
  ])
  return { exitCode, stderr }
}

describe('database integrity boundaries', () => {
  it('parameterized persistence treats SQL-looking content as data', async () => {
    const home = mkdtempSync(join(tmpdir(), 'orchestos-db-integrity-'))
    try {
      const script = `
        const { runMigrations } = await import('./src/db/migrate.ts')
        const { upsertMemory, getMemory } = await import('./src/db/memory.ts')
        const { db } = await import('./src/db/sqlite.ts')
        runMigrations()
        const content = \"'); DROP TABLE memory_entries; --\"
        upsertMemory('integrity-project', 'injection', content)
        const row = getMemory('integrity-project', 'injection')
        const table = db.query(\"SELECT name FROM sqlite_master WHERE type='table' AND name='memory_entries'\").get()
        process.stdout.write(JSON.stringify({ content: row?.content, table: Boolean(table) }))
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
      const result = JSON.parse(stdout) as { content: string; table: boolean }
      expect(result.content).toBe("'); DROP TABLE memory_entries; --")
      expect(result.table).toBe(true)
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  it('serializes concurrent run-step writers without duplicate sequence numbers', async () => {
    const home = mkdtempSync(join(tmpdir(), 'orchestos-db-concurrency-'))
    const taskId = 'concurrent-run-steps'
    try {
      const setup = await spawnWriter(home, 'setup-only', 0)
      expect(setup.exitCode, setup.stderr).toBe(0)
      const [a, b] = await Promise.all([
        spawnWriter(home, taskId, 20),
        spawnWriter(home, taskId, 20),
      ])
      expect(a.exitCode, a.stderr).toBe(0)
      expect(b.exitCode, b.stderr).toBe(0)

      const verify = await spawnWriter(home, 'verify-only', 0)
      expect(verify.exitCode, verify.stderr).toBe(0)
      const script = `
        const { db } = await import('./src/db/sqlite.ts')
        const rows = db.query('SELECT seq FROM run_steps WHERE task_id = ? ORDER BY seq').all(${JSON.stringify(taskId)})
        process.stdout.write(JSON.stringify({ count: rows.length, max: rows.at(-1)?.seq ?? 0, unique: new Set(rows.map(row => row.seq)).size }))
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
      const result = JSON.parse(stdout) as { count: number; max: number; unique: number }
      expect(result).toEqual({ count: 40, max: 40, unique: 40 })
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })
})
