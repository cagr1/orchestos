import { expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readManifest } from '../detect/manifest.ts'

for (const name of [5, null, {}, [], '', '   ', 'valid-package']) {
  test(`manifest validates name ${JSON.stringify(name)}`, () => {
    const root = mkdtempSync(join(tmpdir(), 'aud17-manifest-'))
    try {
      writeFileSync(
        join(root, 'package.json'),
        JSON.stringify({ name, dependencies: { react: '1' } }),
      )
      const manifest = readManifest(root)
      expect(manifest.name).toBe(name === 'valid-package' ? name : 'unknown')
      expect(manifest.framework).toBe('React')
      expect(manifest.deps).toEqual(['react'])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
}
