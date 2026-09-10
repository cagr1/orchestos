import { expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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
          importPlan(root, true)
          const items = db.query('SELECT id, status, body, block FROM plan_items ORDER BY position').all()
          const segments = db
            .query('SELECT kind, text, item_id FROM plan_doc_segments ORDER BY position')
            .all()
          const deps = db.query('SELECT COUNT(*) AS count FROM plan_item_deps').get().count
          process.stdout.write(JSON.stringify({ count, items, deps, segments, secondImportRejected }))
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
      segments: Array<{ kind: string; text: string; item_id: string | null }>
    }
    expect(result.count).toBe(result.items.length)
    expect(result.deps).toBe(0)
    expect(result.segments.filter((segment) => segment.kind === 'item')).toHaveLength(2)
    expect(result.segments.map((segment) => segment.text).join('')).toBe(
      readFileSync(join(fixture, 'PLAN.md'), 'utf-8'),
    )
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

/**
 * S.6a part C regression — discovered while closing S.6a itself, not in the original spec.
 * The pre-commit hook's `plan:render --check` requires `plan_doc_segments` to already match
 * the STAGED (not yet committed) PLAN.md, which means reconcile must run before the closing
 * commit exists. A closing commit therefore cannot be proven yet for the item this very call
 * is transitioning to `done` — that item gets the same provisional `git rev-parse HEAD` the
 * dashboard's `preparePlanItemClose()` already uses, confirmed later by a post-commit reconcile.
 * An item that was ALREADY `done` before this call gets no such leniency: it must always prove
 * its own commit, or the whole reconcile aborts — this is the guarantee the fix is actually for.
 */
