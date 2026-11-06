import { describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { upsertProject } from '../db/projects.ts'
import { db } from '../db/sqlite.ts'
import { buildProfile } from '../detect/profile.ts'
import { generateAgentsMd } from '../generators/agents-md.ts'
import { refreshProjectContext } from './load.ts'

describe('refreshProjectContext', () => {
  it('refreshes a registered project whose saved context is stale', async () => {
    const root = mkdtempSync(join(tmpdir(), 'orchestos-context-refresh-'))
    try {
      writeFileSync(
        join(root, 'package.json'),
        JSON.stringify({
          name: 'fixture',
          scripts: { test: 'bun test' },
          dependencies: { react: '^19' },
        }),
      )
      writeFileSync(join(root, 'bun.lock'), '')
      upsertProject(root, await buildProfile(root), 'old generated context')

      const refreshed = await refreshProjectContext(root)

      expect(refreshed?.agentsMd).toContain('Runtime: Bun')
      expect(refreshed?.agentsMd).toContain('Framework: React')
      expect(refreshed?.agentsMd).toContain('bun run test')
      expect(refreshed?.agentsMd).not.toBe('old generated context')
    } finally {
      db.run('DELETE FROM projects WHERE path = ?', [root])
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('does not write when the generated context is already current', async () => {
    const root = mkdtempSync(join(tmpdir(), 'orchestos-context-current-'))
    try {
      writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'fixture' }))
      const profile = await buildProfile(root)
      const agentsMd = generateAgentsMd(profile)
      upsertProject(root, profile, agentsMd)
      db.run('UPDATE projects SET last_updated = ? WHERE path = ?', ['fixed timestamp', root])

      const refreshed = await refreshProjectContext(root)

      expect(refreshed?.agentsMd).toBe(agentsMd)
      expect(db.query('SELECT last_updated FROM projects WHERE path = ?').get(root)).toEqual({
        last_updated: 'fixed timestamp',
      })
    } finally {
      db.run('DELETE FROM projects WHERE path = ?', [root])
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('returns null when the project is not registered', async () => {
    const root = mkdtempSync(join(tmpdir(), 'orchestos-context-missing-'))
    try {
      expect(await refreshProjectContext(root)).toBeNull()
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
