import { describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Bun no ve cambios a process.env en runtime: la DB temporal se aísla en un subproceso.
async function runWithTemporaryHome(script: string): Promise<Record<string, unknown>> {
  const home = mkdtempSync(join(tmpdir(), 'orchestos-instinct-apply-'))
  try {
    const proc = Bun.spawn(['bun', '-e', script], {
      cwd: process.cwd(),
      env: { ...process.env, HOME: home, ORCHESTOS_HOME: home },
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

describe('instinctApply con sandbox', () => {
  it('resuelve el proyecto por projectRoot aunque effectiveRoot sea un worktree', async () => {
    const result = await runWithTemporaryHome(`
      const { mkdirSync } = await import('node:fs')
      const { join } = await import('node:path')
      const { randomUUID } = await import('node:crypto')
      const { runMigrations } = await import('./src/db/migrate.ts')
      const { db } = await import('./src/db/sqlite.ts')
      const instincts = await import('./src/instincts/store.ts')
      const { instinctApply } = await import('./src/run/middlewares/instinct-apply.ts')
      runMigrations()
      const aId = randomUUID(), bId = randomUUID()
      const rootA = join(process.env.ORCHESTOS_HOME, 'a')
      const rootB = join(process.env.ORCHESTOS_HOME, 'b')
      const worktree = join(rootA, '.orchestos', 'worktrees', 'task-1')
      mkdirSync(worktree, { recursive: true }); mkdirSync(rootB)
      const now = new Date().toISOString()
      for (const [id, root] of [[aId, rootA], [bId, rootB]]) db.run(
        'INSERT INTO projects (id, path, stack_profile, agents_md, last_updated) VALUES (?, ?, ?, ?, ?)',
        [id, root, '{}', '', now],
      )
      instincts.insertInstinct({ trigger: 't', action: 'ACCION-A', confidence: 1, source: 'manual', verified: true, projectId: aId })
      instincts.insertInstinct({ trigger: 't', action: 'ACCION-B', confidence: 1, source: 'manual', verified: true, projectId: bId })
      const global = instincts.insertInstinct({ trigger: 'g', action: 'GLOBAL', confidence: 1, source: 'manual', verified: true })
      instincts.insertInstinct({ trigger: 'u', action: 'UNVERIFIED', confidence: 1, source: 'manual', verified: false, projectId: aId })
      const ctx = { opts: { projectRoot: rootA }, effectiveRoot: worktree, instinctBlock: '' }
      await instinctApply(ctx, async () => {})
      process.stdout.write(JSON.stringify({ block: ctx.instinctBlock, ids: ctx.instinctIds, used: instincts.getInstinct(global.id), rows: instincts.listInstincts() }))
      db.close()
    `)
    const block = result.block as string
    expect(block).toContain('## INSTINCTS')
    expect(block).toContain('ACCION-A')
    expect(block).not.toContain('ACCION-B')
    expect(block).toContain('GLOBAL')
    expect(block).not.toContain('UNVERIFIED')
    expect(result.ids).toHaveLength(2)
    expect(result.used).toMatchObject({ injectedCount: 1, lastInjectedAt: expect.any(String) })
    const rows = result.rows as Array<{ action: string; injectedCount: number }>
    expect(rows.find((row) => row.action === 'ACCION-A')?.injectedCount).toBe(1)
    expect(rows.find((row) => row.action === 'ACCION-B')?.injectedCount).toBe(0)
    expect(rows.find((row) => row.action === 'UNVERIFIED')?.injectedCount).toBe(0)
  })
})

describe('lesson store limits and metadata', () => {
  it('caps at 15 and orders project lessons before more confident globals', async () => {
    const result = await runWithTemporaryHome(`
      const { runMigrations } = await import('./src/db/migrate.ts')
      const { db } = await import('./src/db/sqlite.ts')
      const store = await import('./src/instincts/store.ts')
      runMigrations()
      db.run("INSERT INTO projects (id, path, stack_profile, agents_md, last_updated) VALUES ('p', '/p', '{}', '', 'now')")
      const base = { trigger: 't', confidence: 1, source: 'manual', verified: true }
      for (let n = 0; n < 16; n++) {
        const row = store.insertInstinct({ ...base, trigger: 'global-' + n, action: 'global-' + n })
        db.run('UPDATE instincts SET created_at = ? WHERE id = ?', [String(n).padStart(3, '0'), row.id])
      }
      store.insertInstinct({ ...base, action: 'project-low', confidence: .8, projectId: 'p' })
      store.insertInstinct({ ...base, trigger: 'high', action: 'project-high', confidence: .9, projectId: 'p' })
      process.stdout.write(JSON.stringify({ global: store.listApplicable(), project: store.listApplicable('p'), count: store.LESSON_MAX_COUNT, chars: store.LESSON_MAX_CHARS }))
      db.close()
    `)
    expect(result.count).toBe(15)
    expect(result.chars).toBe(4000)
    const globals = result.global as Array<{ action: string }>
    const project = result.project as Array<{ action: string }>
    expect(globals).toHaveLength(15)
    expect(globals[0]?.action).toBe('global-15')
    expect(globals.at(-1)?.action).toBe('global-1')
    expect(project).toHaveLength(15)
    expect(project.slice(0, 3).map((row) => row.action)).toEqual([
      'project-high',
      'project-low',
      'global-15',
    ])
  })

  it('caps action characters at 4000 without truncating a lesson', async () => {
    const result = await runWithTemporaryHome(`
      const { runMigrations } = await import('./src/db/migrate.ts')
      const { db } = await import('./src/db/sqlite.ts')
      const store = await import('./src/instincts/store.ts')
      runMigrations()
      const base = { trigger: 't', confidence: 1, source: 'manual', verified: true }
      store.insertInstinct({ ...base, action: 'a'.repeat(3999) })
      store.insertInstinct({ ...base, trigger: 'b', action: 'b', confidence: .9 })
      const extra = store.insertInstinct({ ...base, trigger: 'c', action: 'c', confidence: .8 })
      const exact = store.listApplicable().map(i => i.action.length)
      store.updateInstinct(extra.id, { confidence: 1, action: 'c'.repeat(4001) })
      db.run('UPDATE instincts SET created_at = ? WHERE id = ?', ['9999', extra.id])
      process.stdout.write(JSON.stringify({ exact, oversized: store.listApplicable() }))
      db.close()
    `)
    expect(result.exact).toEqual([3999, 1])
    expect(result.oversized).toEqual([])
  })

  it('round trips why and evidence, clears them, and records repeat injections', async () => {
    const result = await runWithTemporaryHome(`
      const { runMigrations } = await import('./src/db/migrate.ts')
      const { db } = await import('./src/db/sqlite.ts')
      const store = await import('./src/instincts/store.ts')
      runMigrations()
      const row = store.insertInstinct({ trigger: 't', action: 'a', confidence: 1, source: 'manual', verified: true, why: 'because', evidence: { runId: 'r', turnId: 't', ref: 'file:1' } })
      const inserted = store.getInstinct(row.id)
      store.updateInstinct(row.id, { why: 'updated', evidence: { ref: 'other:2' } })
      const updated = store.getInstinct(row.id)
      store.recordInjected([row.id])
      const first = store.getInstinct(row.id)
      store.recordInjected([row.id])
      store.recordInjected([])
      const second = store.getInstinct(row.id)
      store.updateInstinct(row.id, { why: null, evidence: null })
      process.stdout.write(JSON.stringify({ inserted, updated, first, second, cleared: store.getInstinct(row.id) }))
      db.close()
    `)
    expect(result.inserted).toMatchObject({
      why: 'because',
      evidence: { runId: 'r', turnId: 't', ref: 'file:1' },
      injectedCount: 0,
      lastInjectedAt: null,
    })
    expect(result.updated).toMatchObject({ why: 'updated', evidence: { ref: 'other:2' } })
    expect(result.first).toMatchObject({ injectedCount: 1, lastInjectedAt: expect.any(String) })
    expect(result.second).toMatchObject({ injectedCount: 2, lastInjectedAt: expect.any(String) })
    expect(result.cleared).toMatchObject({ why: null, evidence: null, injectedCount: 2 })
  })
})