test('reconcile accepts a provisional HEAD for a newly-closing item, but never for an already-closed one', async () => {
  const home = mkdtempSync(join(tmpdir(), 'orchestos-plan-import-provisional-'))
  const fixture = mkdtempSync(join(tmpdir(), 'orchestos-plan-import-provisional-fixture-'))
  const gitEnv = {
    ...process.env,
    GIT_AUTHOR_NAME: 'OrchestOS test fixture',
    GIT_AUTHOR_EMAIL: 'fixture@orchestos.test',
    GIT_COMMITTER_NAME: 'OrchestOS test fixture',
    GIT_COMMITTER_EMAIL: 'fixture@orchestos.test',
  }
  const git = (args: string[]) => {
    const result = Bun.spawnSync(
      ['git', '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', ...args],
      { cwd: fixture, env: gitEnv, stdout: 'pipe', stderr: 'pipe' },
    )
    expect(result.exitCode, new TextDecoder().decode(result.stderr)).toBe(0)
  }
  try {
    writeFileSync(
      join(fixture, 'PLAN.md'),
      '## Sprint fixture\n- [ ] **F.1 — ⚡ Open item.**\n  Body for F.1.\n',
    )
    git(['init'])
    git(['add', 'PLAN.md'])
    git(['commit', '-m', 'F.1 open'])

    const run = async (script: string) => {
      const proc = Bun.spawn(['bun', '-e', script], {
        cwd: process.cwd(),
        env: { ...process.env, ORCHESTOS_HOME: home, PLAN_IMPORT_FIXTURE_ROOT: fixture },
        stdout: 'pipe',
        stderr: 'pipe',
      })
      const [exitCode, stdout, stderr] = await Promise.all([
        proc.exited,
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
      ])
      return { exitCode, stdout, stderr }
    }

    const seed = await run(`
      const { runMigrations } = await import('./src/db/migrate.ts')
      const { importPlan } = await import('./scripts/plan-import.ts')
      runMigrations()
      importPlan(process.env.PLAN_IMPORT_FIXTURE_ROOT)
    `)
    expect(seed.exitCode, seed.stderr).toBe(0)

    // Close F.1 in the working tree WITHOUT committing yet — the exact pre-commit sequence.
    writeFileSync(
      join(fixture, 'PLAN.md'),
      '## Sprint fixture\n- [x] **F.1 — ⚡ Open item.**\n  Body for F.1.\n',
    )
    const headBeforeCommit = Bun.spawnSync(['git', 'rev-parse', 'HEAD'], {
      cwd: fixture,
      stdout: 'pipe',
    })
      .stdout.toString()
      .trim()

    const preCommitReconcile = await run(`
      const { importPlan } = await import('./scripts/plan-import.ts')
      const { db } = await import('./src/db/sqlite.ts')
      importPlan(process.env.PLAN_IMPORT_FIXTURE_ROOT, true)
      const row = db.query('SELECT status, commit_sha FROM plan_items WHERE id = ?').get('F.1')
      process.stdout.write(JSON.stringify(row))
    `)
    expect(preCommitReconcile.exitCode, preCommitReconcile.stderr).toBe(0)
    const provisionalRow = JSON.parse(preCommitReconcile.stdout)
    expect(provisionalRow).toEqual({ status: 'done', commit_sha: headBeforeCommit })

    // A second reconcile with STILL no real commit must now fail: F.1 is already `done` in the
    // DB, so its provisional SHA no longer gets a free pass — it must prove a real transition.
    const secondReconcileWithoutCommit = await run(`
      const { importPlan } = await import('./scripts/plan-import.ts')
      importPlan(process.env.PLAN_IMPORT_FIXTURE_ROOT, true)
    `)
    expect(secondReconcileWithoutCommit.exitCode).not.toBe(0)
    expect(secondReconcileWithoutCommit.stderr).toContain(
      'Could not prove a closing commit SHA for F.1',
    )

    // Now make the real closing commit and reconcile again: the provisional SHA must be
    // replaced by the real one, proven by history — never left standing unverified.
    git(['add', 'PLAN.md'])
    git(['commit', '-m', 'close F.1'])
    const realSha = Bun.spawnSync(['git', 'rev-parse', 'HEAD'], { cwd: fixture, stdout: 'pipe' })
      .stdout.toString()
      .trim()
    const postCommitReconcile = await run(`
      const { importPlan } = await import('./scripts/plan-import.ts')
      const { db } = await import('./src/db/sqlite.ts')
      importPlan(process.env.PLAN_IMPORT_FIXTURE_ROOT, true)
      const row = db.query('SELECT status, commit_sha FROM plan_items WHERE id = ?').get('F.1')
      process.stdout.write(JSON.stringify(row))
    `)
    expect(postCommitReconcile.exitCode, postCommitReconcile.stderr).toBe(0)
    expect(JSON.parse(postCommitReconcile.stdout)).toEqual({
      status: 'done',
      commit_sha: realSha,
    })
    expect(realSha).not.toBe(headBeforeCommit)
  } finally {
    rmSync(home, { recursive: true, force: true })
    rmSync(fixture, { recursive: true, force: true })
  }
})

