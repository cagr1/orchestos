import { describe, expect, it } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

describe('database backup and privacy', () => {
  it('creates a private, integrity-checkable snapshot', async () => {
    const home = mkdtempSync(join(tmpdir(), 'orchestos-db-backup-home-'))
    const destination = join(home, 'backups', 'db.sqlite')
    try {
      const script = `
        const { runMigrations } = await import('./src/db/migrate.ts')
        const { upsertMemory } = await import('./src/db/memory.ts')
        const { createDatabaseBackup, restoreDatabaseBackup, verifyDatabaseBackup } = await import('./src/db/backup.ts')
        const providerKey = ['sk', 'live', '123456789012345678901234'].join('-')
        runMigrations()
        upsertMemory('backup-project', 'privacy', 'OPENAI_API_KEY=' + providerKey)
        const result = createDatabaseBackup(${JSON.stringify(destination)})
        const verified = verifyDatabaseBackup(${JSON.stringify(destination)})
        const restored = restoreDatabaseBackup(${JSON.stringify(destination)}, ${JSON.stringify(join(home, 'restored.sqlite'))})
        process.stdout.write(JSON.stringify({ result, verified, restored }))
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
      const result = JSON.parse(stdout) as {
        result: { bytes: number }
        verified: { ok: boolean; detail: string }
        restored: { bytes: number }
      }
      expect(result.result.bytes).toBeGreaterThan(0)
      expect(result.verified).toEqual({ ok: true, detail: 'ok' })
      expect(result.restored.bytes).toBe(result.result.bytes)
      expect(statSync(destination).mode & 0o777).toBe(0o600)
      expect(readFileSync(destination).byteLength).toBe(result.result.bytes)
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  it('rejects a corrupt backup without attempting recovery', async () => {
    const home = mkdtempSync(join(tmpdir(), 'orchestos-db-corrupt-home-'))
    const corrupt = join(home, 'corrupt.sqlite')
    try {
      writeFileSync(corrupt, Buffer.from('not a sqlite database'))
      const script = `
        const { verifyDatabaseBackup, restoreDatabaseBackup } = await import('./src/db/backup.ts')
        const verified = verifyDatabaseBackup(${JSON.stringify(corrupt)})
        let restoreError = ''
        try { restoreDatabaseBackup(${JSON.stringify(corrupt)}, ${JSON.stringify(join(home, 'restored.sqlite'))}) }
        catch (error) { restoreError = error instanceof Error ? error.message : String(error) }
        process.stdout.write(JSON.stringify({ verified, restoreError }))
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
      const result = JSON.parse(stdout) as { verified: { ok: boolean }; restoreError: string }
      expect(result.verified.ok).toBe(false)
      expect(result.restoreError).toContain('refusing corrupt backup')
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })

  it('redacts provider credentials before memory persistence', async () => {
    const home = mkdtempSync(join(tmpdir(), 'orchestos-db-privacy-home-'))
    try {
      const script = `
        const { runMigrations } = await import('./src/db/migrate.ts')
        const { upsertMemory, getMemory } = await import('./src/db/memory.ts')
        const providerKey = ['sk', 'live', '123456789012345678901234'].join('-')
        runMigrations()
        upsertMemory('privacy-project', 'secret', 'OPENAI_API_KEY=' + providerKey)
        const row = getMemory('privacy-project', 'secret')
        process.stdout.write(JSON.stringify({ content: row?.content ?? null }))
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
      const result = JSON.parse(stdout) as { content: string }
      expect(result.content).not.toContain(['sk', 'live', '123456789012345678901234'].join('-'))
      expect(result.content).toContain('[REDACTED:provider-key]')
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })
})
