import { describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { dropIgnoredOutputs } from '../handlers/project.ts'

describe('dropIgnoredOutputs', () => {
  it('filters ignored files and preserves the remaining order', () => {
    const root = mkdtempSync(join(tmpdir(), 'orchestos-draft-ignored-'))
    try {
      Bun.spawnSync(['git', 'init'], { cwd: root, stdout: 'ignore', stderr: 'ignore' })
      writeFileSync(join(root, '.gitignore'), '*.sqlite\n')

      expect(
        dropIgnoredOutputs(root, [
          'src/db/migrate.ts',
          'data/inventario.sqlite',
          'tests/migrate.test.ts',
        ]),
      ).toEqual(['src/db/migrate.ts', 'tests/migrate.test.ts'])
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('keeps all outputs when the root is not a Git repository', () => {
    const root = mkdtempSync(join(tmpdir(), 'orchestos-draft-no-git-'))
    const output = ['src/db/migrate.ts', 'data/inventario.sqlite']
    try {
      expect(dropIgnoredOutputs(root, output)).toEqual(output)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
