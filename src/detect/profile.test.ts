import { describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { buildProfile } from './profile.ts'

describe('Bun project profile', () => {
  it('detects Bun runtime and bun run check commands', async () => {
    const root = mkdtempSync(join(tmpdir(), 'orchestos-profile-'))
    try {
      writeFileSync(
        join(root, 'package.json'),
        JSON.stringify({
          name: 'fixture',
          scripts: { typecheck: 'tsc', check: 'tsc', 'test:coverage': 'bun test' },
        }),
      )
      writeFileSync(join(root, 'bun.lock'), '{}')
      const profile = await buildProfile(root)
      expect(profile.manifest.runtime).toBe('Bun')
      expect(profile.commands).toEqual([
        'bun run typecheck',
        'bun run check',
        'bun run test:coverage',
      ])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
