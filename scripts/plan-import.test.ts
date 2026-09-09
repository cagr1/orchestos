import { expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('imports every parsed plan item into an isolated database with literal bodies', async () => {
  const home = mkdtempSync(join(tmpdir(), 'orchestos-plan-import-'))
  const fixture = mkdtempSync(join(tmpdir(), 'orchestos-plan-import-fixture-'))
  try {
    mkdirSync(join(fixture, 'docs', 'done'), { recursive: true })
    writeFileSync(
      join(fixture, 'PLAN.md'),
      `## Sprint fixture

- [ ] **F.1 — ⚡ Ítem abierto.**
  Cuerpo controlado del ítem abierto.

### Sub-bloque fixture

- [x] **F.2 — 🧠 Ítem cerrado con evidencia.** (cerrado 2026-09-09) → [evidencia](docs/done/fixture.md#f2)
  Este cuerpo del plan no debe importarse para el ítem cerrado.
`,
    )
    writeFileSync(
      join(fixture, 'docs', 'done', 'fixture.md'),
      `<a id="f2"></a>
Evidencia controlada del ítem cerrado.
`,
    )
    for (const args of [
      ['init'],
      ['add', 'PLAN.md', 'docs/done/fixture.md'],
      ['commit', '-m', 'fixture plan import'],
    ]) {
      const git = Bun.spawnSync(
        ['git', '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', ...args],
        {
          cwd: fixture,
          env: {
            ...process.env,
            GIT_AUTHOR_NAME: 'OrchestOS test fixture',
            GIT_AUTHOR_EMAIL: 'fixture@orchestos.test',
            GIT_COMMITTER_NAME: 'OrchestOS test fixture',
            GIT_COMMITTER_EMAIL: 'fixture@orchestos.test',
          },
          stdout: 'pipe',
          stderr: 'pipe',
        },
      )
      expect(git.exitCode, new TextDecoder().decode(git.stderr)).toBe(0)
    }

    const proc = Bun.spawn(
      [
        'bun',
        '-e',
        `
          const { runMigrations } = await import('./src/db/migrate.ts')
          const { importPlan } = await import('./scripts/plan-import.ts')
          const { db } = await import('./src/db/sqlite.ts')
          runMigrations()
          const root = process.env.PLAN_IMPORT_FIXTURE_ROOT
          if (!root) throw new Error('PLAN_IMPORT_FIXTURE_ROOT is required')
          const count = importPlan(root)
          let secondImportRejected = false
          try { importPlan(root) } catch { secondImportRejected = true }
          const items = db.query('SELECT id, status, body, block FROM plan_items ORDER BY position').all()
          const deps = db.query('SELECT COUNT(*) AS count FROM plan_item_deps').get().count
          process.stdout.write(JSON.stringify({ count, items, deps, secondImportRejected }))
          db.close()
        `,
      ],
      {
        cwd: process.cwd(),
        env: { ...process.env, ORCHESTOS_HOME: home, PLAN_IMPORT_FIXTURE_ROOT: fixture },
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
    expect(result.items.find((item) => item.id === 'F.1')?.body).toContain(
      'Cuerpo controlado del ítem abierto',
    )
    expect(result.items.find((item) => item.id === 'F.2')).toMatchObject({
      status: 'done',
      block: 'Sub-bloque fixture',
    })
    expect(result.items.find((item) => item.id === 'F.2')?.body).toContain(
      'Evidencia controlada del ítem cerrado',
    )
  } finally {
    rmSync(home, { recursive: true, force: true })
    rmSync(fixture, { recursive: true, force: true })
  }
})