test('reconcile keeps a reclosed item pending instead of reviving its pre-reopen close SHA', async () => {
  const home = mkdtempSync(join(tmpdir(), 'orchestos-plan-import-reopen-'))
  const fixture = mkdtempSync(join(tmpdir(), 'orchestos-plan-import-reopen-fixture-'))
  const gitEnv = {
    ...process.env,
    GIT_AUTHOR_NAME: 'OrchestOS test fixture',
    GIT_AUTHOR_EMAIL: 'fixture@orchestos.test',
    GIT_COMMITTER_NAME: 'OrchestOS test fixture',
    GIT_COMMITTER_EMAIL: 'fixture@orchestos.test',
  }
  const git = (args: string[]) => {
    const result = Bun.spawnSync(
      ['git', '-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', ...args],
      { cwd: fixture, env: gitEnv, stdout: 'pipe', stderr: 'pipe' },
    )
    expect(result.exitCode, new TextDecoder().decode(result.stderr)).toBe(0)
  }
  const plan = (status: 'open' | 'done') =>
    `## Sprint fixture\n- [${status === 'done' ? 'x' : ' '}] **F.1 — ⚡ Reopen fixture.**\n  Body for F.1.\n`
  try {
    writeFileSync(join(fixture, 'PLAN.md'), plan('open'))
    git(['init'])
    git(['add', 'PLAN.md'])
    git(['commit', '-m', 'F.1 open'])

    const run = async (script: string) => {
      const proc = Bun.spawn(['bun', '-e', script], {
        cwd: process.cwd(),
        env: { ...process.env, ORCHESTOS_HOME: home, PLAN_IMPORT_FIXTURE_ROOT: fixture },
        stdout: 'pipe',
        stderr: 'pipe',
      })
      const [exitCode, stdout, stderr] = await Promise.all([
        proc.exited,
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
      ])
      return { exitCode, stdout, stderr }
    }
    const reconcile = () =>
      run(`
        const { importPlan } = await import('./scripts/plan-import.ts')
        const { listPlanItemsWithCommitStatus } = await import('./src/db/plan-items.ts')
        const { db } = await import('./src/db/sqlite.ts')
        importPlan(process.env.PLAN_IMPORT_FIXTURE_ROOT, true)
        process.stdout.write(JSON.stringify(listPlanItemsWithCommitStatus(process.env.PLAN_IMPORT_FIXTURE_ROOT, db)))
      `)

    const seed = await run(`
      const { runMigrations } = await import('./src/db/migrate.ts')
      const { importPlan } = await import('./scripts/plan-import.ts')
      runMigrations()
      importPlan(process.env.PLAN_IMPORT_FIXTURE_ROOT)
    `)
    expect(seed.exitCode, seed.stderr).toBe(0)

    writeFileSync(join(fixture, 'PLAN.md'), plan('done'))
    git(['add', 'PLAN.md'])
    git(['commit', '-m', 'close F.1'])
    const closeA = Bun.spawnSync(['git', 'rev-parse', 'HEAD'], { cwd: fixture, stdout: 'pipe' })
      .stdout.toString()
      .trim()
    const firstClose = await reconcile()
    expect(firstClose.exitCode, firstClose.stderr).toBe(0)
    expect(JSON.parse(firstClose.stdout)[0]).toMatchObject({
      status: 'done',
      commitSha: closeA,
      commitPending: false,
    })

    writeFileSync(join(fixture, 'PLAN.md'), plan('open'))
    git(['add', 'PLAN.md'])
    git(['commit', '-m', 'reopen F.1'])
    const reopen = await reconcile()
    expect(reopen.exitCode, reopen.stderr).toBe(0)
    expect(JSON.parse(reopen.stdout)[0]).toMatchObject({ status: 'open', commitSha: null })

    writeFileSync(join(fixture, 'PLAN.md'), plan('done'))

    const recloseWithoutCommit = await reconcile()
    expect(recloseWithoutCommit.exitCode, recloseWithoutCommit.stderr).toBe(0)
    expect(JSON.parse(recloseWithoutCommit.stdout)[0]).toMatchObject({
      status: 'done',
      commitPending: true,
    })

    const repeatedReconcile = await reconcile()
    expect(repeatedReconcile.exitCode).not.toBe(0)
    expect(repeatedReconcile.stderr).toContain('Could not prove a closing commit SHA for F.1')
    const statusAfterRejectedReconcile = await run(`
      const { listPlanItemsWithCommitStatus } = await import('./src/db/plan-items.ts')
      const { db } = await import('./src/db/sqlite.ts')
      process.stdout.write(JSON.stringify(listPlanItemsWithCommitStatus(process.env.PLAN_IMPORT_FIXTURE_ROOT, db)))
    `)
    expect(statusAfterRejectedReconcile.exitCode, statusAfterRejectedReconcile.stderr).toBe(0)
    expect(JSON.parse(statusAfterRejectedReconcile.stdout)[0]).toMatchObject({
      status: 'done',
      commitPending: true,
    })
    expect(JSON.parse(statusAfterRejectedReconcile.stdout)[0].commitSha).not.toBe(closeA)
  } finally {
    rmSync(home, { recursive: true, force: true })
    rmSync(fixture, { recursive: true, force: true })
  }
})
