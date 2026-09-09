import { expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('imports every parsed plan item into an isolated database with literal bodies', async () => {
  const home = mkdtempSync(join(tmpdir(), 'orchestos-plan-import-'))
  try {
    const proc = Bun.spawn(
      [
        'bun',
        '-e',
        `
          const { runMigrations } = await import('./src/db/migrate.ts')
          const { importPlan } = await import('./scripts/plan-import.ts')
          const { db } = await import('./src/db/sqlite.ts')
          runMigrations()
          const count = importPlan(process.cwd())
          let secondImportRejected = false
          try { importPlan(process.cwd()) } catch { secondImportRejected = true }
          const items = db.query('SELECT id, status, body, block FROM plan_items ORDER BY position').all()
          const deps = db.query('SELECT COUNT(*) AS count FROM plan_item_deps').get().count
          process.stdout.write(JSON.stringify({ count, items, deps, secondImportRejected }))
          db.close()
        `,
      ],
      {
        cwd: process.cwd(),
        env: { ...process.env, ORCHESTOS_HOME: home },
        stdout: 'pipe',
        stderr: 'pipe',
      },
    )
    const [exitCode, stdout, stderr] = await Promise.all([
      proc.exited,
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ])
    expect(exitCode, stderr).toBe(0)
    const result = JSON.parse(stdout) as {
      count: number
      deps: number
      secondImportRejected: boolean
      items: Array<{ id: string; status: string; body: string; block: string | null }>
    }
    expect(result.count).toBe(result.items.length)
    expect(result.deps).toBe(0)
    expect(result.secondImportRejected).toBe(true)
    expect(result.items.find((item) => item.id === 'S.3')?.body).toContain('Spec ejecutable')
    expect(result.items.find((item) => item.id === 'R.5')?.body).toContain('Persistencia')
    expect(result.items.find((item) => item.id === 'H.1.1')).toMatchObject({
      status: 'done',
      block: 'H.1 — Presentación: lo que descalifica al repo en 30 segundos',
    })
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
})
