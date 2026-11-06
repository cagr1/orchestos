import { describe, expect, it } from 'bun:test'
import { existsSync, mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

describe('sqlite path isolation', () => {
  it('ORCHESTOS_HOME dirige la DB a una raíz aislada en un proceso nuevo', async () => {
    const home = mkdtempSync(join(tmpdir(), 'orchestos-db-test-'))
    try {
      const script =
        "import { db } from './src/db/sqlite.ts'; db.query('SELECT 1 AS ok').get(); db.close()"
      const proc = Bun.spawn(['bun', '-e', script], {
        cwd: process.cwd(),
        env: { ...process.env, ORCHESTOS_HOME: home },
        stdout: 'pipe',
        stderr: 'pipe',
      })
      const [exitCode, stderr] = await Promise.all([proc.exited, new Response(proc.stderr).text()])

      expect(exitCode, stderr).toBe(0)
      expect(existsSync(join(home, '.orchestos', 'db.sqlite'))).toBe(true)
    } finally {
      rmSync(home, { recursive: true, force: true })
    }
  })
})
