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
      const ctx = { opts: { projectRoot: rootA }, effectiveRoot: worktree, instinctBlock: '' }
      await instinctApply(ctx, async () => {})
      process.stdout.write(JSON.stringify({ block: ctx.instinctBlock }))
      db.close()
    `)
    const block = result.block as string
    expect(block).toContain('## INSTINCTS')
    expect(block).toContain('ACCION-A')
    expect(block).not.toContain('ACCION-B')
  })
})
